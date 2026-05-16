// app/api/morning-edge/route.js
// Route API Next.js — Morning Edge Engine
// Corrélations lead-lag calculées dynamiquement sur 252 sessions
// Cache serveur 4h (revalidate ISR)

import { NextResponse } from "next/server";

export const revalidate = 14400; // 4h

// ─────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────

const LEADERS = [
  { symbol: "ASML",    name: "ASML",         region: "EU", sector: "semis"     },
  { symbol: "TSM",     name: "TSMC",          region: "AS", sector: "semis"     },
  { symbol: "SOXX",    name: "SOX ETF",       region: "US", sector: "semis"     },
  { symbol: "SAP",     name: "SAP",           region: "EU", sector: "tech"      },
  { symbol: "6758.T",  name: "Sony",          region: "AS", sector: "tech"      },
  { symbol: "EWG",     name: "DAX ETF",       region: "EU", sector: "macro_eu"  },
  { symbol: "EWJ",     name: "Nikkei ETF",    region: "AS", sector: "macro_as"  },
  { symbol: "FXI",     name: "CSI300 ETF",    region: "AS", sector: "macro_cn"  },
  { symbol: "MC.PA",   name: "LVMH",          region: "EU", sector: "luxe"      },
  { symbol: "AIR.PA",  name: "Airbus",        region: "EU", sector: "industrie" },
  { symbol: "SIE.DE",  name: "Siemens",       region: "EU", sector: "industrie" },
  { symbol: "GLD",     name: "Or",            region: "CM", sector: "or"        },
  { symbol: "USO",     name: "Pétrole WTI",   region: "CM", sector: "energie"   },
  { symbol: "CPER",    name: "Cuivre",        region: "CM", sector: "metaux"    },
  { symbol: "UNG",     name: "Gaz naturel",   region: "CM", sector: "energie"   },
];

const US_CLUSTERS = [
  {
    id: "semis",
    label: "Semi-conducteurs",
    emoji: "⚡",
    proxy: "SOXX",
    tickers: ["NVDA", "AMD", "AVGO", "QCOM", "MU", "INTC", "AMAT"],
    leaderSectors: ["semis", "macro_as", "macro_eu"],
  },
  {
    id: "tech",
    label: "Tech large cap",
    emoji: "🖥",
    proxy: "QQQ",
    tickers: ["AAPL", "MSFT", "GOOGL", "META", "AMZN"],
    leaderSectors: ["tech", "semis", "macro_eu", "macro_as"],
  },
  {
    id: "energie",
    label: "Énergie",
    emoji: "🛢",
    proxy: "XLE",
    tickers: ["XOM", "CVX", "COP", "SLB", "EOG"],
    leaderSectors: ["energie", "macro_eu"],
  },
  {
    id: "or",
    label: "Or & Métaux précieux",
    emoji: "🥇",
    proxy: "GLD",
    tickers: ["GLD", "GDX", "NEM", "AEM", "FNV", "WPM"],
    leaderSectors: ["or", "metaux"],
  },
  {
    id: "luxe",
    label: "Conso. discrétionnaire",
    emoji: "💎",
    proxy: "XLY",
    tickers: ["AMZN", "TSLA", "HD", "NKE", "RL"],
    leaderSectors: ["luxe", "macro_eu", "macro_cn"],
  },
  {
    id: "industrie",
    label: "Industrie & Défense",
    emoji: "🏭",
    proxy: "XLI",
    tickers: ["HON", "GE", "RTX", "LMT", "CAT", "DE"],
    leaderSectors: ["industrie", "macro_eu"],
  },
];

// ─────────────────────────────────────────────────────────────────
// TWELVE DATA — Historique OHLC (avec cache ISR)
// ─────────────────────────────────────────────────────────────────

async function fetchDailyReturns(symbol, outputsize = 260) {
  const apiKey = process.env.TWELVEDATA_KEY;
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&outputsize=${outputsize}&apikey=${apiKey}`;

  try {
    const res = await fetch(url, { next: { revalidate: 14400 } });
    const data = await res.json();
    if (!data.values || data.status === "error") return null;

    const values = [...data.values].reverse(); // chronologique
    const returns = [];
    for (let i = 1; i < values.length; i++) {
      const prev = parseFloat(values[i - 1].close);
      const curr = parseFloat(values[i].close);
      if (prev > 0) returns.push((curr - prev) / prev);
    }
    return returns;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// TWELVE DATA — Quotes temps réel (no-cache)
// ─────────────────────────────────────────────────────────────────

async function fetchQuotes(symbols) {
  const apiKey = process.env.TWELVEDATA_KEY;
  const joined = symbols.map(encodeURIComponent).join(",");
  const url = `https://api.twelvedata.com/quote?symbol=${joined}&apikey=${apiKey}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    return await res.json();
  } catch {
    return {};
  }
}

// ─────────────────────────────────────────────────────────────────
// MATH — Corrélation de Pearson
// ─────────────────────────────────────────────────────────────────

function pearson(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 30) return { corr: 0, n };

  const xs = x.slice(0, n);
  const ys = y.slice(0, n);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;

  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }

  const corr = num / Math.sqrt(dx2 * dy2);
  return { corr: isNaN(corr) ? 0 : corr, n };
}

// ─────────────────────────────────────────────────────────────────
// MATH — Corrélation lead-lag (leader[J] → follower[J+1])
// ─────────────────────────────────────────────────────────────────

function leadLag(leaderReturns, followerReturns) {
  const leaderLagged   = leaderReturns.slice(0, -1);
  const followerShifted = followerReturns.slice(1);
  return pearson(leaderLagged, followerShifted);
}

// ─────────────────────────────────────────────────────────────────
// MATH — Hit rate conditionnel et moyenne conditionnelle
// ─────────────────────────────────────────────────────────────────

function conditionalStats(leaderReturns, followerReturns, threshold = 0.003) {
  const n = Math.min(leaderReturns.length - 1, followerReturns.length - 1);
  const hits = [];
  const bullFollows = [];
  const bearFollows = [];

  for (let i = 0; i < n; i++) {
    if (Math.abs(leaderReturns[i]) < threshold) continue;
    const sameDir = Math.sign(leaderReturns[i]) === Math.sign(followerReturns[i + 1]);
    hits.push(sameDir ? 1 : 0);
    if (leaderReturns[i] > threshold) bullFollows.push(followerReturns[i + 1]);
    if (leaderReturns[i] < -threshold) bearFollows.push(followerReturns[i + 1]);
  }

  const hitRate = hits.length > 0 ? hits.reduce((a, b) => a + b, 0) / hits.length : 0.5;
  const avgBull = bullFollows.length > 3 ? bullFollows.reduce((a, b) => a + b, 0) / bullFollows.length : null;
  const avgBear = bearFollows.length > 3 ? bearFollows.reduce((a, b) => a + b, 0) / bearFollows.length : null;

  return { hitRate, avgBull, avgBear, nCond: hits.length };
}

// ─────────────────────────────────────────────────────────────────
// MOTEUR — Score Bayésien par cluster
// ─────────────────────────────────────────────────────────────────

function scoreCluster(cluster, leaderData, corrMatrix) {
  const BASE_RATE = 0.52;
  let logOdds = Math.log(BASE_RATE / (1 - BASE_RATE));

  const activeSignals = [];

  for (const leader of leaderData) {
    if (!cluster.leaderSectors.includes(leader.sector)) continue;
    if (leader.changePct === null || Math.abs(leader.changePct) < 0.003) continue;

    const key = `${leader.symbol}__${cluster.id}`;
    const c = corrMatrix[key];
    if (!c || Math.abs(c.corr) < 0.25 || c.n < 30) continue;

    const direction  = leader.changePct > 0 ? 1 : -1;
    const magnitude  = Math.min(Math.abs(leader.changePct) / 0.02, 3); // cap à 3x pour +2%
    const edge       = c.corr * direction * magnitude * 0.28;
    logOdds += edge;

    const absCorr = Math.abs(c.corr);
    const quality = absCorr >= 0.65 ? "fort" : absCorr >= 0.45 ? "modéré" : "faible";

    activeSignals.push({
      leader:    leader.name,
      symbol:    leader.symbol,
      region:    leader.region,
      changePct: leader.changePct,
      corr:      c.corr,
      hitRate:   c.hitRate,
      avgBull:   c.avgBull,
      avgBear:   c.avgBear,
      n:         c.n,
      quality,
      contribution: edge,
    });
  }

  const probability = 1 / (1 + Math.exp(-logOdds));
  const avgCorr = activeSignals.length > 0
    ? activeSignals.reduce((a, s) => a + Math.abs(s.corr), 0) / activeSignals.length
    : 0;
  const confidence = Math.min(Math.round((activeSignals.length / 3) * avgCorr * 3), 3);

  const direction =
    probability >= 0.60 ? "haussier"
    : probability <= 0.42 ? "baissier"
    : "neutre";

  return {
    clusterId:   cluster.id,
    label:       cluster.label,
    emoji:       cluster.emoji,
    tickers:     cluster.tickers,
    probability,
    direction,
    confidence,
    signalCount: activeSignals.length,
    signals: activeSignals.sort((a, b) => Math.abs(b.corr) - Math.abs(a.corr)),
  };
}

// ─────────────────────────────────────────────────────────────────
// ROUTE HANDLER
// ─────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    // 1. Fetch historiques leaders (cache 4h)
    const leaderHistorical = {};
    await Promise.all(
      LEADERS.map(async ({ symbol }) => {
        const r = await fetchDailyReturns(symbol, 260);
        if (r && r.length >= 30) leaderHistorical[symbol] = r;
      })
    );

    // 2. Fetch historiques proxies sectoriels US (cache 4h)
    const clusterHistorical = {};
    await Promise.all(
      US_CLUSTERS.map(async ({ id, proxy }) => {
        const r = await fetchDailyReturns(proxy, 260);
        if (r && r.length >= 30) clusterHistorical[id] = r;
      })
    );

    // 3. Matrice de corrélations lead-lag
    const corrMatrix = {};
    for (const leader of LEADERS) {
      const lr = leaderHistorical[leader.symbol];
      if (!lr) continue;
      for (const cluster of US_CLUSTERS) {
        const fr = clusterHistorical[cluster.id];
        if (!fr) continue;
        const { corr, n } = leadLag(lr, fr);
        const { hitRate, avgBull, avgBear, nCond } = conditionalStats(lr, fr);
        corrMatrix[`${leader.symbol}__${cluster.id}`] = { corr, n, hitRate, avgBull, avgBear, nCond };
      }
    }

    // 4. Quotes temps réel
    const symbols = LEADERS.map((l) => l.symbol);
    const quotes  = await fetchQuotes(symbols);

    const leaderData = LEADERS.map((leader) => {
      const q = quotes[leader.symbol] || (symbols.length === 1 ? quotes : null);
      const changePct = q?.percent_change ? parseFloat(q.percent_change) / 100 : null;
      return {
        ...leader,
        changePct,
        price: q?.close ? parseFloat(q.close) : null,
        available: changePct !== null,
      };
    });

    // 5. Scores clusters
    const available = leaderData.filter((l) => l.available);
    const clusters  = US_CLUSTERS
      .map((c) => scoreCluster(c, available, corrMatrix))
      .sort((a, b) => Math.abs(b.probability - 0.5) - Math.abs(a.probability - 0.5));

    return NextResponse.json({
      success:     true,
      computedAt:  new Date().toISOString(),
      leaders:     leaderData,
      clusters,
      meta: {
        lookbackDays:     252,
        leadersAvailable: available.length,
        totalLeaders:     LEADERS.length,
        corrPairsComputed: Object.keys(corrMatrix).length,
      },
    });

  } catch (error) {
    console.error("[Morning Edge] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
