// app/api/morning-edge/route.js
// Morning Edge Engine v3 — clusters L1→L12 (Supabase couches_sections)
// Corrélations Pearson lead-lag 252 sessions · Propagation causale · Cache 4h

import { NextResponse } from "next/server";

export const revalidate = 14400; // 4h

// ─────────────────────────────────────────────────────────────────
// LEADERS OVERNIGHT
// ─────────────────────────────────────────────────────────────────

const LEADERS = [
  { symbol: "ASML",      name: "ASML",          region: "EU", sector: "semis"        },
  { symbol: "SAP",       name: "SAP",            region: "EU", sector: "tech"         },
  { symbol: "MC.PA",     name: "LVMH",           region: "EU", sector: "luxe"         },
  { symbol: "SIE.DE",    name: "Siemens",        region: "EU", sector: "industrie"    },
  { symbol: "RWE.DE",    name: "RWE",            region: "EU", sector: "renouvelable" },
  { symbol: "TTE.PA",    name: "TotalEnergies",  region: "EU", sector: "petrole"      },
  { symbol: "AIR.PA",    name: "Airbus",         region: "EU", sector: "defense"      },
  { symbol: "RHM.DE",    name: "Rheinmetall",    region: "EU", sector: "defense"      },
  { symbol: "TSM",       name: "TSMC",           region: "AS", sector: "semis"        },
  { symbol: "005930.KS", name: "Samsung",        region: "AS", sector: "semis"        },
  { symbol: "6758.T",    name: "Sony",           region: "AS", sector: "tech"         },
  { symbol: "7203.T",    name: "Toyota",         region: "AS", sector: "industrie"    },
  { symbol: "BABA",      name: "Alibaba",        region: "AS", sector: "tech"         },
  { symbol: "GLD",       name: "Or (GLD)",       region: "CM", sector: "or"           },
  { symbol: "USO",       name: "Pétrole WTI",    region: "CM", sector: "petrole"      },
  { symbol: "CPER",      name: "Cuivre",         region: "CM", sector: "metaux"       },
  { symbol: "GBTC",      name: "Bitcoin",        region: "CM", sector: "crypto"       },
];

// ─────────────────────────────────────────────────────────────────
// CLUSTERS L1→L12
// id = couches_sections.parent_id + "_" + sous-couche (slugifié)
// layerId = couches_layers.id ("l1".."l12" + panels)
// ─────────────────────────────────────────────────────────────────

const CLUSTERS = [
  // ── MACRO (panneau L0) ─────────────────────────────────────────
  { id: "mac_13f",     layerId: "macro",   leaderSectors: ["semis","tech","crypto"],                    causalFrom: [],                proxy: "QQQ"  },
  { id: "mac_iran",    layerId: "macro",   leaderSectors: ["defense","petrole","industrie"],             causalFrom: [],                proxy: "ITA"  },
  { id: "mac_sante",   layerId: "macro",   leaderSectors: ["tech"],                                      causalFrom: [],                proxy: "XBI"  },
  { id: "mac_crypto",  layerId: "macro",   leaderSectors: ["crypto","tech"],                             causalFrom: [],                proxy: "GBTC" },
  { id: "mac_fintech", layerId: "macro",   leaderSectors: ["tech","luxe"],                               causalFrom: [],                proxy: "XLF"  },
  { id: "mac_conso",   layerId: "macro",   leaderSectors: ["luxe","industrie"],                          causalFrom: [],                proxy: "XLY"  },
  { id: "mac_japon",   layerId: "macro",   leaderSectors: ["semis","industrie"],                         causalFrom: [],                proxy: "EWJ"  },

  // ── L1 — Application ──────────────────────────────────────────
  { id: "l1_assist",   layerId: "l1",      leaderSectors: ["tech","luxe"],                               causalFrom: [],                proxy: "QQQ"  },
  { id: "l1_agentic",  layerId: "l1",      leaderSectors: ["tech"],                                      causalFrom: [],                proxy: "IGV"  },
  { id: "l1_saas",     layerId: "l1",      leaderSectors: ["tech"],                                      causalFrom: [],                proxy: "IGV"  },
  { id: "l1_vertical", layerId: "l1",      leaderSectors: ["tech","luxe"],                               causalFrom: [],                proxy: "QQQ"  },

  // ── L2 — AI Model ─────────────────────────────────────────────
  { id: "l2_foundation",    layerId: "l2", leaderSectors: ["semis","tech"],                              causalFrom: ["l1_assist"],     proxy: "SMH"  },
  { id: "l2_finetuned",     layerId: "l2", leaderSectors: ["tech"],                                      causalFrom: ["l1_vertical"],   proxy: "IGV"  },
  { id: "l2_vision",        layerId: "l2", leaderSectors: ["semis","industrie"],                         causalFrom: ["l1_vertical"],   proxy: "BOTZ" },
  { id: "l2_inference",     layerId: "l2", leaderSectors: ["tech","semis"],                              causalFrom: ["l1_saas"],       proxy: "IGV"  },
  { id: "l2_orchestration", layerId: "l2", leaderSectors: ["tech","defense"],                            causalFrom: ["l1_agentic"],    proxy: "IGV"  },

  // ── L3 — Software Infrastructure ──────────────────────────────
  { id: "l3_frameworks",  layerId: "l3",   leaderSectors: ["semis","tech"],                              causalFrom: ["l2_foundation"], proxy: "IGV"  },
  { id: "l3_training",    layerId: "l3",   leaderSectors: ["tech"],                                      causalFrom: ["l2_foundation"], proxy: "IGV"  },
  { id: "l3_inference",   layerId: "l3",   leaderSectors: ["tech","semis"],                              causalFrom: ["l2_inference"],  proxy: "IGV"  },
  { id: "l3_telecom_sw",  layerId: "l3",   leaderSectors: ["tech","industrie"],                          causalFrom: [],                proxy: "IYZ"  },

  // ── L4 — Cloud Infrastructure ─────────────────────────────────
  { id: "l4_hyperscaler", layerId: "l4",   leaderSectors: ["tech","semis"],                              causalFrom: ["l3_training","l3_inference"], proxy: "QQQ"  },
  { id: "l4_neocloud",    layerId: "l4",   leaderSectors: ["tech","semis"],                              causalFrom: ["l3_frameworks"], proxy: "SMH"  },
  { id: "l4_edge",        layerId: "l4",   leaderSectors: ["tech","industrie"],                          causalFrom: ["l3_telecom_sw"], proxy: "IYZ"  },
  { id: "l4_colo",        layerId: "l4",   leaderSectors: ["industrie","renouvelable"],                  causalFrom: [],                proxy: "XLI"  },

  // ── L5 — Compute Hardware ─────────────────────────────────────
  { id: "l5_gpu",         layerId: "l5",   leaderSectors: ["semis"],                                     causalFrom: ["l4_hyperscaler","l4_neocloud"], proxy: "SOXX" },
  { id: "l5_custom_asic", layerId: "l5",   leaderSectors: ["semis","tech"],                              causalFrom: ["l4_hyperscaler"], proxy: "SOXX" },
  { id: "l5_accel",       layerId: "l5",   leaderSectors: ["semis"],                                     causalFrom: ["l4_neocloud"],   proxy: "SOXX" },
  { id: "l5_cpu",         layerId: "l5",   leaderSectors: ["semis","industrie"],                         causalFrom: ["l4_hyperscaler"], proxy: "SOXX" },
  { id: "l5_net_asic",    layerId: "l5",   leaderSectors: ["semis","tech"],                              causalFrom: ["l4_edge"],       proxy: "SOXX" },
  { id: "l5_quantum",     layerId: "l5",   leaderSectors: ["tech","semis"],                              causalFrom: [],                proxy: "IGV"  },

  // ── THERMAL (panneau latéral gauche — niveau L5) ───────────────
  { id: "thm",            layerId: "thermal", leaderSectors: ["industrie","renouvelable"],               causalFrom: ["l5_gpu"],        proxy: "XLI"  },

  // ── POWER (panneau latéral gauche — niveau L5) ────────────────
  { id: "pow_renew",    layerId: "power",  leaderSectors: ["renouvelable"],                              causalFrom: [],                proxy: "ICLN" },
  { id: "pow_nuke",     layerId: "power",  leaderSectors: ["renouvelable","industrie"],                  causalFrom: [],                proxy: "URA"  },
  { id: "pow_fossil",   layerId: "power",  leaderSectors: ["petrole"],                                   causalFrom: [],                proxy: "XLE"  },
  { id: "pow_pigments", layerId: "power",  leaderSectors: ["petrole","industrie"],                       causalFrom: ["pow_fossil"],    proxy: "XLB"  },
  { id: "pow_grid",     layerId: "power",  leaderSectors: ["industrie","renouvelable"],                  causalFrom: ["pow_renew","pow_nuke"], proxy: "XLI" },
  { id: "pow_dc",       layerId: "power",  leaderSectors: ["industrie","semis"],                         causalFrom: ["pow_grid"],      proxy: "XLI"  },
  { id: "pow_semis",    layerId: "power",  leaderSectors: ["semis","industrie"],                         causalFrom: ["pow_dc"],        proxy: "SOXX" },

  // ── L6 — Memory ───────────────────────────────────────────────
  { id: "l6_hbm_dram", layerId: "l6",     leaderSectors: ["semis"],                                     causalFrom: ["l5_gpu","l5_custom_asic"], proxy: "SMH"  },
  { id: "l6_nand",     layerId: "l6",     leaderSectors: ["semis","tech"],                              causalFrom: ["l5_accel"],      proxy: "SMH"  },
  { id: "l6_lpddr",    layerId: "l6",     leaderSectors: ["semis"],                                     causalFrom: ["l5_cpu"],        proxy: "SMH"  },

  // ── L7 — Interconnect ─────────────────────────────────────────
  { id: "l7_scaleup",    layerId: "l7",   leaderSectors: ["semis","tech"],                              causalFrom: ["l5_gpu","l6_hbm_dram"],  proxy: "SOXX" },
  { id: "l7_scaleout",   layerId: "l7",   leaderSectors: ["tech","industrie"],                          causalFrom: ["l6_hbm_dram"],   proxy: "IYZ"  },
  { id: "l7_scaleacross",layerId: "l7",   leaderSectors: ["tech","industrie"],                          causalFrom: ["l7_scaleout"],   proxy: "IYZ"  },
  { id: "l7_wireless",   layerId: "l7",   leaderSectors: ["semis","tech"],                              causalFrom: [],                proxy: "IYZ"  },
  { id: "l7_optical",    layerId: "l7",   leaderSectors: ["semis","industrie"],                         causalFrom: ["l7_scaleacross"], proxy: "IYZ" },

  // ── L8 — Advanced Packaging ───────────────────────────────────
  { id: "l8_wafer",      layerId: "l8",   leaderSectors: ["semis"],                                     causalFrom: ["l7_scaleup"],    proxy: "SOXX" },
  { id: "l8_substrates", layerId: "l8",   leaderSectors: ["semis","industrie"],                         causalFrom: ["l7_scaleup"],    proxy: "SOXX" },
  { id: "l8_metrology",  layerId: "l8",   leaderSectors: ["semis"],                                     causalFrom: ["l8_wafer"],      proxy: "SOXX" },

  // ── L9 — Semiconductor Foundry ────────────────────────────────
  { id: "l9_leading",   layerId: "l9",    leaderSectors: ["semis"],                                     causalFrom: ["l8_wafer","l8_substrates"], proxy: "SOXX" },
  { id: "l9_specialty", layerId: "l9",    leaderSectors: ["semis","industrie"],                         causalFrom: ["l8_substrates"], proxy: "SOXX" },
  { id: "l9_photonics", layerId: "l9",    leaderSectors: ["semis","tech"],                              causalFrom: ["l7_optical"],    proxy: "SMH"  },
  { id: "l9_compound",  layerId: "l9",    leaderSectors: ["semis","renouvelable"],                      causalFrom: [],                proxy: "SOXX" },
  { id: "l9_osat",      layerId: "l9",    leaderSectors: ["semis","industrie"],                         causalFrom: ["l8_metrology"],  proxy: "SOXX" },

  // ── SECURITY (panneau latéral droit — niveau L9) ───────────────
  { id: "sec_cyber",    layerId: "security", leaderSectors: ["tech"],                                    causalFrom: ["l9_leading"],    proxy: "HACK" },
  { id: "sec_identity", layerId: "security", leaderSectors: ["tech"],                                    causalFrom: ["l9_leading"],    proxy: "HACK" },
  { id: "sec_analytics",layerId: "security", leaderSectors: ["tech"],                                    causalFrom: [],                proxy: "HACK" },
  { id: "sec_physical", layerId: "security", leaderSectors: ["industrie","defense"],                     causalFrom: [],                proxy: "ITA"  },

  // ── L10 — Semiconductor Equipment ────────────────────────────
  { id: "l10_litho",      layerId: "l10", leaderSectors: ["semis"],                                     causalFrom: ["l9_leading"],    proxy: "SOXX" },
  { id: "l10_deposition", layerId: "l10", leaderSectors: ["semis","industrie"],                         causalFrom: ["l9_leading","l9_specialty"], proxy: "SOXX" },
  { id: "l10_metrology",  layerId: "l10", leaderSectors: ["semis"],                                     causalFrom: ["l9_leading"],    proxy: "SOXX" },
  { id: "l10_compound",   layerId: "l10", leaderSectors: ["semis","renouvelable"],                      causalFrom: ["l9_compound"],   proxy: "SOXX" },
  { id: "l10_materials",  layerId: "l10", leaderSectors: ["semis","industrie"],                         causalFrom: [],                proxy: "XLB"  },

  // ── L11 — Semiconductor Materials ────────────────────────────
  { id: "l11_si_wafers",  layerId: "l11", leaderSectors: ["semis"],                                     causalFrom: ["l10_deposition"], proxy: "SOXX" },
  { id: "l11_inp_gaas",   layerId: "l11", leaderSectors: ["semis","tech"],                              causalFrom: ["l10_compound"],  proxy: "SMH"  },
  { id: "l11_sic",        layerId: "l11", leaderSectors: ["semis","renouvelable"],                      causalFrom: ["l10_compound"],  proxy: "SOXX" },
  { id: "l11_photoresist",layerId: "l11", leaderSectors: ["semis"],                                     causalFrom: ["l10_litho"],     proxy: "SOXX" },
  { id: "l11_coatings",   layerId: "l11", leaderSectors: ["semis","industrie"],                         causalFrom: ["l10_litho"],     proxy: "XLB"  },
  { id: "l11_gases",      layerId: "l11", leaderSectors: ["industrie"],                                 causalFrom: [],                proxy: "XLB"  },
  { id: "l11_chemicals",  layerId: "l11", leaderSectors: ["petrole","industrie"],                       causalFrom: [],                proxy: "XLB"  },

  // ── EDGE (panneau latéral droit — niveau L11) ──────────────────
  { id: "edg_robotics",   layerId: "edge", leaderSectors: ["industrie","semis"],                        causalFrom: ["l11_si_wafers"], proxy: "BOTZ" },
  { id: "edg_space",      layerId: "edge", leaderSectors: ["defense","tech"],                           causalFrom: [],                proxy: "UFO"  },
  { id: "edg_defense",    layerId: "edge", leaderSectors: ["defense","industrie"],                      causalFrom: [],                proxy: "ITA"  },
  { id: "edg_defense_it", layerId: "edge", leaderSectors: ["defense","tech"],                           causalFrom: [],                proxy: "ITA"  },

  // ── L12 — Critical Minerals ───────────────────────────────────
  { id: "l12_gold",   layerId: "l12",     leaderSectors: ["or","metaux"],                               causalFrom: [],                proxy: "GLD"  },
  { id: "l12_lithium",layerId: "l12",     leaderSectors: ["metaux","renouvelable"],                     causalFrom: ["l11_sic"],       proxy: "LIT"  },
  { id: "l12_re",     layerId: "l12",     leaderSectors: ["metaux","industrie"],                        causalFrom: ["l11_inp_gaas"],  proxy: "REMX" },
  { id: "l12_copper", layerId: "l12",     leaderSectors: ["metaux","industrie"],                        causalFrom: ["l11_si_wafers"], proxy: "CPER" },
  { id: "l12_steel",  layerId: "l12",     leaderSectors: ["industrie","metaux"],                        causalFrom: [],                proxy: "XME"  },
];

// Ordre de scoring (parents avant enfants pour la propagation causale)
const LAYER_ORDER = [
  "macro",
  "l12","l11","edge","l10","l9","security",
  "l8","l7","l6","thermal","power","l5",
  "l4","l3","l2","l1",
];

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
// TWELVE DATA — Quotes temps réel
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

function leadLag(leaderReturns, followerReturns) {
  var leaderLagged    = leaderReturns.slice(0, -1);
  var followerShifted = followerReturns.slice(1);
  return pearson(leaderLagged, followerShifted);
}

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
// ─────────────────────────────────────────────────────────────────

function scoreCluster(cluster, leaderData, corrMatrix, clusterScores) {
  var BASE_RATE = 0.52;
  var logOdds   = Math.log(BASE_RATE / (1 - BASE_RATE));
  var activeSignals = [];

  for (var i = 0; i < leaderData.length; i++) {
    var leader = leaderData[i];
    if (cluster.leaderSectors.indexOf(leader.sector) === -1) continue;
    if (leader.changePct === null || Math.abs(leader.changePct) < 0.003) continue;
    var key = leader.symbol + "__" + cluster.id;
    var c   = corrMatrix[key];
    if (!c || Math.abs(c.corr) < 0.20 || c.n < 30) continue;
    var direction = leader.changePct > 0 ? 1 : -1;
    var magnitude = Math.min(Math.abs(leader.changePct) / 0.01, 3);
    var edge      = c.corr * direction * magnitude * 0.28;
    logOdds += edge;
    var absCorr = Math.abs(c.corr);
    var quality = absCorr >= 0.65 ? "fort" : absCorr >= 0.45 ? "modéré" : "faible";
    activeSignals.push({
      leader: leader.name, symbol: leader.symbol, region: leader.region,
      changePct: leader.changePct, corr: c.corr, hitRate: c.hitRate,
      avgBull: c.avgBull, avgBear: c.avgBear, n: c.n,
      quality: quality, contribution: edge, source: "direct",
    });
  }

  for (var j = 0; j < cluster.causalFrom.length; j++) {
    var parentId = cluster.causalFrom[j];
    var parent   = clusterScores[parentId];
    if (!parent) continue;
    var parentLogOdds = Math.log(parent.probability / (1 - parent.probability));
    var attenuated    = parentLogOdds * 0.4;
    logOdds += attenuated;
    if (Math.abs(parent.probability - 0.5) > 0.08) {
      activeSignals.push({
        leader: parentId, symbol: parentId, region: parent.layerId || "causal",
        changePct: parent.probability - 0.5, corr: 0.4, hitRate: null,
        quality: "modéré", contribution: attenuated, source: "causal",
      });
    }
  }

  var probability = 1 / (1 + Math.exp(-logOdds));
  var totalCorr = 0;
  for (var k = 0; k < activeSignals.length; k++) totalCorr += Math.abs(activeSignals[k].corr);
  var avgCorr    = activeSignals.length > 0 ? totalCorr / activeSignals.length : 0;
  var confidence = Math.min(Math.round((activeSignals.length / 3) * avgCorr * 3), 3);
  var direction  = probability >= 0.60 ? "haussier" : probability <= 0.42 ? "baissier" : "neutre";
  activeSignals.sort(function(a, b) { return Math.abs(b.corr) - Math.abs(a.corr); });

  return {
    clusterId: cluster.id, layerId: cluster.layerId,
    causalFrom: cluster.causalFrom,
    probability: probability, direction: direction,
    confidence: confidence, signalCount: activeSignals.length,
    signals: activeSignals,
  };
}

// ─────────────────────────────────────────────────────────────────
// ROUTE HANDLER
// ─────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    // 1. Historiques leaders
    var leaderHistorical = {};
    await Promise.all(
      LEADERS.map(async function(leader) {
        var r = await fetchDailyReturns(leader.symbol, 260);
        if (r && r.length >= 30) leaderHistorical[leader.symbol] = r;
      })
    );

    // 2. Historiques proxies (dédupliqués)
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

    // 3. Matrice corrélations lead-lag
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
          corr: ll.corr, n: ll.n,
          hitRate: stats.hitRate, avgBull: stats.avgBull,
          avgBear: stats.avgBear, nCond: stats.nCond,
        };
      }
    }

    // 4. Quotes temps réel leaders
    var leaderSymbols = LEADERS.map(function(l) { return l.symbol; });
    var quotes        = await fetchQuotes(leaderSymbols);
    var leaderData    = LEADERS.map(function(leader) {
      var q         = quotes[leader.symbol] || null;
      var changePct = q && q.percent_change ? parseFloat(q.percent_change) / 100 : null;
      return Object.assign({}, leader, {
        changePct: changePct,
        price:     q && q.close ? parseFloat(q.close) : null,
        available: changePct !== null,
      });
    });
    var available = leaderData.filter(function(l) { return l.available; });

    // 5. Score clusters dans l'ordre L12→L1 (bedrock en premier)
    var clusterScores = {};
    for (var layerIdx = 0; layerIdx < LAYER_ORDER.length; layerIdx++) {
      var layerId       = LAYER_ORDER[layerIdx];
      var layerClusters = CLUSTERS.filter(function(c) { return c.layerId === layerId; });
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
        note:              "clusterId = couches_sections key (L1-L12 Supabase)",
      },
    });

  } catch (error) {
    console.error("[Morning Edge v3] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
