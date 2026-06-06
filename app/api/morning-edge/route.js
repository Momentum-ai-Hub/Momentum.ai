// app/api/morning-edge/route.js
// Route API Next.js — Morning Edge Engine v2
// Map causale complète C0→C4 · Corrélations Pearson lead-lag 252j
// Propagation causale des signaux · Cache serveur 4h

import { NextResponse } from "next/server";

export const revalidate = 14400; // 4h

// ─────────────────────────────────────────────────────────────────
// LEADERS OVERNIGHT — inputs du scanner
// ─────────────────────────────────────────────────────────────────

const LEADERS = [
  { symbol: "ASML",   name: "ASML",       region: "EU", sector: "semis"      },
  { symbol: "SAP",    name: "SAP",         region: "EU", sector: "tech"       },
  { symbol: "MC.PA",  name: "LVMH",        region: "EU", sector: "luxe"       },
  { symbol: "SIE.DE", name: "Siemens",     region: "EU", sector: "industrie"  },
  { symbol: "RWE.DE", name: "RWE",         region: "EU", sector: "renouvelable"},
  { symbol: "TTE.PA", name: "TotalEnergies",region:"EU", sector: "petrole"    },
  { symbol: "AIR.PA", name: "Airbus",      region: "EU", sector: "defense"    },
  { symbol: "RHM.DE", name: "Rheinmetall", region: "EU", sector: "defense"    },
  { symbol: "TSM",    name: "TSMC",        region: "AS", sector: "semis"      },
  { symbol: "005930.KS", name: "Samsung",  region: "AS", sector: "semis"      },
  { symbol: "6758.T", name: "Sony",        region: "AS", sector: "tech"       },
  { symbol: "7203.T", name: "Toyota",      region: "AS", sector: "industrie"  },
  { symbol: "BABA",   name: "Alibaba",     region: "AS", sector: "tech"       },
  { symbol: "GLD",    name: "Or (GLD)",    region: "CM", sector: "or"         },
  { symbol: "USO",    name: "Pétrole WTI", region: "CM", sector: "petrole"    },
  { symbol: "CPER",   name: "Cuivre",      region: "CM", sector: "metaux"     },
  { symbol: "GBTC",   name: "Bitcoin",     region: "CM", sector: "crypto"     },
];

// ─────────────────────────────────────────────────────────────────
// MAP CAUSALE COMPLÈTE C0→C4
// Chaque cluster a : id, label, layer, leaderSectors, tickers, causalFrom[]
// ─────────────────────────────────────────────────────────────────

const CLUSTERS = [
  // ── C0 GÉOPOLITIQUE ──────────────────────────────────────────
  {
    id: "geopolitique",
    label: "Rebond Post-Guerre",
    layer: "C0",
    emoji: "🌍",
    leaderSectors: ["defense", "industrie", "petrole"],
    tickers: ["AIR", "RMS", "RTX", "LMT", "BA", "HO", "AVAV", "RHM", "NOC", "GD"],
    causalFrom: [],
  },

  // ── C1 TERRE ─────────────────────────────────────────────────
  {
    id: "mp_or",
    label: "MP Or // Précieux",
    layer: "C1",
    emoji: "🥇",
    leaderSectors: ["or", "metaux"],
    tickers: ["FNV", "GOLD", "GDX", "AEM", "WPM", "NEM"],
    causalFrom: [],
  },
  {
    id: "mp_lithium",
    label: "MP Lithium // Batteries",
    layer: "C1",
    emoji: "⚡",
    leaderSectors: ["metaux", "semis"],
    tickers: ["LAC", "ALB", "SQM", "SGML", "LIT"],
    causalFrom: [],
  },
  {
    id: "mp_terres_rares",
    label: "MP Terres Rares",
    layer: "C1",
    emoji: "🧲",
    leaderSectors: ["metaux", "industrie"],
    tickers: ["MP", "USAR", "LYC", "CRML"],
    causalFrom: [],
  },
  {
    id: "mp_mines",
    label: "MP Mines // Métaux Base",
    layer: "C1",
    emoji: "⛏",
    leaderSectors: ["metaux", "petrole"],
    tickers: ["FCX", "RIO", "BHP", "GLEN", "CLF"],
    causalFrom: [],
  },
  {
    id: "nrj_petrole",
    label: "NRJ Pétrole // Gaz",
    layer: "C1",
    emoji: "🛢",
    leaderSectors: ["petrole"],
    tickers: ["TTE", "EQNR", "ENI", "SLB", "HAL", "BKR"],
    causalFrom: [],
  },

  // ── C2 ÉNERGIE ───────────────────────────────────────────────
  {
    id: "nrj_nucleaire",
    label: "NRJ Nucléaire",
    layer: "C2",
    emoji: "☢",
    leaderSectors: ["renouvelable", "industrie"],
    tickers: ["CCJ", "UUUU", "OKLO", "SMR", "NNE", "BWXT", "LEU", "NXE"],
    causalFrom: ["mp_lithium"],
  },
  {
    id: "nrj_renouvelable",
    label: "NRJ Renouvelable",
    layer: "C2",
    emoji: "🌿",
    leaderSectors: ["renouvelable", "metaux"],
    tickers: ["RWE", "GEV", "ETN", "ENPH", "SEDG", "BE", "PLUG", "FCEL"],
    causalFrom: ["mp_terres_rares"],
  },
  {
    id: "nrj_chimie",
    label: "NRJ Chimie // Matériaux",
    layer: "C2",
    emoji: "🧪",
    leaderSectors: ["petrole", "metaux"],
    tickers: ["LIN", "APD", "NTR", "ASY", "BAYN", "HWKN"],
    causalFrom: ["nrj_petrole"],
  },
  {
    id: "ia_energie",
    label: "IA x Energie",
    layer: "C2",
    emoji: "⚡",
    leaderSectors: ["semis", "renouvelable", "industrie", "tech"],
    tickers: ["VST", "CEG", "NRG", "VRT", "GEV", "ETN", "CCJ", "PWR", "KMI"],
    causalFrom: ["mp_terres_rares", "mp_lithium"],
    isIAChain: true,
  },

  // ── C2.5 INFRASTRUCTURE ──────────────────────────────────────
  {
    id: "infra_construction",
    label: "Infra x Construction",
    layer: "C2.5",
    emoji: "🏗",
    leaderSectors: ["industrie", "renouvelable"],
    tickers: ["SIE", "WM", "PWR", "FLR", "KBR", "IEX"],
    causalFrom: ["nrj_nucleaire", "nrj_renouvelable"],
  },
  {
    id: "ia_infra_hardware",
    label: "IA Infra x Hardware",
    layer: "C2.5",
    emoji: "🖥",
    leaderSectors: ["semis", "tech"],
    tickers: ["VRT", "SMCI", "HPE", "AVGO", "CSCO", "FFIV"],
    causalFrom: ["ia_energie"],
    isIAChain: true,
  },
  {
    id: "ia_infra_cloud",
    label: "IA Infra x Cloud",
    layer: "C2.5",
    emoji: "☁",
    leaderSectors: ["tech", "semis"],
    tickers: ["AMZN", "GOOGL", "MSFT", "ORCL", "NOW", "CRM", "DDOG"],
    causalFrom: ["ia_energie"],
    isIAChain: true,
  },
  {
    id: "ia_telecom_optique",
    label: "IA Telecom // Optique",
    layer: "C2.5",
    emoji: "📡",
    leaderSectors: ["semis", "tech"],
    tickers: ["COHR", "GLW", "LITE", "AAOI", "NOK", "AXTI"],
    causalFrom: ["ia_energie"],
    isIAChain: true,
  },

  // ── C3 FABRICATION ───────────────────────────────────────────
  {
    id: "defense",
    label: "Défense x Aérospatiale",
    layer: "C3",
    emoji: "🛡",
    leaderSectors: ["defense", "industrie"],
    tickers: ["RTX", "LMT", "NOC", "GD", "AXON", "BA", "AVAV", "KTOS"],
    causalFrom: ["infra_construction", "geopolitique"],
  },
  {
    id: "semi_equipement",
    label: "Semi C.Appro Équipement",
    layer: "C3",
    emoji: "🔬",
    leaderSectors: ["semis"],
    tickers: ["AMAT", "LRCX", "KLAC", "ASML", "AEHR", "ASM"],
    causalFrom: ["ia_infra_hardware"],
    isIAChain: true,
  },
  {
    id: "semi_design",
    label: "Semi C.Appro Design",
    layer: "C3",
    emoji: "📐",
    leaderSectors: ["semis", "tech"],
    tickers: ["SNPS", "CDNS", "ARM", "MRVL", "ALAB", "RMBS"],
    causalFrom: ["semi_equipement"],
    isIAChain: true,
  },
  {
    id: "semi_fabrication",
    label: "Semi C.Appro Fabrication",
    layer: "C3",
    emoji: "🏭",
    leaderSectors: ["semis"],
    tickers: ["TSM", "SMCI", "TSEM", "TTMI", "SOI"],
    causalFrom: ["ia_infra_cloud", "semi_design"],
    isIAChain: true,
  },
  {
    id: "ia_memoire",
    label: "IA x Mémoire // Stockage",
    layer: "C3",
    emoji: "💾",
    leaderSectors: ["semis", "tech"],
    tickers: ["MU", "WDC", "STX", "NTAP", "DELL", "SNDK"],
    causalFrom: ["semi_fabrication"],
    isIAChain: true,
  },
  {
    id: "ia_photonique",
    label: "IA x Photonique",
    layer: "C3",
    emoji: "💡",
    leaderSectors: ["semis"],
    tickers: ["COHR", "AIXA", "HIMX", "AMS", "POET", "IQE"],
    causalFrom: ["ia_memoire"],
    isIAChain: true,
  },
  {
    id: "ia_semi_general",
    label: "IA x Semi Général",
    layer: "C3",
    emoji: "🧠",
    leaderSectors: ["semis", "tech"],
    tickers: ["NVDA", "AMD", "INTC", "QCOM", "TXN", "ON", "AVGO"],
    causalFrom: ["ia_photonique"],
    isIAChain: true,
  },
  {
    id: "ia_software_quantique",
    label: "IA Software // Quantique",
    layer: "C3",
    emoji: "⚛",
    leaderSectors: ["tech", "semis"],
    tickers: ["IBM", "IONQ", "QBTS", "RGTI", "QUBT", "APP"],
    causalFrom: ["ia_semi_general"],
    isIAChain: true,
  },
  {
    id: "ia_robotique",
    label: "IA x Robotique Chaîne",
    layer: "C3",
    emoji: "🤖",
    leaderSectors: ["semis", "industrie"],
    tickers: ["TSLA", "CGNX", "ROK", "PH", "RRX", "IRDM"],
    causalFrom: ["ia_semi_general"],
    isIAChain: true,
  },
  {
    id: "spacex",
    label: "SpaceX x Chaîne appro",
    layer: "C3",
    emoji: "🚀",
    leaderSectors: ["defense", "tech"],
    tickers: ["RKLB", "MNTS", "ASTS", "PL", "LUNR", "SATL"],
    causalFrom: ["defense"],
  },

  // ── C4 HUMAIN ────────────────────────────────────────────────
  {
    id: "luxe",
    label: "Luxe x Conso Premium",
    layer: "C4",
    emoji: "💎",
    leaderSectors: ["luxe", "tech"],
    tickers: ["MC", "RMS", "BIRK", "LVMHF", "AD"],
    causalFrom: [],
  },
  {
    id: "finance_crypto",
    label: "Finance x Crypto",
    layer: "C4",
    emoji: "₿",
    leaderSectors: ["crypto", "tech"],
    tickers: ["HUT", "MSTR", "COIN", "CLSK", "RIOT"],
    causalFrom: [],
  },
  {
    id: "finance_fintech",
    label: "Finance x Fintech",
    layer: "C4",
    emoji: "💳",
    leaderSectors: ["tech", "luxe"],
    tickers: ["V", "MA", "GS", "BX", "BLK", "ICE", "FUTU"],
    causalFrom: ["ia_robotique"],
    isIAChain: true,
  },
  {
    id: "biotech",
    label: "BioTech x MidTech",
    layer: "C4",
    emoji: "🧬",
    leaderSectors: ["tech"],
    tickers: ["ILMN", "MEDCL", "NANO"],
    causalFrom: [],
  },
  {
    id: "healthcare",
    label: "Healthcare",
    layer: "C4",
    emoji: "🏥",
    leaderSectors: ["industrie"],
    tickers: ["HROW", "HURN", "AORT"],
    causalFrom: [],
  },
  {
    id: "japon",
    label: "Japon Potentiel",
    layer: "C4",
    emoji: "🗾",
    leaderSectors: ["semis", "industrie"],
    tickers: ["6920", "5803", "7011", "6146", "3436"],
    causalFrom: [],
  },
  {
    id: "aschenbenner",
    label: "13F AschenBenner",
    layer: "C4",
    emoji: "📊",
    leaderSectors: ["semis", "tech", "crypto"],
    tickers: ["NVDA", "TSM", "ORCL", "MU", "AVGO", "ASML", "GLW", "CRWV"],
    causalFrom: ["ia_semi_general"],
    isIAChain: true,
  },
];

// ─────────────────────────────────────────────────────────────────
// PROXY ETF pour les corrélations historiques
// On mappe chaque cluster sur un ETF proxy tradable
// ─────────────────────────────────────────────────────────────────

const CLUSTER_PROXY = {
  geopolitique:          "ITA",   // iShares Defense & Aerospace
  mp_or:                 "GLD",
  mp_lithium:            "LIT",
  mp_terres_rares:       "REMX",
  mp_mines:              "XME",
  nrj_petrole:           "XLE",
  nrj_nucleaire:         "URA",
  nrj_renouvelable:      "ICLN",
  nrj_chimie:            "XLB",
  ia_energie:            "XLE",
  infra_construction:    "XLI",
  ia_infra_hardware:     "IGV",
  ia_infra_cloud:        "QQQ",
  ia_telecom_optique:    "IYZ",
  defense:               "ITA",
  semi_equipement:       "SOXX",
  semi_design:           "SOXX",
  semi_fabrication:      "SOXX",
  ia_memoire:            "SMH",
  ia_photonique:         "SMH",
  ia_semi_general:       "SMH",
  ia_software_quantique: "IGV",
  ia_robotique:          "BOTZ",
  spacex:                "UFO",
  luxe:                  "XLY",
  finance_crypto:        "GBTC",
  finance_fintech:       "XLF",
  biotech:               "XBI",
  healthcare:            "XLV",
  japon:                 "EWJ",
  aschenbenner:          "SMH",
};

// ─────────────────────────────────────────────────────────────────
// TWELVE DATA — Historique daily returns (cache 4h)
// ─────────────────────────────────────────────────────────────────

async function fetchDailyReturns(symbol, outputsize = 260) {
  const apiKey = process.env.TWELVEDATA_KEY;
  const url =
    "https://api.twelvedata.com/time_series?symbol=" +
    encodeURIComponent(symbol) +
    "&interval=1day&outputsize=" +
    outputsize +
    "&apikey=" +
    apiKey;

  try {
    const res = await fetch(url, { next: { revalidate: 14400 } });
    const data = await res.json();
    if (!data.values || data.status === "error") return null;

    const values = [...data.values].reverse();
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
// TWELVE DATA — Quotes temps réel
// ─────────────────────────────────────────────────────────────────

async function fetchQuotes(symbols) {
  const apiKey = process.env.TWELVEDATA_KEY;
  const joined = symbols.map(encodeURIComponent).join(",");
  const url =
    "https://api.twelvedata.com/quote?symbol=" + joined + "&apikey=" + apiKey;

  try {
    const res = await fetch(url, { cache: "no-store" });
    return await res.json();
  } catch {
    return {};
  }
}

// ─────────────────────────────────────────────────────────────────
// MATH — Pearson
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
// MATH — Lead-lag (leader[J] → follower[J+1])
// ─────────────────────────────────────────────────────────────────

function leadLag(leaderReturns, followerReturns) {
  const leaderLagged    = leaderReturns.slice(0, -1);
  const followerShifted = followerReturns.slice(1);
  return pearson(leaderLagged, followerShifted);
}

// ─────────────────────────────────────────────────────────────────
// MATH — Hit rate conditionnel
// ─────────────────────────────────────────────────────────────────

function conditionalStats(leaderReturns, followerReturns, threshold = 0.003) {
  const n = Math.min(leaderReturns.length - 1, followerReturns.length - 1);
  const hits = [];
  const bullFollows = [];
  const bearFollows = [];

  for (let i = 0; i < n; i++) {
    if (Math.abs(leaderReturns[i]) < threshold) continue;
    const sameDir =
      Math.sign(leaderReturns[i]) === Math.sign(followerReturns[i + 1]);
    hits.push(sameDir ? 1 : 0);
    if (leaderReturns[i] > threshold)  bullFollows.push(followerReturns[i + 1]);
    if (leaderReturns[i] < -threshold) bearFollows.push(followerReturns[i + 1]);
  }

  const hitRate =
    hits.length > 0
      ? hits.reduce((a, b) => a + b, 0) / hits.length
      : 0.5;
  const avgBull =
    bullFollows.length > 3
      ? bullFollows.reduce((a, b) => a + b, 0) / bullFollows.length
      : null;
  const avgBear =
    bearFollows.length > 3
      ? bearFollows.reduce((a, b) => a + b, 0) / bearFollows.length
      : null;

  return { hitRate, avgBull, avgBear, nCond: hits.length };
}

// ─────────────────────────────────────────────────────────────────
// MOTEUR — Score Bayésien par cluster (direct + propagation causale)
// ─────────────────────────────────────────────────────────────────

function scoreCluster(cluster, leaderData, corrMatrix, clusterScores) {
  const BASE_RATE = 0.52;
  let logOdds = Math.log(BASE_RATE / (1 - BASE_RATE));

  const activeSignals = [];

  // 1. Signaux directs depuis les leaders overnight
  for (const leader of leaderData) {
    if (!cluster.leaderSectors.includes(leader.sector)) continue;
    if (leader.changePct === null || Math.abs(leader.changePct) < 0.003) continue;

    const key = leader.symbol + "__" + cluster.id;
    const c = corrMatrix[key];
    if (!c || Math.abs(c.corr) < 0.20 || c.n < 30) continue;

    const direction  = leader.changePct > 0 ? 1 : -1;
    const magnitude  = Math.min(Math.abs(leader.changePct) / 0.01, 3);
    const edge       = c.corr * direction * magnitude * 0.28;
    logOdds += edge;

    const absCorr = Math.abs(c.corr);
    const quality =
      absCorr >= 0.65 ? "fort" : absCorr >= 0.45 ? "modéré" : "faible";

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
      quality,
      contribution: edge,
      source:       "direct",
    });
  }

  // 2. Propagation causale depuis les clusters parents
  if (cluster.causalFrom && cluster.causalFrom.length > 0) {
    for (const parentId of cluster.causalFrom) {
      const parent = clusterScores[parentId];
      if (!parent) continue;
      // Propagation atténuée à 40% du signal parent
      const parentLogOdds = Math.log(parent.probability / (1 - parent.probability));
      const attenuated = parentLogOdds * 0.4;
      logOdds += attenuated;

      if (Math.abs(parent.probability - 0.5) > 0.08) {
        activeSignals.push({
          leader:       parent.label,
          symbol:       parentId,
          region:       parent.layer,
          changePct:    parent.probability - 0.5,
          corr:         0.4,
          hitRate:      null,
          quality:      "modéré",
          contribution: attenuated,
          source:       "causal",
        });
      }
    }
  }

  const probability = 1 / (1 + Math.exp(-logOdds));
  const avgCorr =
    activeSignals.length > 0
      ? activeSignals.reduce((a, s) => a + Math.abs(s.corr), 0) /
        activeSignals.length
      : 0;
  const confidence = Math.min(
    Math.round((activeSignals.length / 3) * avgCorr * 3),
    3
  );

  const direction =
    probability >= 0.60 ? "haussier"
    : probability <= 0.42 ? "baissier"
    : "neutre";

  return {
    clusterId:   cluster.id,
    label:       cluster.label,
    layer:       cluster.layer,
    emoji:       cluster.emoji,
    tickers:     cluster.tickers,
    causalFrom:  cluster.causalFrom,
    isIAChain:   cluster.isIAChain || false,
    probability,
    direction,
    confidence,
    signalCount: activeSignals.length,
    signals:     activeSignals.sort(
      (a, b) => Math.abs(b.corr) - Math.abs(a.corr)
    ),
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

    // 2. Fetch historiques proxies clusters (cache 4h, dédupliqués)
    const proxySymbols = [...new Set(Object.values(CLUSTER_PROXY))];
    const proxyHistorical = {};
    await Promise.all(
      proxySymbols.map(async (sym) => {
        const r = await fetchDailyReturns(sym, 260);
        if (r && r.length >= 30) proxyHistorical[sym] = r;
      })
    );

    // 3. Matrice de corrélations lead-lag
    const corrMatrix = {};
    for (const leader of LEADERS) {
      const lr = leaderHistorical[leader.symbol];
      if (!lr) continue;
      for (const cluster of CLUSTERS) {
        const proxy = CLUSTER_PROXY[cluster.id];
        const fr = proxyHistorical[proxy];
        if (!fr) continue;
        const { corr, n } = leadLag(lr, fr);
        const { hitRate, avgBull, avgBear, nCond } = conditionalStats(lr, fr);
        corrMatrix[leader.symbol + "__" + cluster.id] = {
          corr, n, hitRate, avgBull, avgBear, nCond,
        };
      }
    }

    // 4. Quotes temps réel
    const leaderSymbols = LEADERS.map((l) => l.symbol);
    const quotes = await fetchQuotes(leaderSymbols);

    const leaderData = LEADERS.map((leader) => {
      const q =
        quotes[leader.symbol] ||
        (leaderSymbols.length === 1 ? quotes : null);
      const changePct = q?.percent_change
        ? parseFloat(q.percent_change) / 100
        : null;
      return {
        ...leader,
        changePct,
        price: q?.close ? parseFloat(q.close) : null,
        available: changePct !== null,
      };
    });

    const available = leaderData.filter((l) => l.available);

    // 5. Score clusters dans l'ordre causal (C0 → C4)
    // On score d'abord les clusters sans parents, puis on propage
    const layerOrder = ["C0", "C1", "C2", "C2.5", "C3", "C4"];
    const clusterScores = {};

    for (const layer of layerOrder) {
      const layerClusters = CLUSTERS.filter((c) => c.layer === layer);
      for (const cluster of layerClusters) {
        clusterScores[cluster.id] = scoreCluster(
          cluster,
          available,
          corrMatrix,
          clusterScores
        );
      }
    }

    const clusters = Object.values(clusterScores);

    return NextResponse.json({
      success:    true,
      computedAt: new Date().toISOString(),
      leaders:    leaderData,
      clusters,
      meta: {
        lookbackDays:      252,
        leadersAvailable:  available.length,
        totalLeaders:      LEADERS.length,
        totalClusters:     clusters.length,
        corrPairsComputed: Object.keys(corrMatrix).length,
        layerOrder,
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
