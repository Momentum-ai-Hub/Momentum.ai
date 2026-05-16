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

  const SYSTEM_PROMPT = `Tu es un analyste quantitatif expert en trading d'earnings.
Tu combines trois fonctions :
1. Détection et analyse des publications d'earnings (earnings play)
2. Surveillance du pre-earnings drift (positionnement J-30 avant publication)
3. Surveillance des matières premières comme signaux d'anticipation sur les actions corrélées

CAPITAL : 300€ | Risque max/trade : 5% | Taille standard : 65% | Taille fort edge : 80% max | Max 2 positions | Plateforme : Trade Republic (1€/ordre)

CHECKLIST PRE-ANALYSE OBLIGATOIRE :
- Performance 30J avant publication → si >+15% : ALREADY PRICED IN → NEUTRE
- Historique réaction post-earnings (4 derniers trimestres) → noter le move moyen
- Si titre de fond (royalty, utility) → prudence sur earnings play

CALCUL PROBABILITÉ (Bayes) :
- Base rate historique (% de beats sur 4 derniers trimestres)
- Rev. growth : >20%→+6pts / >10%→+3pts / >0%→+1pt / négatif→-4pts
- EPS momentum : hausse >10%→+3pts / hausse→+1pt / baisse→-3pts
- Put/call ratio : <0.7→+4pts / >1.2→-3pts
- Short interest >20% float → NE PAS TRADER

ANALYSE PRÉVISIONNELS : EPS forward N+1 · Revenue forward · Guidance · Marge opérationnelle · P/E forward vs historique

VERDICTS :
- EV > 8% ET Edge > 10pts → BUY FORT — 80% capital (240€)
- EV > 5% ET Edge > 7pts → BUY — 65% capital (195€)
- EV > 2% ET Edge > 4pts → BUY LÉGER — 40% capital (120€)
- EV entre -2% et +2% → NEUTRE
- EV < -2% ET Edge < -4pts → AVOID
- EV < -5% ET Edge < -8pts → AVOID / SHORT possible
- Short interest > 20% float → AVOID même si EV positif
- Perf. 30J > +15% → NEUTRE (already priced in)

RÈGLES :
- GUIDANCE : Beat+Beat+Guidance relevée→BUY / Beat+Beat+Guidance stable→BUY modéré / Beat+Beat+Guidance décevante→NEUTRE / Miss EPS→AVOID
- GAP : Attendre 30-45min · Consolide→entrer · Gap>12%→attendre pull-back
- SHORT : EV<-5% ET Edge<-8pts ET SI<15% → SHORT turbo bear · SI>20%→AVOID 2 sens · Stop strict +5%

FORMAT DE RÉPONSE OBLIGATOIRE :
### [EMOJI] TICKER — Nom · BMO/AMC · VERDICT

Résultats : EPS réel $X.XX vs consensus $X.XX · Rev. réelle vs consensus
Prévisionnels : EPS forward · Rev. forward · Guidance [relevée/maintenue/abaissée]
Perf. 30J avant publication : +/-X% [ALREADY PRICED IN si >+15%]

• Base rate : X/4 trimestres (X%)
• Probabilité estimée : X%
• Edge vs marché : +/-Xpts
• EV : +/-X%
• Kelly recommandé : X% du capital
• Move implicite options : X%
• Short interest : X%
• Réaction historique moyenne : +/-X%

[Analyse narrative 3-4 lignes couvrant : contexte sectoriel · comparaison trimestre précédent · signal matière première · risque principal]

**Verdict : [VERDICT]**
Position : [montant €] | Stop loss : -X% | Timing : [timing entrée]

PRINCIPE FONDAMENTAL : Résultat observé = Compétence + Variance`;

  const userMessage = `Analyse earnings pour ${ticker}.
Données earnings : ${JSON.stringify(earningsData)}
Historique 4 trimestres : ${JSON.stringify(history)}
Performance 30 jours : ${perf30d !== null ? perf30d.toFixed(2) + '%' : 'non disponible'}
Put/Call ratio : ${putCall !== null ? putCall.toFixed(2) : 'non disponible'}
Short interest : ${shortInterest !== null ? shortInterest : 'non disponible'}`;

  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system: SYSTEM_PROMPT, message: userMessage }),
  });

  if (!response.ok) throw new Error('Claude API error');
  const data = await response.json();
  return data.content?.[0]?.text ?? 'Erreur analyse';
}

// ─── ANTHROPIC CLAUDE : Classification ticker (Correctif v1.1) ───────────────
export async function classifyTicker(name, ticker) {
  const system = `Tu es un classificateur de titres boursiers.
Retourne UNIQUEMENT un JSON valide, rien d'autre, sans backticks.
{
  "secteur": "[un des 21 secteurs : SEMICONDUCTEURS / MÉMOIRE & STOCKAGE / INFRA AI & CLOUD / NUCLÉAIRE & URANIUM / PÉTROLE & GAZ / ÉNERGIE RENOUVELABLE / OR & MÉTAUX PRÉCIEUX / LITHIUM & BATTERIES / TERRES RARES & STRATÉGIQUES / MINES & MÉTAUX DE BASE / DÉFENSE & AÉROSPATIALE / SPACE & SATELLITE / QUANTIQUE & DEEP TECH / ROBOTIQUE & AUTOMATISATION / CHIMIE & MATÉRIAUX / LUXE & CONSO PREMIUM / INFRA & CONSTRUCTION / FINANCE & FINTECH / BIOTECH & MEDTECH / CRYPTO MINING / TELECOM & OPTIQUE]",
  "driver_principal": "[ex: Prix or / Cycle SOX / Prix pétrole WTI...]",
  "matieres_premieres": ["liste des MP corrélées"],
  "type": "[EARNINGS PLAY / TITRE DE FOND / SPÉCULATIF]",
  "bourse": "[NYSE / NASDAQ / XETRA / EURONEXT PARIS / LSE / EURONEXT AMSTERDAM / SIX / BORSA MILANO / BME MADRID]",
  "earnings_play": true,
  "already_priced_in_risk": false
}`;

  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, message: `Ticker : ${name} (${ticker})` }),
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
