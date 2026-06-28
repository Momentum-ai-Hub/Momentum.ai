// ─── CLES API ────────────────────────────────────────────────────────────────
var FINNHUB_KEY    = process.env.NEXT_PUBLIC_FINNHUB_KEY;
var FMP_KEY        = process.env.NEXT_PUBLIC_FMP_KEY;
var TWELVEDATA_KEY = process.env.NEXT_PUBLIC_TWELVEDATA_KEY;

// ── SUPABASE CLIENT ──────────────────────────────────────────────────────────
import { createClient } from “@supabase/supabase-js”;
var supabase = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL,
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ─── SYSTEM PROMPT SESSION ───────────────────────────────────────────────────
var SESSION_SYSTEM_PROMPT =
“Tu es un desk d’analyse quantitatif senior. Style salle de marche : factuel, chiffre, direct.\n” +
“Zero formule de politesse. Zero ‘il convient de’. Zero ‘Momentum AI’.\n” +
“Pas de markdown (pas de **, pas de ##). Separateurs : —\n\n” +
“FORMAT OBLIGATOIRE :\n\n” +
“CONTEXTE MACRO\n” +
“Indices cloture J-1 ou dernier cours connu :\n” +
“S&P500 : XXXX (+/-X.XX%) | Nasdaq : XXXX (+/-X.XX%) | DOW : XXXX (+/-X.XX%)\n” +
“CAC40 : XXXX (+/-X.XX%) | DAX : XXXX (+/-X.XX%) | FTSE : XXXX (+/-X.XX%)\n” +
“Nikkei : XXXX (+/-X.XX%) | Hang Seng : XXXX (+/-X.XX%)\n” +
“VIX : XX.XX (+/-X.XX%) — FEAR / NEUTRE / GREED selon niveau\n\n” +
“Matieres premieres (variation 24h) :\n” +
“Or XAU/USD : XXXX (+/-X.XX%) | Petrole WTI : XX.XX (+/-X.XX%) | Brent : XX.XX (+/-X.XX%)\n” +
“Cuivre LME : X.XX (+/-X.XX%) | Uranium spot : XX.XX | Lithium : tendance\n” +
“Bitcoin : XXXXX (+/-X.XX%)\n\n” +
“Secteurs en mouvement (ETF proxies) :\n” +
“SOX (semis) : +/-X.XX% | XLE (energie) : +/-X.XX% | XLF (finance) : +/-X.XX%\n” +
“GDX (gold miners) : +/-X.XX% | XLK (tech) : +/-X.XX% | ITA (defense) : +/-X.XX%\n\n” +
“Theme macro dominant : [1 ligne factuelle]\n” +
“Catalyseurs du jour : [2-3 points max]\n\n” +
“—\n\n” +
“CALENDRIER DU JOUR\n” +
“TICKER | Nom | Bourse | Timing | Verdict\n” +
“[une ligne par ticker retenu, cap > 1Md ou move > 5%]\n\n” +
“CALENDRIER J+1\n” +
“TICKER | Nom | Bourse | Timing | Signal preliminaire\n” +
“[une ligne par ticker retenu]\n” +
“Priorite BMO demain : [liste]\n\n” +
“—\n\n” +
“[Pour chaque ticker AUJOURD’HUI retenu :]\n” +
“[EMOJI] TICKER – Nom . Bourse . BMO/AMC . ~HH:MM FR\n” +
“Resultats attendus : EPS consensus $X.XX . EPS N-1 $X.XX . Rev. consensus $XM\n” +
“Analyse quant :\n” +
“- Base rate : X/4 = XX%\n” +
“- Prob. estimee : XX% vs ~XX% implicite\n” +
“- Edge : +/-Xpts\n” +
“- EV : +/-X%\n” +
“- Kelly : XX% => XXXEUR\n” +
“- Move implicite : ~+/-X%\n” +
“- Short interest : X%\n” +
“- Reaction historique moy. : +/-X%\n” +
“- Perf. 30J : +/-X%\n” +
“Contexte : [2-3 lignes : secteur + driver MP + risque principal]\n” +
“Verdict : [BUY FORT / BUY / BUY LEGER / NEUTRE / AVOID / SHORT]\n” +
“Position : XX% capital = XXXEUR | Stop : -5% | Trailing : +4% => break-even\n” +
“Timing : [entree avant ouverture ou attendre gap 30-45min]\n\n” +
“[Pour chaque ticker J+1 retenu :]\n” +
“[EMOJI] TICKER – Nom . Bourse . BMO/AMC . ~HH:MM FR\n” +
“Resultats attendus : EPS consensus $X.XX . Rev. consensus $XM\n” +
“Setup preliminaire :\n” +
“- Base rate : X/4 = XX%\n” +
“- Perf. 30J : +/-X%\n” +
“- Driver principal : [1 ligne]\n” +
“- Risque principal : [1 ligne]\n” +
“Signal J+1 : [SURVEILLER / NEUTRE / AVOID]\n\n” +
“—\n\n” +
“RECAP\n” +
“Aujourd’hui — Total positions : X EUR | Capital alloue : X/300 EUR | Exposition : X%\n” +
“Demain (BMO) — Tickers a surveiller ce soir : [liste]”;

// ─── Earnings du jour + J+1 ──────────────────────────────────────────────────
export async function getEarningsSession() {
var now = new Date();
var today = now.toLocaleDateString(“fr-FR”, { weekday: “long”, day: “numeric”, month: “long”, year: “numeric” });

var tomorrow = new Date(now);
tomorrow.setDate(tomorrow.getDate() + 1);
if (tomorrow.getDay() === 0) { tomorrow.setDate(tomorrow.getDate() + 1); }
if (tomorrow.getDay() === 6) { tomorrow.setDate(tomorrow.getDate() + 2); }
var tomorrowStr = tomorrow.toLocaleDateString(“fr-FR”, { weekday: “long”, day: “numeric”, month: “long”, year: “numeric” });

var userMessage =
“Nous sommes le “ + today + “. Prochain jour de bourse : “ + tomorrowStr + “.\n\n” +
“SECTION 1 — CONTEXTE MACRO : cherche les derniers cours connus pour tous les indices et matieres premieres du format. Chiffres reels uniquement.\n\n” +
“SECTION 2 — EARNINGS AUJOURD’HUI : publications sur NYSE, NASDAQ, XETRA, Euronext Paris, LSE, Tokyo, HK. Cap > 1Md USD ou move potentiel > 5%.\n\n” +
“SECTION 3 — EARNINGS J+1 (” + tomorrowStr + “) : meme perimetre de bourses. “ +
“Priorite aux BMO. Si dimanche->lundi : couvrir aussi les earnings asiatiques du lundi matin.\n\n” +
“REGLE ALREADY PRICED IN : Perf 30J > +15% => NEUTRE obligatoire.\n” +
“REGLE SHORT : SI > 20% float => AVOID dans les deux sens.”;

var fetchOptions = {
method: “POST”,
headers: { “Content-Type”: “application/json” },
body: JSON.stringify({
system: SESSION_SYSTEM_PROMPT,
messages: [{ role: “user”, content: userMessage }],
useWebSearch: true
}),
};

var res = await fetch(”/api/claude”, fetchOptions);
var data = await res.json();
if (!res.ok) {
throw new Error(data.error || (“Session error “ + res.status));
}
var text = (data.content && data.content[0]) ? (data.content[0].text || “”) : “”;

var tickers = [];
var lines = text.split(”\n”);
for (var i = 0; i < lines.length; i++) {
var match = lines[i].match(/^[^\w]*([A-Z]{2,6})\s*–/);
if (match) {
var sym = match[1];
var exclude = [“BMO”, “AMC”, “EPS”, “EV”, “USA”, “NYSE”, “LSE”, “THE”, “AND”, “ETF”];
if (exclude.indexOf(sym) === -1 && tickers.indexOf(sym) === -1) {
tickers.push(sym);
}
}
}
return { sessionText: text, tickers: tickers };
}

// ─── Profile stock ────────────────────────────────────────────────────────────
export async function getStockProfile(ticker) {
var url = “https://finnhub.io/api/v1/stock/profile2?symbol=” + ticker + “&token=” + FINNHUB_KEY;
var res = await fetch(url);
if (!res.ok) { return null; }
var data = await res.json();
if (!data.name) { return null; }
return {
name: data.name,
sector: data.finnhubIndustry,
marketCap: data.marketCapitalization,
exchange: data.exchange,
};
}

// ─── FINNHUB : Quote ─────────────────────────────────────────────────────────
export async function getQuote(ticker) {
var url = “https://finnhub.io/api/v1/quote?symbol=” + ticker + “&token=” + FINNHUB_KEY;
var res = await fetch(url);
if (!res.ok) { throw new Error(“Finnhub quote error”); }
return res.json();
}

// ─── TWELVEDATA : Performance 30 jours ───────────────────────────────────────
export async function getPerf30d(ticker) {
var url = “https://api.twelvedata.com/time_series?symbol=” + ticker + “&interval=1day&outputsize=31&apikey=” + TWELVEDATA_KEY;
var res = await fetch(url);
if (!res.ok) { throw new Error(“TwelveData perf error”); }
var data = await res.json();
if (!data.values || data.values.length < 2) { return null; }
var latest = parseFloat(data.values[0].close);
var oldest = parseFloat(data.values[data.values.length - 1].close);
return ((latest - oldest) / oldest) * 100;
}

// ─── FINNHUB : Short interest ─────────────────────────────────────────────────
export async function getShortInterest(ticker) {
var url = “https://finnhub.io/api/v1/stock/short-interest?symbol=” + ticker + “&token=” + FINNHUB_KEY;
var res = await fetch(url);
if (!res.ok) { return null; }
var data = await res.json();
if (data.data && data.data[0] && data.data[0].shortInterest !== undefined) {
return data.data[0].shortInterest;
}
return null;
}

// ─── FINNHUB : Earnings history ───────────────────────────────────────────────
export async function getEarningsHistory(ticker) {
var url = “https://finnhub.io/api/v1/stock/earnings?symbol=” + ticker + “&token=” + FINNHUB_KEY;
var res = await fetch(url);
if (!res.ok) { return []; }
var data = await res.json();
return Array.isArray(data) ? data.slice(0, 4) : [];
}

// ─── FINNHUB : Put/Call ratio ─────────────────────────────────────────────────
export async function getPutCallRatio(ticker) {
var url = “https://finnhub.io/api/v1/stock/option-chain?symbol=” + ticker + “&token=” + FINNHUB_KEY;
var res = await fetch(url);
if (!res.ok) { return null; }
var data = await res.json();
if (!data.data || !data.data.length) { return null; }
var puts = 0;
var calls = 0;
for (var i = 0; i < data.data.length; i++) {
var exp = data.data[i];
if (exp.options && exp.options.CALL) {
for (var j = 0; j < exp.options.CALL.length; j++) {
calls = calls + (exp.options.CALL[j].openInterest || 0);
}
}
if (exp.options && exp.options.PUT) {
for (var k = 0; k < exp.options.PUT.length; k++) {
puts = puts + (exp.options.PUT[k].openInterest || 0);
}
}
}
return calls > 0 ? puts / calls : null;
}

// ─── TWELVEDATA : Prix matieres premieres ────────────────────────────────────
export async function getCommodityPrice(symbol) {
var url = “https://api.twelvedata.com/quote?symbol=” + symbol + “&apikey=” + TWELVEDATA_KEY;
var res = await fetch(url);
if (!res.ok) { throw new Error(“TwelveData commodity error”); }
return res.json();
}

// ─── TWELVEDATA : Variation % sur N jours ────────────────────────────────────
export async function getCommodityChange(symbol, days) {
if (!days) { days = 5; }
var url = “https://api.twelvedata.com/time_series?symbol=” + symbol + “&interval=1day&outputsize=” + (days + 1) + “&apikey=” + TWELVEDATA_KEY;
var res = await fetch(url);
if (!res.ok) { return null; }
var data = await res.json();
if (!data.values || data.values.length < 2) { return null; }
var latest = parseFloat(data.values[0].close);
var oldest = parseFloat(data.values[data.values.length - 1].close);
return ((latest - oldest) / oldest) * 100;
}

// ─── SYSTEM PROMPT ANALYSE EARNINGS ─────────────────────────────────────────
var EARNINGS_SYSTEM_PROMPT =
“Tu es un analyste quant specialise earnings. Output lu par un trader, pas par le grand public.\n\n” +
“CAPITAL : 300EUR | Risque max/trade : 5% | Taille std : 65% | Fort edge : 80% | Max 2 positions | Trade Republic 1EUR/ordre\n\n” +
“REGLES OBLIGATOIRES :\n” +
“- Perf 30J > +15% => NEUTRE (already priced in), sans exception\n” +
“- SI > 20% float => AVOID dans les deux sens, sans exception\n” +
“- Beat+Beat+Guidance relevee => BUY\n” +
“- Beat+Beat+Guidance stable => BUY modere\n” +
“- Beat+Beat+Guidance decevante => NEUTRE\n” +
“- Miss EPS => AVOID\n” +
“- Gap ouverture : attendre 30-45min. Gap > 12% => attendre pull-back\n\n” +
“CALCUL PROBABILITE (Bayes) :\n” +
“Base rate (% beats sur 4 trimestres) + ajustements :\n” +
“Rev growth >20%=>+6pts / >10%=>+3pts / >0%=>+1pt / negatif=>-4pts\n” +
“EPS momentum hausse >10%=>+3pts / hausse=>+1pt / baisse=>-3pts\n” +
“Put/call <0.7=>+4pts / >1.2=>-3pts\n\n” +
“VERDICTS :\n” +
“EV > 8% ET Edge > 10pts => BUY FORT — 80% capital = 240EUR\n” +
“EV > 5% ET Edge > 7pts => BUY — 65% capital = 195EUR\n” +
“EV > 2% ET Edge > 4pts => BUY LEGER — 40% capital = 120EUR\n” +
“EV entre -2% et +2% => NEUTRE\n” +
“EV < -2% ET Edge < -4pts => AVOID\n” +
“EV < -5% ET Edge < -8pts => AVOID / SHORT possible\n\n” +
“TON : factuel, chiffre, direct. Zero langue de bois.\n\n” +
“FORMAT OBLIGATOIRE :\n\n” +
“[EMOJI] TICKER – Nom complet . BOURSE . BMO/AMC . ~HH:MM FR\n\n” +
“Resultats attendus : EPS consensus $X.XX . EPS N-1 $X.XX . Rev. consensus $XM\n\n” +
“Analyse quant :\n” +
“- Base rate : X/4 trimestres battus = XX%\n” +
“- Prob. estimee : XX% vs ~XX% implicite marche\n” +
“- Edge : +/-Xpts\n” +
“- EV : +/-X%\n” +
“- Kelly fractionnel : (p - q) / 4 = XX% => taille XX% capital = XXXEUR\n” +
“- Move implicite : ~+/-X%\n” +
“- Short interest : X%\n” +
“- Reaction historique moy. : +/-X%\n” +
“- Perf. 30J : +/-X%\n\n” +
“Contexte :\n” +
“[3-4 lignes : secteur ce trimestre + signal matiere premiere + risque principal]\n\n” +
“Verdict : BUY FORT / BUY / BUY LEGER / NEUTRE / AVOID / SHORT\n” +
“Position : XX% capital = XXXEUR | Stop : -5% = -XXEUR | Trailing : +4% => break-even\n\n” +
“Timing :\n” +
“BMO : [precision sur entree]\n” +
“AMC : [precision sur entree]”;

// ─── ANTHROPIC CLAUDE : Analyse earnings individuelle ────────────────────────
export async function analyzeEarnings(ticker, earningsData, history, perf30d, putCall, shortInterest, profile, useWebSearch) {
if (useWebSearch === undefined) { useWebSearch = false; }

var perf30dStr = (perf30d !== null && perf30d !== undefined) ? perf30d.toFixed(2) + “%” : “non disponible”;
var putCallStr = (putCall !== null && putCall !== undefined) ? putCall.toFixed(2) : “non disponible”;
var shortIntStr = (shortInterest !== null && shortInterest !== undefined) ? String(shortInterest) : “non disponible”;
var profileStr = profile ? JSON.stringify(profile) : “non disponible”;

var userMessage =
“Analyse earnings pour “ + ticker + “.\n” +
“Profil : “ + profileStr + “\n” +
“Earnings data : “ + JSON.stringify(earningsData) + “\n” +
“Historique 4T : “ + JSON.stringify(history) + “\n” +
“Perf 30J : “ + perf30dStr + “\n” +
“Put/Call : “ + putCallStr + “\n” +
“Short interest : “ + shortIntStr;

var fetchOptions = {
method: “POST”,
headers: { “Content-Type”: “application/json” },
body: JSON.stringify({
system: EARNINGS_SYSTEM_PROMPT,
messages: [{ role: “user”, content: userMessage }],
useWebSearch: useWebSearch
}),
};

var response = await fetch(”/api/claude”, fetchOptions);
var data = await response.json();
if (!response.ok) { throw new Error(data.error || “Claude API error”); }
if (data.content && data.content[0] && data.content[0].text) {
return data.content[0].text;
}
return “Erreur analyse”;
}

// ─── ANTHROPIC CLAUDE : Classification ticker ────────────────────────────────
export async function classifyTicker(name, ticker) {
var system = “Tu es un classificateur de titres boursiers. Retourne UNIQUEMENT un JSON valide, rien d’autre, sans backticks. { "secteur": "[un des 21 secteurs]", "driver_principal": "[ex: Prix or]", "matieres_premieres": ["liste"], "type": "[EARNINGS PLAY / TITRE DE FOND / SPECULATIF]", "bourse": "[NYSE / NASDAQ / XETRA…]", "earnings_play": true, "already_priced_in_risk": false }”;

var response = await fetch(”/api/claude”, {
method: “POST”,
headers: { “Content-Type”: “application/json” },
body: JSON.stringify({
system: system,
messages: [{ role: “user”, content: “Ticker : “ + name + “ (” + ticker + “)” }]
}),
});

if (!response.ok) { throw new Error(“Claude classify error”); }
var data = await response.json();
var text = (data.content && data.content[0] && data.content[0].text) ? data.content[0].text : “{}”;
try {
return JSON.parse(text.replace(/`json|`/g, “”).trim());
} catch (e) {
return null;
}
}

// ─── ANTHROPIC CLAUDE : Classification batch ─────────────────────────────────
export async function classifyBatch(items) {
var system =
“Tu es un classificateur de titres boursiers.\n” +
“Tu recois une liste de titres au format JSON.\n” +
“Retourne UNIQUEMENT un tableau JSON valide, sans backticks, sans texte autour.\n” +
“Chaque objet a exactement ces champs :\n” +
“{ "ticker": "SYMBOL", "name": "Nom complet", "secteur": "UN des 21 secteurs", "bourse": "NYSE | NASDAQ | TSE | LSE | XETRA | TSX | EURONEXT | AUTRE", "type": "EARNINGS PLAY | TITRE DE FOND | SPECULATIF", "driver_principal": "courte phrase", "earnings_play": true, "already_priced_in_risk": false, "matieres_premieres": [] }\n\n” +
“Les 21 secteurs (utilise EXACTEMENT ces noms) :\n” +
“SEMICONDUCTEURS | MEMOIRE & STOCKAGE | INFRA AI & CLOUD | NUCLEAIRE & URANIUM |\n” +
“PETROLE & GAZ | ENERGIE RENOUVELABLE | OR & METAUX PRECIEUX | LITHIUM & BATTERIES |\n” +
“TERRES RARES | MINES & METAUX DE BASE | DEFENSE & AEROSPATIALE | SPACE & SATELLITE |\n” +
“QUANTIQUE & DEEP TECH | ROBOTIQUE & AUTO. | CHIMIE & MATERIAUX | LUXE & CONSO PREMIUM |\n” +
“INFRA & CONSTRUCTION | FINANCE & FINTECH | BIOTECH & MEDTECH | CRYPTO MINING |\n” +
“TELECOM & OPTIQUE\n\n” +
“Retourne UNIQUEMENT le tableau JSON. Rien d’autre.”;

var response = await fetch(”/api/claude”, {
method: “POST”,
headers: { “Content-Type”: “application/json” },
body: JSON.stringify({
system: system,
messages: [{ role: “user”, content: “Classifie ces titres : “ + JSON.stringify(items) }],
}),
});

if (!response.ok) { throw new Error(“Claude Batch error”); }
var data = await response.json();
var text = (data.content && data.content[0] && data.content[0].text) ? data.content[0].text : “[]”;
try {
return JSON.parse(text.replace(/`json|`/g, “”).trim());
} catch (e) {
return [];
}
}

// ─── PORTFOLIO : Sauvegarder ──────────────────────────────────────────────────
export async function saveTickersToSupabase(tickers) {
var res = await fetch(”/api/portfolio”, {
method: “POST”,
headers: { “Content-Type”: “application/json” },
body: JSON.stringify({ tickers: tickers }),
});
if (!res.ok) {
var err = await res.json();
throw new Error(err.error || “Save error”);
}
var data = await res.json();
return data.count;
}

// ─── PORTFOLIO : Charger ──────────────────────────────────────────────────────
export async function loadPortfolioFromSupabase() {
var res = await fetch(”/api/portfolio”);
if (!res.ok) { throw new Error(“Load error”); }
var data = await res.json();
return data.data || {};
}

// ─── PORTFOLIO : Supprimer ────────────────────────────────────────────────────
export async function deleteTickersFromSupabase(tickers) {
var res = await fetch(”/api/portfolio”, {
method: “DELETE”,
headers: { “Content-Type”: “application/json” },
body: JSON.stringify({ tickers: tickers }),
});
if (!res.ok) {
var err = await res.json();
throw new Error(err.error || “Delete error”);
}
}

// ─── ANTHROPIC CLAUDE : Pre-earnings drift ───────────────────────────────────
export async function analyzeDrift(ticker, perf30d, earningsDate) {
var system =
“Analyste pre-earnings drift. Reponds en format direct : setup VALIDE ou INVALIDE, raison + timing + stop.\n\n” +
“REGLES DRIFT :\n” +
“- Entrer J-20 a J-15 si base rate > 65% + secteur momentum + driver MP positif + titre < +10% sur 30J\n” +
“- Stop si titre > +15% avant resultats\n” +
“- Stop loss : -7% | Trailing stop : +5% => break-even\n” +
“- Sortie option A : veille resultats | Option B : garder si signal fort\n” +
“Capital : 300EUR | Entree drift : 40% = 120EUR”;

var today = new Date();
var earnings = new Date(earningsDate);
var daysToEarnings = Math.round((earnings - today) / (1000 * 60 * 60 * 24));
var perf30dStr = (perf30d !== null && perf30d !== undefined) ? perf30d.toFixed(2) + “%” : “non disponible”;

var content =
“Ticker : “ + ticker + “\n” +
“Perf 30J : “ + perf30dStr + “\n” +
“Date earnings : “ + earningsDate + “\n” +
“Jours restants : “ + daysToEarnings + “J”;

var response = await fetch(”/api/claude”, {
method: “POST”,
headers: { “Content-Type”: “application/json” },
body: JSON.stringify({
system: system,
messages: [{ role: “user”, content: content }]
}),
});

if (!response.ok) { throw new Error(“Claude drift error”); }
var data = await response.json();
if (data.content && data.content[0] && data.content[0].text) {
return data.content[0].text;
}
return “Erreur analyse drift”;
}

// ─── COUCHES L1-L12 : Charger depuis Supabase ────────────────────────────────
export async function getCouchesData() {
var layersRes = await supabase
.from(“couches_layers”)
.select(”*”)
.order(“order_index”);
if (layersRes.error) { throw new Error(layersRes.error.message); }

var panelsRes = await supabase
.from(“couches_panels”)
.select(”*”)
.order(“order_index”);
if (panelsRes.error) { throw new Error(panelsRes.error.message); }

var companiesRes = await supabase
.from(“couches_companies”)
.select(”*”);
if (companiesRes.error) { throw new Error(companiesRes.error.message); }

var sectionsRes = await supabase
.from(“couches_sections”)
.select(“id, slug, parent_type, parent_id, group_title, list_title, note, order_index, couches_section_tickers(ticker, order_index)”)
.order(“order_index”);
if (sectionsRes.error) { throw new Error(sectionsRes.error.message); }

var companies = {};
var companiesList = companiesRes.data || [];
for (var ci = 0; ci < companiesList.length; ci++) {
companies[companiesList[ci].ticker] = companiesList[ci];
}

function sortByOrder(a, b) {
return a.order_index - b.order_index;
}

function buildLists(parentType, parentId) {
var sectionsList = sectionsRes.data || [];
var filtered = [];
for (var si = 0; si < sectionsList.length; si++) {
if (sectionsList[si].parent_type === parentType && sectionsList[si].parent_id === parentId) {
filtered.push(sectionsList[si]);
}
}
filtered.sort(sortByOrder);
var result = [];
for (var fi = 0; fi < filtered.length; fi++) {
var s = filtered[fi];
var rawTickers = (s.couches_section_tickers || []).slice().sort(sortByOrder);
var tickerList = [];
for (var ti = 0; ti < rawTickers.length; ti++) {
tickerList.push(rawTickers[ti].ticker);
}
result.push({
id: s.slug || String(s.id),
title: s.list_title,
note: s.note,
groupTitle: s.group_title,
tickers: tickerList
});
}
return result;
}

var layersData = layersRes.data || [];
var layers = [];
for (var li = 0; li < layersData.length; li++) {
var l = layersData[li];
layers.push({
id: l.id,
num: l.num,
name: l.name,
cc: l.color_chip,
bc: l.color_border,
bg: l.color_bg,
connBelow: l.conn_below,
lists: buildLists(“layer”, l.id)
});
}

var panelsData = panelsRes.data || [];
var panels = [];
for (var pi = 0; pi < panelsData.length; pi++) {
var p = panelsData[pi];
var allSections = buildLists(“panel”, p.id);
var directLists = [];
var subsMap = {};
var subsOrder = [];

```
for (var ai = 0; ai < allSections.length; ai++) {
  var sec = allSections[ai];
  if (sec.groupTitle) {
    if (!subsMap[sec.groupTitle]) {
      subsMap[sec.groupTitle] = [];
      subsOrder.push(sec.groupTitle);
    }
    subsMap[sec.groupTitle].push(sec);
  } else {
    directLists.push(sec);
  }
}

var subs = [];
for (var si2 = 0; si2 < subsOrder.length; si2++) {
  subs.push({ title: subsOrder[si2], lists: subsMap[subsOrder[si2]] });
}

panels.push({
  id: p.id,
  badge: p.badge,
  name: p.name,
  cc: p.color_chip,
  bc: p.color_border,
  bg: p.color_bg,
  connectedAfter: p.connected_after_layer_id,
  lists: directLists.length ? directLists : null,
  subs: subs.length ? subs : null
});
```

}

return { layers: layers, panels: panels, companies: companies };
}