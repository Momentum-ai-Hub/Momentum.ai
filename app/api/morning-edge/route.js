// app/api/morning-edge/route.js
// Route API Next.js — Morning Edge Engine v2
// Clusters indexés par liste.id de MomentumModule (source de vérité)
// Corrélations Pearson lead-lag 252 sessions · Propagation causale · Cache 4h

import { NextResponse } from "next/server";

export const revalidate = 14400; // 4h

// ─────────────────────────────────────────────────────────────────
// LEADERS OVERNIGHT — inputs du scanner
// sector doit correspondre aux leaderSectors de chaque cluster
// ─────────────────────────────────────────────────────────────────

const LEADERS = [
  { symbol: "ASML",      name: "ASML",          region: "EU", sector: "semis"       },
  { symbol: "SAP",       name: "SAP",            region: "EU", sector: "tech"        },
  { symbol: "MC.PA",     name: "LVMH",           region: "EU", sector: "luxe"        },
  { symbol: "SIE.DE",    name: "Siemens",        region: "EU", sector: "industrie"   },
  { symbol: "RWE.DE",    name: "RWE",            region: "EU", sector: "renouvelable"},
  { symbol: "TTE.PA",    name: "TotalEnergies",  region: "EU", sector: "petrole"     },
  { symbol: "AIR.PA",    name: "Airbus",         region: "EU", sector: "defense"     },
  { symbol: "RHM.DE",    name: "Rheinmetall",    region: "EU", sector: "defense"     },
  { symbol: "TSM",       name: "TSMC",           region: "AS", sector: "semis"       },
  { symbol: "005930.KS", name: "Samsung",        region: "AS", sector: "semis"       },
  { symbol: "6758.T",    name: "Sony",           region: "AS", sector: "tech"        },
  { symbol: "7203.T",    name: "Toyota",         region: "AS", sector: "industrie"   },
  { symbol: "BABA",      name: "Alibaba",        region: "AS", sector: "tech"        },
  { symbol: "GLD",       name: "Or (GLD)",       region: "CM", sector: "or"          },
  { symbol: "USO",       name: "Pétrole WTI",    region: "CM", sector: "petrole"     },
  { symbol: "CPER",      name: "Cuivre",         region: "CM", sector: "metaux"      },
  { symbol: "GBTC",      name: "Bitcoin",        region: "CM", sector: "crypto"      },
];

// ─────────────────────────────────────────────────────────────────
// CLUSTERS — ids identiques aux liste.id de MomentumModule/COUCHES
// leaderSectors = secteurs des leaders overnight qui alimentent ce cluster
// causalFrom = [liste.id, ...] depuis LIENS_CAUSAUX de MomentumModule
// proxy = ETF pour les corrélations historiques Twelve Data
// ─────────────────────────────────────────────────────────────────

const CLUSTERS = [
  // C0
  {
    id: "rebond-iran",
    coucheId: "C0",
    leaderSectors: ["defense", "industrie", "petrole"],
    causalFrom: [],
    proxy: "ITA",
  },
  // C1
  {
    id: "mp-or",
    coucheId: "C1",
    leaderSectors: ["or", "metaux"],
    causalFrom: [],
    proxy: "GLD",
  },
  {
    id: "mp-lithium",
    coucheId: "C1",
    leaderSectors: ["metaux", "semis"],
    causalFrom: [],
    proxy: "LIT",
  },
  {
    id: "mp-terres-rares",
    coucheId: "C1",
    leaderSectors: ["metaux", "industrie"],
    causalFrom: [],
    proxy: "REMX",
  },
  {
    id: "mp-mines",
    coucheId: "C1",
    leaderSectors: ["metaux", "petrole"],
    causalFrom: [],
    proxy: "XME",
  },
  {
    id: "nrj-petrole",
    coucheId: "C1",
    leaderSectors: ["petrole"],
    causalFrom: [],
    proxy: "XLE",
  },
  // C2
  {
    id: "nrj-nucleaire",
    coucheId: "C2",
    leaderSectors: ["renouvelable", "industrie"],
    causalFrom: ["mp-lithium"],
    proxy: "URA",
  },
  {
    id: "nrj-renouvelable",
    coucheId: "C2",
    leaderSectors: ["renouvelable", "metaux"],
    causalFrom: ["mp-terres-rares"],
    proxy: "ICLN",
  },
  {
    id: "nrj-chimie",
    coucheId: "C2",
    leaderSectors: ["petrole", "metaux"],
    causalFrom: ["nrj-petrole"],
    proxy: "XLB",
  },
  {
    id: "ia-energie",
    coucheId: "C2",
    leaderSectors: ["semis", "renouvelable", "industrie", "tech"],
    causalFrom: ["mp-terres-rares", "mp-lithium"],
    proxy: "XLE",
  },
  // C2.5
  {
    id: "infra-construction",
    coucheId: "C2.5",
    leaderSectors: ["industrie", "renouvelable"],
    causalFrom: ["nrj-nucleaire", "nrj-renouvelable"],
    proxy: "XLI",
  },
  {
    id: "ia-infra-hardware",
    coucheId: "C2.5",
    leaderSectors: ["semis", "tech"],
    causalFrom: ["ia-energie"],
    proxy: "IGV",
  },
  {
    id: "ia-infra-cloud",
    coucheId: "C2.5",
    leaderSectors: ["tech", "semis"],
    causalFrom: ["ia-energie"],
    proxy: "QQQ",
  },
  {
    id: "ia-telecom-optique",
    coucheId: "C2.5",
    leaderSectors: ["semis", "tech"],
    causalFrom: ["ia-energie"],
    proxy: "IYZ",
  },
  // C3
  {
    id: "semi-equipement",
    coucheId: "C3",
    leaderSectors: ["semis"],
    causalFrom: ["ia-infra-hardware"],
    proxy: "SOXX",
  },
  {
    id: "semi-design",
    coucheId: "C3",
    leaderSectors: ["semis", "tech"],
    causalFrom: ["semi-equipement"],
    proxy: "SOXX",
  },
  {
    id: "semi-fabrication",
    coucheId: "C3",
    leaderSectors: ["semis"],
    causalFrom: ["ia-infra-cloud", "semi-design"],
    proxy: "SOXX",
  },
  {
    id: "ia-memoire",
    coucheId: "C3",
    leaderSectors: ["semis", "tech"],
    causalFrom: ["semi-fabrication"],
    proxy: "SMH",
  },
  {
    id: "ia-photonique",
    coucheId: "C3",
    leaderSectors: ["semis"],
    causalFrom: ["ia-memoire"],
    proxy: "SMH",
  },
  {
    id: "ia-semi-general",
    coucheId: "C3",
    leaderSectors: ["semis", "tech"],
    causalFrom: ["ia-photonique"],
    proxy: "SMH",
  },
  {
    id: "ia-software-quantique",
    coucheId: "C3",
    leaderSectors: ["tech", "semis"],
    causalFrom: ["ia-semi-general"],
    proxy: "IGV",
  },
  {
    id: "ia-robotique",
    coucheId: "C3",
    leaderSectors: ["semis", "industrie"],
    causalFrom: ["ia-software-quantique"],
    proxy: "BOTZ",
  },
  {
    id: "spacex",
    coucheId: "C3",
    leaderSectors: ["defense", "tech"],
    causalFrom: ["defense"],
    proxy: "UFO",
  },
  {
    id: "defense",
    coucheId: "C3",
    leaderSectors: ["defense", "industrie"],
    causalFrom: ["infra-construction", "rebond-iran"],
    proxy: "ITA",
  },
  // C4
  {
    id: "luxe",
    coucheId: "C4",
    leaderSectors: ["luxe", "tech"],
    causalFrom: [],
    proxy: "XLY",
  },
  {
    id: "finance-crypto",
    coucheId: "C4",
    leaderSectors: ["crypto", "tech"],
    causalFrom: [],
    proxy: "GBTC",
  },
  {
    id: "finance-fintech",
    coucheId: "C4",
    leaderSectors: ["tech", "luxe"],
    causalFrom: ["ia-robotique"],
    proxy: "XLF",
  },
  {
    id: "biotech",
    coucheId: "C4",
    leaderSectors: ["tech"],
    causalFrom: [],
    proxy: "XBI",
  },
  {
    id: "healthcare",
    coucheId: "C4",
    leaderSectors: ["industrie"],
    causalFrom: [],
    proxy: "XLV",
  },
  {
    id: "japon",
    coucheId: "C4",
    leaderSectors: ["semis", "industrie"],
    causalFrom: [],
    proxy: "EWJ",
  },
  {
    id: "13f-aschenbenner",
    coucheId: "C4",
    leaderSectors: ["semis", "tech", "crypto"],
    causalFrom: ["ia-semi-general"],
    proxy: "SMH",
  },
];

// ─────────────────────────────────────────────────────────────────
// ORDRE DE SCORING — C0 en premier pour que la propagation causale
// soit disponible quand on score les couches suivantes
// ─────────────────────────────────────────────────────────────────

const LAYER_ORDER = ["C0", "C1", "C2", "C2.5", "C3", "C4"];

// ─────────────────────────────────────────────────────────────────
// TWELVE DATA — Historique daily returns (cache 4h)
// ─────────────────────────────────────────────────────────────────

async function fetchDailyReturns(symbol, outputsize) {
  var size   = outputsize || 260;
  var apiKey = process.env.TWELVEDATA_KEY;
  var url    =
    "https://api.twelvedata.com/time_series?symbol=" +
    encodeURIComponent(symbol) +
    "&interval=1day&outputsize=" +
    size +
    "&apikey=" +
    apiKey;

  try {
    var res  = await fetch(url, { next: { revalidate: 14400 } });
    var data = await res.json();
    if (!data.values || data.status === "error") return null;

    var values  = [...data.values].reverse();
    var returns = [];
    for (var i = 1; i < values.length; i++) {
      var prev = parseFloat(values[i - 1].close);
      var curr = parseFloat(values[i].close);
      if (prev > 0) returns.push((curr - prev) / prev);
    }
    return returns;
  } catch (e) {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// TWELVE DATA — Quotes temps réel (no-cache)
// ─────────────────────────────────────────────────────────────────

async function fetchQuotes(symbols) {
  var apiKey = process.env.TWELVEDATA_KEY;
  var joined = symbols.map(encodeURIComponent).join(",");
  var url    = "https://api.twelvedata.com/quote?symbol=" + joined + "&apikey=" + apiKey;

  try {
    var res = await fetch(url, { cache: "no-store" });
    return await res.json();
  } catch (e) {
    return {};
  }
}

// ─────────────────────────────────────────────────────────────────
// MATH — Pearson
// ─────────────────────────────────────────────────────────────────

function pearson(x, y) {
  var n = Math.min(x.length, y.length);
  if (n < 30) return { corr: 0, n: n };

  var xs = x.slice(0, n);
  var ys = y.slice(0, n);
  var mx = xs.reduce(function(a, b) { return a + b; }, 0) / n;
  var my = ys.reduce(function(a, b) { return a + b; }, 0) / n;

  var num = 0, dx2 = 0, dy2 = 0;
  for (var i = 0; i < n; i++) {
    var dx = xs[i] - mx;
    var dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }

  var corr = num / Math.sqrt(dx2 * dy2);
  return { corr: isNaN(corr) ? 0 : corr, n: n };
}

// ─────────────────────────────────────────────────────────────────
// MATH — Lead-lag (leader[J] → follower[J+1])
// ─────────────────────────────────────────────────────────────────

function leadLag(leaderReturns, followerReturns) {
  var leaderLagged    = leaderReturns.slice(0, -1);
  var followerShifted = followerReturns.slice(1);
  return pearson(leaderLagged, followerShifted);
}

// ─────────────────────────────────────────────────────────────────
// MATH — Hit rate conditionnel
// ─────────────────────────────────────────────────────────────────

function conditionalStats(leaderReturns, followerReturns, threshold) {
  var thr  = threshold || 0.003;
  var n    = Math.min(leaderReturns.length - 1, followerReturns.length - 1);
  var hits = [];
  var bullFollows = [];
  var bearFollows = [];

  for (var i = 0; i < n; i++) {
    if (Math.abs(leaderReturns[i]) < thr) continue;
    var sameDir = Math.sign(leaderReturns[i]) === Math.sign(followerReturns[i + 1]);
    hits.push(sameDir ? 1 : 0);
    if (leaderReturns[i] > thr)  bullFollows.push(followerReturns[i + 1]);
    if (leaderReturns[i] < -thr) bearFollows.push(followerReturns[i + 1]);
  }

  var hitRate = hits.length > 0
    ? hits.reduce(function(a, b) { return a + b; }, 0) / hits.length
    : 0.5;
  var avgBull = bullFollows.length > 3
    ? bullFollows.reduce(function(a, b) { return a + b; }, 0) / bullFollows.length
    : null;
  var avgBear = bearFollows.length > 3
    ? bearFollows.reduce(function(a, b) { return a + b; }, 0) / bearFollows.length
    : null;

  return { hitRate: hitRate, avgBull: avgBull, avgBear: avgBear, nCond: hits.length };
}

// ─────────────────────────────────────────────────────────────────
// MOTEUR — Score Bayésien par cluster
// clusterScores = résultats déjà calculés pour les couches précédentes
// ─────────────────────────────────────────────────────────────────

function scoreCluster(cluster, leaderData, corrMatrix, clusterScores) {
  var BASE_RATE = 0.52;
  var logOdds   = Math.log(BASE_RATE / (1 - BASE_RATE));

  var activeSignals = [];

  // 1. Signaux directs depuis les leaders overnight
  for (var i = 0; i < leaderData.length; i++) {
    var leader = leaderData[i];
    if (cluster.leaderSectors.indexOf(leader.sector) === -1) continue;
    if (leader.changePct === null || Math.abs(leader.changePct) < 0.003) continue;

    var key = leader.symbol + "__" + cluster.id;
    var c   = corrMatrix[key];
    if (!c || Math.abs(c.corr) < 0.20 || c.n < 30) continue;

    var direction  = leader.changePct > 0 ? 1 : -1;
    var magnitude  = Math.min(Math.abs(leader.changePct) / 0.01, 3);
    var edge       = c.corr * direction * magnitude * 0.28;
    logOdds += edge;

    var absCorr = Math.abs(c.corr);
    var quality = absCorr >= 0.65 ? "fort" : absCorr >= 0.45 ? "modéré" : "faible";

    activeSignals.push({
      leader:       leader.name,
      symbol:       leader.symbol,
      region:       leader.region,
      changePct:    leader.changePct,
      corr:         c.corr,
      hitRate:      c.hitRate,
      avgBull:      c.avgBull,
      avgBear:      c.avgBear,
      n:            c.n,
      quality:      quality,
      contribution: edge,
      source:       "direct",
    });
  }

  // 2. Propagation causale depuis les clusters parents déjà scorés
  for (var j = 0; j < cluster.causalFrom.length; j++) {
    var parentId = cluster.causalFrom[j];
    var parent   = clusterScores[parentId];
    if (!parent) continue;

    var parentLogOdds = Math.log(parent.probability / (1 - parent.probability));
    var attenuated    = parentLogOdds * 0.4; // atténuation 40%
    logOdds += attenuated;

    if (Math.abs(parent.probability - 0.5) > 0.08) {
      activeSignals.push({
        leader:       parent.label || parentId,
        symbol:       parentId,
        region:       parent.coucheId || "causal",
        changePct:    parent.probability - 0.5,
        corr:         0.4,
        hitRate:      null,
        quality:      "modéré",
        contribution: attenuated,
        source:       "causal",
      });
    }
  }

  var probability = 1 / (1 + Math.exp(-logOdds));

  var totalCorr = 0;
  for (var k = 0; k < activeSignals.length; k++) {
    totalCorr += Math.abs(activeSignals[k].corr);
  }
  var avgCorr    = activeSignals.length > 0 ? totalCorr / activeSignals.length : 0;
  var confidence = Math.min(Math.round((activeSignals.length / 3) * avgCorr * 3), 3);

  var direction =
    probability >= 0.60 ? "haussier"
    : probability <= 0.42 ? "baissier"
    : "neutre";

  activeSignals.sort(function(a, b) { return Math.abs(b.corr) - Math.abs(a.corr); });

  return {
    clusterId:   cluster.id,
    coucheId:    cluster.coucheId,
    causalFrom:  cluster.causalFrom,
    probability: probability,
    direction:   direction,
    confidence:  confidence,
    signalCount: activeSignals.length,
    signals:     activeSignals,
  };
}

// ─────────────────────────────────────────────────────────────────
// ROUTE HANDLER
// ─────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    // 1. Fetch historiques leaders (cache 4h)
    var leaderHistorical = {};
    await Promise.all(
      LEADERS.map(async function(leader) {
        var r = await fetchDailyReturns(leader.symbol, 260);
        if (r && r.length >= 30) leaderHistorical[leader.symbol] = r;
      })
    );

    // 2. Fetch historiques proxies clusters (dédupliqués, cache 4h)
    var proxySymbols = [];
    CLUSTERS.forEach(function(c) {
      if (proxySymbols.indexOf(c.proxy) === -1) proxySymbols.push(c.proxy);
    });

    var proxyHistorical = {};
    await Promise.all(
      proxySymbols.map(async function(sym) {
        var r = await fetchDailyReturns(sym, 260);
        if (r && r.length >= 30) proxyHistorical[sym] = r;
      })
    );

    // 3. Matrice de corrélations lead-lag
    var corrMatrix = {};
    for (var li = 0; li < LEADERS.length; li++) {
      var leader = LEADERS[li];
      var lr     = leaderHistorical[leader.symbol];
      if (!lr) continue;
      for (var ci = 0; ci < CLUSTERS.length; ci++) {
        var cluster = CLUSTERS[ci];
        var fr      = proxyHistorical[cluster.proxy];
        if (!fr) continue;
        var ll    = leadLag(lr, fr);
        var stats = conditionalStats(lr, fr);
        corrMatrix[leader.symbol + "__" + cluster.id] = {
          corr:    ll.corr,
          n:       ll.n,
          hitRate: stats.hitRate,
          avgBull: stats.avgBull,
          avgBear: stats.avgBear,
          nCond:   stats.nCond,
        };
      }
    }

    // 4. Quotes temps réel leaders
    var leaderSymbols = LEADERS.map(function(l) { return l.symbol; });
    var quotes        = await fetchQuotes(leaderSymbols);

    var leaderData = LEADERS.map(function(leader) {
      var q         = quotes[leader.symbol] || (leaderSymbols.length === 1 ? quotes : null);
      var changePct = q && q.percent_change ? parseFloat(q.percent_change) / 100 : null;
      return Object.assign({}, leader, {
        changePct: changePct,
        price:     q && q.close ? parseFloat(q.close) : null,
        available: changePct !== null,
      });
    });

    var available = leaderData.filter(function(l) { return l.available; });

    // 5. Score clusters dans l'ordre causal C0→C4
    // Les parents sont dans clusterScores avant que les enfants soient scorés
    var clusterScores = {};

    for (var layerIdx = 0; layerIdx < LAYER_ORDER.length; layerIdx++) {
      var layerId         = LAYER_ORDER[layerIdx];
      var layerClusters   = CLUSTERS.filter(function(c) { return c.coucheId === layerId; });

      for (var sci = 0; sci < layerClusters.length; sci++) {
        var scored = scoreCluster(layerClusters[sci], available, corrMatrix, clusterScores);
        clusterScores[layerClusters[sci].id] = scored;
      }
    }

    var clusters = Object.values(clusterScores);

    return NextResponse.json({
      success:    true,
      computedAt: new Date().toISOString(),
      leaders:    leaderData,
      clusters:   clusters,
      meta: {
        lookbackDays:      252,
        leadersAvailable:  available.length,
        totalLeaders:      LEADERS.length,
        totalClusters:     clusters.length,
        corrPairsComputed: Object.keys(corrMatrix).length,
        layerOrder:        LAYER_ORDER,
        note:              "clusterId = liste.id de MomentumModule/COUCHES",
      },
    });

  } catch (error) {
    console.error("[Morning Edge v2] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
