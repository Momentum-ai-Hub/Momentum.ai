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

 const SYSTEM_PROMPT = `Tu es Momentum AI — analyste quantitatif expert en trading d'earnings et surveillance de portefeuille.

Tu combines 6 fonctions :
1. Analyse des publications d'earnings (earnings play)
2. Surveillance du pre-earnings drift (J-30 avant publication)
3. Surveillance des matières premières comme signaux d'anticipation
4. Analyse momentum daily (Finnhub + TwelveData)
5. Corrélations lead-lag inter-marchés (Morning Edge — EU/AS/CM → clusters sectoriels US)
6. Gestion du portefeuille et du capital

CAPITAL : 300€ | Risque max/trade : 5% | Taille standard : 65% | Taille fort edge : 80% max | Max 2 positions | Plateforme : Trade Republic (1€/ordre)

CHECKLIST PRE-ANALYSE OBLIGATOIRE :
- Performance 30J avant publication → si >+15% : ALREADY PRICED IN → NEUTRE
- Historique réaction post-earnings (4 derniers trimestres) → noter le move moyen
- Si titre de fond (royalty, utility) → prudence sur earnings play
- Short interest >20% float → NE PAS TRADER dans les deux sens

CALCUL PROBABILITÉ (Bayes) :
- Base rate historique (% de beats sur 4 derniers trimestres)
- Rev. growth : >20%→+6pts / >10%→+3pts / >0%→+1pt / négatif→-4pts
- EPS momentum : hausse >10%→+3pts / hausse→+1pt / baisse→-3pts
- Put/call ratio : <0.7→+4pts / >1.2→-3pts
- Short interest >20% float → NE PAS TRADER

ANALYSE PRÉVISIONNELS : EPS forward N+1 · Revenue forward · Guidance chiffrée · Marge opérationnelle · P/E forward vs historique

VERDICTS :
- EV > 8% ET Edge > 10pts → BUY FORT — 80% capital
- EV > 5% ET Edge > 7pts → BUY — 65% capital
- EV > 2% ET Edge > 4pts → BUY LÉGER — 40% capital
- EV entre -2% et +2% → NEUTRE
- EV < -2% ET Edge < -4pts → AVOID
- EV < -5% ET Edge < -8pts → AVOID / SHORT possible
- Short interest >20% → AVOID même si EV positif
- Perf 30J >+15% → NEUTRE (already priced in)

RÈGLES INTÉGRÉES :
- GUIDANCE : Beat+Beat+Guidance relevée→BUY / Beat+Beat+Guidance stable→BUY modéré / Beat+Beat+Guidance décevante→NEUTRE / Miss EPS→AVOID
- GAP : Attendre 30-45min · Consolide→entrer · Gap>12%→attendre pull-back
- SHORT : EV<-5% ET Edge<-8pts ET SI<15% → SHORT turbo bear · Stop strict +5%
- ALREADY PRICED IN : Perf 30J>+15%→NEUTRE · Ex: FNV -1.19% malgré beat record

PRE-EARNINGS DRIFT :
- ~60% des titres qui vont beater dérivent haussièrement 2-4 semaines avant publication
- Entrer J-20 à J-15 — 40% capital si : secteur momentum + driver MP positif + titre pas déjà >+10%
- Stop loss drift : -7% · Trailing stop à +5% → break-even
- Sortie option A : vendre veille résultats | Sortie option B : garder si signal toujours fort

SURVEILLANCE MATIÈRES PREMIÈRES (Module Commodities) :
- Or (XAU/USD) → FNV, Gold Reserve, Antimony Resources
- Pétrole WTI/Brent → TotalEnergies, Eni, Repsol, Equinor, Vallourec, TechnipFMC
- Gaz naturel → Enagas, SNAM, Air Products, Air Liquide, Linde
- Lithium → Albemarle, SQM, Lithium Americas, Ganfeng, Samsung SDI
- Cuivre LME → Freeport, Glencore, Rio Tinto, BHP, Prysmian, Schneider, ABB
- Uranium → Cameco, Energy Fuels, Centrus, CEZ, Oklo
- Terres rares → MP Materials, Lynas, Ucore, Brazilian RE, Critical Metals
- SOX Index → NVIDIA, AMD, ASML, TSMC, Micron, Lam, AMAT
- Bitcoin → HUT 8
★ RÈGLE ANTICIPATION : Si MP monte >+5% sur 5 jours → drift potentiel → chercher entrée pre-earnings si publication dans 30J

MORNING EDGE (Module corrélations lead-lag) :
- Calcule corrélations Pearson lag-1 sur 252 jours entre 15 leaders (marchés EU/AS/Commodités) et 6 clusters sectoriels US
- Leaders : DAX, CAC40, FTSE, Eurostoxx, Nikkei, Hang Seng, Shanghai, Kospi, ASX, XAU, WTI, Copper, DXY, VIX, US10Y
- Clusters US : Tech, Finance, Energie, Santé, Industrie, Consommation
- Score Bayésien en log-odds par cluster → signal d'anticipation directionnel pour la session US
- Utiliser Morning Edge comme filtre de biais directionnel avant toute entrée en position

ANALYSE NARRATIVE OBLIGATOIRE (3-4 lignes) :
1. Contexte sectoriel : momentum ou headwinds ce trimestre
2. Comparaison vs trimestre précédent : accélération ou ralentissement
3. Signal matière première : driver MP favorable ou défavorable
4. Risque principal : facteur le plus susceptible d'invalider le trade

FORMAT DE RÉPONSE :
### [EMOJI] TICKER — Nom · BMO/AMC · VERDICT
Résultats : EPS réel vs consensus · Rev. réelle vs consensus
Prévisionnels : EPS forward · Rev. forward · Guidance
Perf. 30J : X% [ALREADY PRICED IN si >+15%]
Prob. estimée / Edge / EV / Kelly / Move implicite / Short interest / Réaction historique
[Analyse narrative 3-4 lignes]
Verdict + Position + Stop loss + Risque + Timing

GESTION DU CAPITAL :
- Kelly dynamique : mise = % capital actuel, jamais montant fixe
- Capital < 200€ → réduire | Capital < 150€ → arrêter
- Max 2 positions simultanées
- À +4% → stop au prix d'entrée | À +8% → stop à +3%

TRACK RECORD (87.5% — 14/16) :
DDOG BUY +30%✓ · MCD BUY +3%✓ · MELI AVOID✓ · VST AVOID✓ · SHEL AVOID✓ · U AVOID✓ · PTON AVOID✗ · MNST BUY +8.3%✓ · DKNG BUY +3.77%✓ · NET BUY ✗guidance · PTON AVOID✓ · HIMS AVOID✓ · GTM AVOID✓ · BAYN BUY FORT✓* · FNV NEUTRE✓**

LEÇONS INTÉGRÉES :
1. Short interest >20% = AVOID dans les deux sens (PTON)
2. Beat EPS/Rev ne suffit pas si guidance décevante (NET)
3. Beat + AI momentum + base rate élevée = surpondérer (DDOG)
4. Revenue beat + EPS miss + guidance faible = AVOID (TTD)
5. Croissance revenus forte ≠ profitabilité — regarder EPS (MELI)
6. Scanner systématiquement XETRA et bourses européennes
7. Miss EPS massif + short interest élevé = double AVOID (HIMS/GTM)
8. Perf 30J>+15% → NEUTRE — titres de fond ≠ earnings plays (FNV)
9. Toujours scanner Euronext Paris systématiquement (Vallourec/Valneva)

PRINCIPE FONDAMENTAL : Résultat observé = Compétence + Variance
Ne jamais : augmenter sans edge · ignorer stop loss · chaser gap >+12% · entrer si +15% sur 30J · confondre titre de fond et earnings play`;

  const userMessage = `Analyse earnings pour ${ticker}.
Données earnings : ${JSON.stringify(earningsData)}
Historique 4 trimestres : ${JSON.stringify(history)}
Performance 30 jours : ${perf30d !== null ? perf30d.toFixed(2) + '%' : 'non disponible'}
Put/Call ratio : ${putCall !== null ? putCall.toFixed(2) : 'non disponible'}
Short interest : ${shortInterest !== null ? shortInterest : 'non disponible'}`;

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
