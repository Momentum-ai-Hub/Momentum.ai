// app/api/portfolio/snapshot/route.js
//
// ARCHITECTURE "DRIP" — remplace le run unique 2x/jour qui violait le
// rate-limit Twelve Data (8 req/min) et dépassait largement les 60s
// max d'une fonction Vercel Hobby.
//
// Principe : un cron externe (GitHub Actions, ~toutes les 10 min, gratuit
// et pas limité à 1x/jour comme le cron natif Vercel Hobby) appelle cette
// route. Chaque appel traite un lot de BATCH_SIZE tickers (curseur persisté
// dans la table snapshot_cursor), via Finnhub (60 req/min, donc un lot de
// 50 tient largement dans une fenêtre de 60s, avec marge de sécurité).
// Cycle complet sur ~330 tickers : environ 7 runs, donc ~70 minutes pour
// rafraîchir tout l'univers — bien plus frais que l'ancien 2x/jour.
//
// Upsert par ticker (pas d'INSERT en historique) : portfolio_snapshots
// garde une seule ligne "état courant" par ticker. Nécessite une
// contrainte UNIQUE sur la colonne ticker (voir setup.sql).
//
// Sparklines : retirées de cette route (gourmandes en requêtes, usage
// purement visuel). À faire à la demande côté UI si besoin plus tard.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const FINNHUB_KEY = process.env.NEXT_PUBLIC_FINNHUB_KEY;

var BATCH_SIZE  = 50; // marge sous la limite Finnhub (60/min)
var CONCURRENCY = 5;  // mini-lots internes pour paralléliser sans rafale brutale
var ROUND_PAUSE = 250; // ms entre mini-lots

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

// Label de session approximatif basé sur l'heure UTC réelle
// (corrige le bug précédent qui inversait JP_CLOSE/US_CLOSE)
function getSessionLabel() {
  var h = new Date().getUTCHours();
  if (h < 7)  return "ASIA";
  if (h < 13) return "EU";
  return "US";
}

async function fetchQuote(ticker) {
  var url = "https://finnhub.io/api/v1/quote?symbol=" + ticker + "&token=" + FINNHUB_KEY;
  try {
    var res = await fetch(url);
    if (!res.ok) return null;
    var data = await res.json();
    if (typeof data.c !== "number") return null;
    return data;
  } catch (e) {
    return null;
  }
}

async function fetchBatch(tickers) {
  var results = [];
  for (var i = 0; i < tickers.length; i += CONCURRENCY) {
    var slice = tickers.slice(i, i + CONCURRENCY);
    var promises = slice.map(function (t) {
      return fetchQuote(t).then(function (q) { return { ticker: t, quote: q }; });
    });
    var settled = await Promise.all(promises);
    results = results.concat(settled);
    if (i + CONCURRENCY < tickers.length) await sleep(ROUND_PAUSE);
  }
  return results;
}

export async function GET(request) {
  var auth = request.headers.get("authorization");
  if (auth !== "Bearer " + process.env.CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Charger l'univers complet de tickers
    var portfolioRes = await supabase
      .from("portfolio_tickers")
      .select("ticker")
      .order("ticker");
    if (portfolioRes.error) throw new Error(portfolioRes.error.message);

    var allTickers = (portfolioRes.data || []).map(function (t) { return t.ticker; });
    if (allTickers.length === 0) {
      return Response.json({ success: true, count: 0, note: "Aucun ticker en portefeuille" });
    }

    // 2. Lire le curseur (position du dernier ticker traité)
    var cursorRes = await supabase
      .from("snapshot_cursor")
      .select("last_index")
      .eq("id", 1)
      .single();

    var lastIndex = 0;
    if (cursorRes.data && typeof cursorRes.data.last_index === "number") {
      lastIndex = cursorRes.data.last_index;
    }
    if (lastIndex >= allTickers.length) lastIndex = 0;

    // 3. Construire le lot de ce run (avec wrap-around circulaire)
    var batch = [];
    var idx = lastIndex;
    var n = 0;
    while (n < BATCH_SIZE && n < allTickers.length) {
      batch.push(allTickers[idx]);
      idx = (idx + 1) % allTickers.length;
      n++;
    }

    var session = getSessionLabel();
    var fetched = await fetchBatch(batch);

    // 4. Construire les lignes à upserter
    var rows = [];
    fetched.forEach(function (r) {
      if (!r.quote) return;
      var price = (typeof r.quote.c === "number") ? r.quote.c : null;
      // dp = "percent change" déjà en unité pourcentage (ex: 1.23 = +1.23%)
      // même convention que l'ancien champ Twelve Data percent_change —
      // ne pas diviser par 100, pour rester compatible avec le reste du système.
      var changePct = (typeof r.quote.dp === "number") ? r.quote.dp : null;
      if (price === null && changePct === null) return;
      rows.push({
        ticker: r.ticker,
        price: price,
        change_1d: changePct,
        session: session,
      });
    });

    if (rows.length > 0) {
      var upsertRes = await supabase
        .from("portfolio_snapshots")
        .upsert(rows, { onConflict: "ticker" });
      if (upsertRes.error) throw new Error(upsertRes.error.message);
    }

    // 5. Avancer et persister le curseur pour le prochain run
    var cursorUpsert = await supabase
      .from("snapshot_cursor")
      .upsert({ id: 1, last_index: idx }, { onConflict: "id" });
    if (cursorUpsert.error) throw new Error(cursorUpsert.error.message);

    return Response.json({
      success: true,
      session: session,
      batchSize: batch.length,
      updated: rows.length,
      skipped: batch.length - rows.length,
      nextIndex: idx,
      totalTickers: allTickers.length,
      time: new Date().toISOString(),
    });

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
