// app/api/portfolio/snapshot/route.js
// Appelé 2x/jour par Vercel Cron : 14h et 22h
// Récupère prix + variations pour tous les tickers via Twelve Data
// Stocke dans portfolio_snapshots

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const TWELVEDATA_KEY = process.env.TWELVEDATA_KEY;
const CHUNK_SIZE = 8; // Twelve Data accepte jusqu'à 8 symboles par appel

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function getSession() {
  const h = new Date().getUTCHours();
  // 14h UTC → clôture Japon, 22h UTC → clôture US
  return h >= 20 ? 'US_CLOSE' : 'JP_CLOSE';
}

async function fetchPrices(tickers) {
  const symbols = tickers.join(',');
  const url = `https://api.twelvedata.com/quote?symbol=${symbols}&apikey=${TWELVEDATA_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return {};
  const data = await res.json();
  // Si un seul ticker, Twelve Data retourne l'objet directement
  if (tickers.length === 1) {
    return { [tickers[0]]: data };
  }
  return data;
}

async function fetchSparkline(ticker) {
  // 30 jours de données daily pour sparkline
  const url = `https://api.twelvedata.com/time_series?symbol=${ticker}&interval=1day&outputsize=30&apikey=${TWELVEDATA_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.values) return null;
  // Retourne juste les closing prices en ordre chronologique
  return data.values
    .map(v => parseFloat(v.close))
    .reverse()
    .join(',');
}

export async function GET(request) {
  // Vérification sécurité basique
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Charger tous les tickers depuis Supabase
    const { data: portfolio, error } = await supabase
      .from('portfolio_tickers')
      .select('ticker');

    if (error) throw new Error(error.message);

    const tickers = portfolio.map(t => t.ticker);
    const session = getSession();
    const snapshots = [];

    // 2. Fetch prix par chunks de 8
    for (let i = 0; i < tickers.length; i += CHUNK_SIZE) {
      const chunk = tickers.slice(i, i + CHUNK_SIZE);
      const prices = await fetchPrices(chunk);

      for (const ticker of chunk) {
        const q = prices[ticker];
        if (!q || q.status === 'error') continue;

        snapshots.push({
          ticker,
          price:      parseFloat(q.close) || null,
          change_1d:  parseFloat(q.percent_change) || null,
          change_1w:  null, // calculé séparément si besoin
          change_1m:  null,
          change_1y:  null,
          sparkline_1m: null,
          session,
        });
      }

      // Pause entre chunks pour respecter rate limit
      if (i + CHUNK_SIZE < tickers.length) await sleep(500);
    }

    // 3. Fetch sparklines (on fait ça ticker par ticker, moins critique)
    // On ne fait que les 50 premiers pour économiser les requêtes
    const TOP = Math.min(50, snapshots.length);
    for (let i = 0; i < TOP; i++) {
      const sparkline = await fetchSparkline(snapshots[i].ticker);
      snapshots[i].sparkline_1m = sparkline;
      await sleep(200);
    }

    // 4. Insérer dans Supabase
    const { error: insertError } = await supabase
      .from('portfolio_snapshots')
      .insert(snapshots);

    if (insertError) throw new Error(insertError.message);

    return Response.json({
      success: true,
      session,
      count: snapshots.length,
      time: new Date().toISOString(),
    });

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
