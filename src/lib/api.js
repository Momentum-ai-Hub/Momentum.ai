// ─── CLÉS API ────────────────────────────────────────────────────────────────
const FINNHUB_KEY    = process.env.NEXT_PUBLIC_FINNHUB_KEY;
const FMP_KEY        = process.env.NEXT_PUBLIC_FMP_KEY;
const TWELVEDATA_KEY = process.env.NEXT_PUBLIC_TWELVEDATA_KEY;

// ── SUPABASE CLIENT (instance unique) ──────────────
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ─── Earnings du jour ───────────────────────────────────────────────────
export async function getEarningsToday() {
  const date = new Date().toISOString().split('T')[0];
  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Search earnings releases for ' + date + ' on NYSE NASDAQ XETRA Euronext LSE. List only large and mid-cap tickers. Respond with ONLY a comma-separated list of ticker symbols, nothing else. Example: NVDA,CRM,COST,SAP' }],
      useWebSearch: true,
    }),
  });
  if (!res.ok) throw new Error('Earnings fetch error ' + res.status);
  const data = await res.json();
  const text = data.content[0].text || '';
  const tickers = text
    .replace(/[^A-Z0-9,\n\s]/g, '')
    .split(/[,\n\s]+/)
    .map(function(t) { return t.trim(); })
  .filter(function(t) {
  var exclude = ['NYSE','NASDAQ','XETRA','EURONEXT','LSE','BME','SIX','BORSA','AMC','BMO','THE','ETF','AND','FOR'];
  return t.length >= 2 && t.length <= 6 && /^[A-Z]/.test(t) && exclude.indexOf(t) === -1;
})
    .slice(0, 20);
 if (tickers.length === 0) {
  return [
    { symbol: 'NVDA', time: '?', exchange: 'NASDAQ' },
    { symbol: 'COST', time: 'AMC', exchange: 'NASDAQ' },
    { symbol: 'CRM', time: 'AMC', exchange: 'NYSE' }
  ];
}
  return tickers.map(function(symbol) { return { symbol: symbol, time: '?', exchange: '' }; });
}

// ─── Finnhub : Historique earnings (4 derniers trimestres) ───────────────────────
export async function getEarningsHistory(ticker) {
  const url = 'https://finnhub.io/api/v1/stock/earnings?symbol=' + ticker + '&token=' + FINNHUB_KEY;
  const res = await fetch(url);
  const data = await res.json();

  
  // Normaliser au même format qu'avant
  return data.slice(0, 4).map(e => ({
    date: e.period,
    actualEarningResult: e.actual,
    estimatedEarning: e.estimate,
    surprise: e.surprise,
    surprisePercent: e.surprisePercent,
  }));
}

// ─── Profile Earnings ───────────────────────────────────────────
export async function getStockProfile(ticker) {
  const url = `https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${FINNHUB_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.name) return null;
  return {
    name: data.name,
    sector: data.finnhubIndustry,
    marketCap: data.marketCapitalization,
    exchange: data.exchange,
  };
}

// ─── FINNHUB : Quote (prix actuel) ───────────────────────────────────────────
export async function getQuote(ticker) {
  const url = `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Finnhub quote error');
  return res.json();
}

// ─── TWELVEDATA : Performance 30 jours ───────────────────────────────────────
export async function getPerf30d(ticker) {
  const url = `https://api.twelvedata.com/time_series?symbol=${ticker}&interval=1day&outputsize=31&apikey=${TWELVEDATA_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('TwelveData perf error');
  const data = await res.json();
  if (!data.values || data.values.length < 2) return null;
  const latest = parseFloat(data.values[0].close);
  const oldest = parseFloat(data.values[data.values.length - 1].close);
  return ((latest - oldest) / oldest) * 100;
}

// ─── FINNHUB : Short interest ─────────────────────────────────────────────────
export async function getShortInterest(ticker) {
  const url = `https://finnhub.io/api/v1/stock/short-interest?symbol=${ticker}&token=${FINNHUB_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data?.data?.[0]?.shortInterest ?? null;
}

// ─── FINNHUB : Put/Call ratio (options) ──────────────────────────────────────
export async function getPutCallRatio(ticker) {
  // Finnhub options chain → calcul manuel put/call
  const url = `https://finnhub.io/api/v1/stock/option-chain?symbol=${ticker}&token=${FINNHUB_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data?.data?.length) return null;
  let puts = 0, calls = 0;
  data.data.forEach(exp => {
    exp.options?.CALL?.forEach(o => calls += (o.openInterest || 0));
    exp.options?.PUT?.forEach(o  => puts  += (o.openInterest || 0));
  });
  return calls > 0 ? puts / calls : null;
}

// ─── TWELVEDATA : Prix matières premières ────────────────────────────────────
export async function getCommodityPrice(symbol) {
  // Symboles TwelveData : XAU/USD, WTI/USD, LIT (lithium ETF), COPPER, URA (uranium ETF)
  const url = `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${TWELVEDATA_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('TwelveData commodity error');
  return res.json();
}

// ─── TWELVEDATA : Variation % sur N jours ────────────────────────────────────
export async function getCommodityChange(symbol, days = 5) {
  const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1day&outputsize=${days + 1}&apikey=${TWELVEDATA_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.values || data.values.length < 2) return null;
  const latest = parseFloat(data.values[0].close);
  const oldest = parseFloat(data.values[data.values.length - 1].close);
  return ((latest - oldest) / oldest) * 100;
}

// ─── ANTHROPIC CLAUDE : Analyse earnings ─────────────────────────────────────
export async function analyzeEarnings(ticker, earningsData, history, perf30d, putCall, shortInterest, profile, useWebSearch = false) {
  
const SYSTEM_PROMPT = "Tu es Momentum AI — analyste quantitatif expert en trading d'earnings.\n\n" +
"CAPITAL : 300EUR | Risque max/trade : 5% | Taille standard : 65% | Fort edge : 80% max | Max 2 positions | Trade Republic (1EUR/ordre)\n\n" +
"REGLE ALREADY PRICED IN : Perf 30J > +15% => NEUTRE obligatoire.\n" +
"REGLE GUIDANCE : Beat+Beat+Guidance relevee=>BUY / stable=>BUY modere / decevante=>NEUTRE / Miss EPS=>AVOID\n" +
"REGLE GAP : Attendre 30-45min. Consolide=>entrer. Gap>12%=>pull-back.\n" +
"REGLE SHORT : EV<-5% ET Edge<-8pts ET SI<15% => SHORT possible. SI>20%=>AVOID 2 sens.\n\n" +
"PROBABILITE ESTIMEE (Bayes) :\n" +
"Base rate historique (% beats 4 derniers trimestres) + ajustements :\n" +
"Rev growth >20%=>+6pts / >10%=>+3pts / >0%=>+1pt / negatif=>-4pts\n" +
"EPS momentum hausse >10%=>+3pts / hausse=>+1pt / baisse=>-3pts\n" +
"Put/call <0.7=>+4pts / >1.2=>-3pts\n" +
"Short interest >20% float => AVOID dans les deux sens\n\n" +
"VERDICTS :\n" +
"EV > 8% ET Edge > 10pts => BUY FORT 80% capital\n" +
"EV > 5% ET Edge > 7pts => BUY 65% capital\n" +
"EV > 2% ET Edge > 4pts => BUY LEGER 40% capital\n" +
"EV entre -2% et +2% => NEUTRE\n" +
"EV < -2% ET Edge < -4pts => AVOID\n" +
"EV < -5% ET Edge < -8pts => AVOID / SHORT possible\n\n" +
"TRACK RECORD 87.5% (14/16) : DDOG +30% OK / MCD +3% OK / MELI AVOID OK / VST AVOID OK / SHEL AVOID OK / PTON AVOID +7% KO / MNST +8.3% OK / DKNG +3.77% OK / NET -9.95% guidance KO / HIMS AVOID -17.6% OK / GTM AVOID -28.6% OK / BAYN BUY FORT +6% OK / FNV NEUTRE OK\n\n" +
"LECONS : SI>20%=AVOID 2 sens / Guidance decisive / Beat+AI=surponderer / Perf30J>+15%=NEUTRE / Scanner XETRA + Euronext Paris\n\n" +
"FORMAT DE REPONSE OBLIGATOIRE. Respecte exactement ce format. Zero JSON visible. Zero bloc de code. Zero markdown ##.\n\n" +
"[EMOJI] TICKER -- Nom complet . BOURSE . BMO/AMC . ~HH:MM FR\n\n" +
"Resultats attendus : EPS consensus $X.XX . EPS N-1 $X.XX . Rev. consensus $XM\n\n" +
"Analyse quant :\n" +
"- Base rate : X/4 trimestres battus = XX%\n" +
"- Prob. estimee : XX% vs ~XX% implicite marche\n" +
"- Edge : +/-Xpts\n" +
"- EV : +/-X%\n" +
"- Kelly fractionnel : (p - q) / 4 = XX% => taille XX% capital = XXXEUR\n" +
"- Move implicite : ~+/-X%\n" +
"- Short interest : X% (signal squeeze / signal safe)\n" +
"- Reaction historique moyenne : +/-X%\n" +
"- Perf. 30J : +/-X% (ALREADY PRICED IN si >+15%)\n\n" +
"Analyse narrative :\n" +
"[Paragraphe 3-4 lignes : contexte sectoriel + comparaison trimestre precedent + signal matiere premiere + risque principal]\n\n" +
"Verdict : [BUY FORT / BUY / BUY LEGER / NEUTRE / AVOID / SHORT]\n" +
"Position : XX% capital = XXXEUR | Stop loss : -5% = -XXEUR | Trailing stop : +4% => break-even\n\n" +
"Timing :\n" +
"- BMO : entrer avant ouverture ou attendre gap 30-45min ?\n" +
"- AMC : resultats a ~HH:MM FR => entrer le lendemain a ~HH:MM FR si guidance confirmee\n\n" +
"Si donnees insuffisantes : donner quand meme un verdict avec mention CONFIANCE FAIBLE. Ne jamais afficher de JSON ni de code.";
  
const userMessage = "Analyse earnings pour " + ticker + ".\n" +
  "Profil societe : " + (profile ? JSON.stringify(profile) : "non disponible") + "\n" +
  "Donnees earnings : " + JSON.stringify(earningsData) + "\n" +
  "Historique 4 trimestres : " + JSON.stringify(history) + "\n" +
  "Performance 30 jours : " + (perf30d !== null ? perf30d.toFixed(2) + "%" : "non disponible") + "\n" +
  "Put/Call ratio : " + (putCall !== null ? putCall.toFixed(2) : "non disponible") + "\n" +
  "Short interest : " + (shortInterest !== null ? shortInterest : "non disponible");

 const body = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system: SYSTEM_PROMPT, messages: [{ role: 'user', content: userMessage }], useWebSearch: useWebSearch }),
  };
  const response = await fetch('/api/claude', body);
  if (!response.ok) throw new Error('Claude API error');
  const data = await response.json();
  return data.content?.[0]?.text ?? 'Erreur analyse';
  }

// ─── ANTHROPIC CLAUDE : Classification ticker (Correctif v1.1) ───────────────
export async function classifyTicker(name, ticker) {
  const system = "Tu es un classificateur de titres boursiers. Retourne UNIQUEMENT un JSON valide, rien d'autre, sans backticks. { \"secteur\": \"[un des 21 secteurs]\", \"driver_principal\": \"[ex: Prix or]\", \"matieres_premieres\": [\"liste\"], \"type\": \"[EARNINGS PLAY / TITRE DE FOND / SPECULATIF]\", \"bourse\": \"[NYSE / NASDAQ / XETRA...]\", \"earnings_play\": true, \"already_priced_in_risk\": false }";

const response = await fetch('/api/claude', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ system, messages: [{ role: 'user', content: "Ticker : " + name + " (" + ticker + ")" }] }),
});

  if (!response.ok) throw new Error('Claude classify error');
  const data = await response.json();
  const text = data.content?.[0]?.text ?? '{}';
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    return null;
  }
}

// ─── ANTHROPIC CLAUDE : Classification batch ─────────────────────────────────
export async function classifyBatch(items) {
  const system = `Tu es un classificateur de titres boursiers.
Tu reçois une liste de titres au format JSON.
Retourne UNIQUEMENT un tableau JSON valide, sans backticks, sans texte autour.
Chaque objet a exactement ces champs :
{
  "ticker": "SYMBOL",
  "name": "Nom complet",
  "secteur": "UN des 21 secteurs",
  "bourse": "NYSE | NASDAQ | TSE | LSE | XETRA | TSX | EURONEXT | AUTRE",
  "type": "EARNINGS PLAY | TITRE DE FOND | SPÉCULATIF",
  "driver_principal": "courte phrase",
  "earnings_play": true | false,
  "already_priced_in_risk": true | false,
  "matieres_premieres": []
}

Les 21 secteurs (utilise EXACTEMENT ces noms) :
SEMICONDUCTEURS | MÉMOIRE & STOCKAGE | INFRA AI & CLOUD | NUCLÉAIRE & URANIUM |
PÉTROLE & GAZ | ÉNERGIE RENOUVELABLE | OR & MÉTAUX PRÉCIEUX | LITHIUM & BATTERIES |
TERRES RARES | MINES & MÉTAUX DE BASE | DÉFENSE & AÉROSPATIALE | SPACE & SATELLITE |
QUANTIQUE & DEEP TECH | ROBOTIQUE & AUTO. | CHIMIE & MATÉRIAUX | LUXE & CONSO PREMIUM |
INFRA & CONSTRUCTION | FINANCE & FINTECH | BIOTECH & MEDTECH | CRYPTO MINING |
TELECOM & OPTIQUE

Retourne UNIQUEMENT le tableau JSON. Rien d'autre.`;

  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system,
      messages: [{ role: 'user', content: `Classifie ces titres :\n${JSON.stringify(items, null, 2)}` }],
    }),
  });

  if (!response.ok) throw new Error('Claude Batch error');
  const data = await response.json();
  const text = data.content?.[0]?.text ?? '[]';
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    return [];
  }
}

// ─── PORTFOLIO : Sauvegarder via route API serveur ───────────────────────────
export async function saveTickersToSupabase(tickers) {
  const res = await fetch('/api/portfolio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tickers }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Save error');
  }
  const data = await res.json();
  return data.count;
}

// ─── PORTFOLIO : Charger via route API serveur ───────────────────────────────
export async function loadPortfolioFromSupabase() {
  const res = await fetch('/api/portfolio');
  if (!res.ok) throw new Error('Load error');
  const data = await res.json();
  return data.data || {};
}

// ─── PORTFOLIO : Supprimer via route API serveur ─────────────────────────────
export async function deleteTickersFromSupabase(tickers) {
  const res = await fetch('/api/portfolio', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tickers }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Delete error');
  }
}

// ─── ANTHROPIC CLAUDE : Pre-earnings drift ───────────────────────────────────
export async function analyzeDrift(ticker, perf30d, earningsDate) {
  const system = `Tu es un analyste spécialisé dans le pre-earnings drift.
Concept : ~60% des titres qui vont beater dérivent haussièrement 2-4 semaines avant publication.
Objectif : entrer J-20 à J-15, profiter du drift, sortir avant ou après les résultats selon signal.

RÈGLES DRIFT :
- J-30 à J-25 : Identifier si base rate > 65%
- J-20 à J-15 : ENTRER — 40% capital SI secteur momentum + driver MP positif + titre pas déjà >+10%
- J-0 Option A : Vendre veille résultats (sécuriser drift)
- J-0 Option B : Garder si signal earnings toujours fort
- STOP : Si titre monte >+15% avant résultats → sortir
- Stop loss drift : -7% | Trailing stop à +5% → break-even

Capital référence : 300€ | Entrée drift : 40% = 120€

Réponds en format clair : Setup VALIDE ou INVALIDE, avec raison + timing exact + stop.`;

  const today = new Date();
  const earnings = new Date(earningsDate);
  const daysToEarnings = Math.round((earnings - today) / (1000 * 60 * 60 * 24));

  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system,
      message: `Ticker : ${ticker}
Performance 30J : ${perf30d !== null ? perf30d.toFixed(2) + '%' : 'non disponible'}
Date earnings : ${earningsDate}
Jours restants avant earnings : ${daysToEarnings}J`
    }),
  });

  if (!response.ok) throw new Error('Claude drift error');
  const data = await response.json();
  return data.content?.[0]?.text ?? 'Erreur analyse drift';
}
