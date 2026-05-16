// ─── CLÉS API ────────────────────────────────────────────────────────────────
const FINNHUB_KEY    = process.env.NEXT_PUBLIC_FINNHUB_KEY;
const FMP_KEY        = process.env.NEXT_PUBLIC_FMP_KEY;
const TWELVEDATA_KEY = process.env.NEXT_PUBLIC_TWELVEDATA_KEY;

// ─── FMP : Earnings du jour ───────────────────────────────────────────────────
export async function getEarningsToday() {
  const today = new Date().toISOString().split('T')[0];
  const url = `https://financialmodelingprep.com/api/v3/earning_calendar?from=${today}&to=${today}&apikey=${FMP_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('FMP earnings error');
  return res.json();
}

// ─── FMP : Historique earnings (4 derniers trimestres) ───────────────────────
export async function getEarningsHistory(ticker) {
  const url = `https://financialmodelingprep.com/api/v3/earnings-surprises/${ticker}?apikey=${FMP_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('FMP earnings history error');
  const data = await res.json();
  return data.slice(0, 4);
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
export async function analyzeEarnings(ticker, earningsData, history, perf30d, putCall, shortInterest) {

 const SYSTEM_PROMPT = "test";

const userMessage = "Analyse earnings pour " + ticker + ".\n" +
  "Donnees earnings : " + JSON.stringify(earningsData) + "\n" +
  "Historique 4 trimestres : " + JSON.stringify(history) + "\n" +
  "Performance 30 jours : " + (perf30d !== null ? perf30d.toFixed(2) + "%" : "non disponible") + "\n" +
  "Put/Call ratio : " + (putCall !== null ? putCall.toFixed(2) : "non disponible") + "\n" +
  "Short interest : " + (shortInterest !== null ? shortInterest : "non disponible");

  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }]
}),

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
