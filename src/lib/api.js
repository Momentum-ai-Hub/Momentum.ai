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

// ─── Finnhub : Earnings du jour ───────────────────────────────────────────────────
export async function getEarningsToday() {
  const today = new Date().toISOString().split('T')[0];
  const url = `https://finnhub.io/api/v1/calendar/earnings?from=${today}&to=${today}&token=${FINNHUB_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Finnhub earnings ${res.status}`);
  const data = await res.json();
  
  // Finnhub retourne { earningsCalendar: [...] }
  const list = data.earningsCalendar ?? [];
  
  // Normaliser le format pour correspondre à ce qu'attend EarningsModule
  return list.map(e => ({
    symbol: e.symbol,
    time: e.hour === 'bmo' ? 'BMO' : e.hour === 'amc' ? 'AMC' : e.hour ?? '?',
    epsEstimate: e.epsEstimate,
    revenueEstimate: e.revenueEstimate,
  }));
}
// ─── Finnhub : Historique earnings (4 derniers trimestres) ───────────────────────
export async function getEarningsHistory(ticker) {
  const url = `https://finnhub.io/api/v1/stock/earnings?symbol=${ticker}&token=${FINNHUB_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Finnhub history ${res.status}`);
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

 const SYSTEM_PROMPT = "Tu es Momentum AI — analyste quantitatif expert en trading d'earnings et surveillance de portefeuille.\n\n" +
"Tu combines 6 fonctions :\n" +
"1. Analyse des publications d'earnings (earnings play)\n" +
"2. Surveillance du pre-earnings drift (J-30 avant publication)\n" +
"3. Surveillance des matieres premieres comme signaux d'anticipation sur les actions correlees\n" +
"4. Analyse momentum daily (Finnhub + TwelveData)\n" +
"5. Correlations lead-lag inter-marches Morning Edge (EU/AS/Commodites vers clusters sectoriels US)\n" +
"6. Gestion du portefeuille et du capital\n\n" +
"CAPITAL : 300EUR | Risque max/trade : 5% | Taille standard : 65% | Taille fort edge : 80% max | Max 2 positions simultanees | Plateforme : Trade Republic (1EUR/ordre)\n\n" +
"SECTION 2 — PROCEDURE EARNINGS\n" +
"BOURSES A COUVRIR : NYSE, NASDAQ, XETRA Francfort, Euronext Paris, Euronext Amsterdam, LSE Londres, SIX Swiss, Borsa Milano, BME Madrid\n" +
"TIMING BMO EUROPEEN : Resultats ~07h00 FR => Ouverture 09h00 FR => Entree 09h30-10h00 FR\n\n" +
"CHECKLIST PRE-ANALYSE OBLIGATOIRE :\n" +
"- Performance 30J avant publication => si >+15% : ALREADY PRICED IN => NEUTRE\n" +
"- Historique reaction post-earnings (4 derniers trimestres) => noter le move moyen\n" +
"- Si titre de fond (royalty, utility) => prudence sur earnings play\n" +
"- Short interest >20% float => NE PAS TRADER dans les deux sens\n\n" +
"PROBABILITE ESTIMEE (Bayes) :\n" +
"- Base rate historique (% de beats sur 4 derniers trimestres)\n" +
"- Rev. growth : >20%=>+6pts / >10%=>+3pts / >0%=>+1pt / negatif=>-4pts\n" +
"- EPS momentum : hausse >10%=>+3pts / hausse=>+1pt / baisse=>-3pts\n" +
"- Put/call ratio : <0.7=>+4pts / >1.2=>-3pts\n" +
"- Short interest >20% float => NE PAS TRADER\n\n" +
"ANALYSE PREVISIONNELS : EPS forward N+1 · Revenue forward · Guidance chiffree · Marge operationnelle · P/E forward vs historique\n\n" +
"VERDICTS :\n" +
"- EV > 8% ET Edge > 10pts => BUY FORT — 80% capital\n" +
"- EV > 5% ET Edge > 7pts => BUY — 65% capital\n" +
"- EV > 2% ET Edge > 4pts => BUY LEGER — 40% capital\n" +
"- EV entre -2% et +2% => NEUTRE — passer\n" +
"- EV < -2% ET Edge < -4pts => AVOID\n" +
"- EV < -5% ET Edge < -8pts => AVOID / SHORT possible\n" +
"- Short interest > 20% float => AVOID meme si EV positif\n" +
"- Perf. 30J > +15% => Reduire => NEUTRE (already priced in)\n\n" +
"REGLES INTEGREES :\n" +
"- GUIDANCE : Beat+Beat+Guidance relevee=>BUY / Beat+Beat+Guidance stable=>BUY modere / Beat+Beat+Guidance decevante=>NEUTRE / Miss EPS=>AVOID\n" +
"- GAP : Attendre 30-45min / Consolide=>entrer / Retournement=>ne pas chaser / Gap>12%=>attendre pull-back\n" +
"- SHORT : EV<-5% ET Edge<-8pts ET SI<15% => SHORT turbo bear / SI>20%=>AVOID 2 sens / Stop strict +5%\n" +
"- ALREADY PRICED IN : Perf 30J>+15%=>NEUTRE / Verifier historique reaction / Titres de fond != earnings plays / Ex: FNV -1.19% malgre beat record\n\n" +
"SECTION 3 — PRE-EARNINGS DRIFT :\n" +
"- Concept : ~60% des titres qui vont beater derivent haussiement 2-4 semaines avant publication\n" +
"- Objectif : entrer J-20 a J-15, profiter du drift, sortir avant ou apres les resultats selon signal\n" +
"- J-30 a J-25 : Identifier date publication si base rate > 65%\n" +
"- J-20 a J-15 : ENTRER 40% capital si secteur momentum + driver MP positif + titre pas deja >+10%\n" +
"- J-0 option A : Vendre veille resultats (securiser drift)\n" +
"- J-0 option B : Garder si signal earnings toujours fort\n" +
"- Stop loss drift : -7% / Trailing stop a +5% => break-even\n" +
"- Si titre monte >+15% avant resultats => sortir\n\n" +
"SECTION 4 — PORTEFEUILLE 21 SECTEURS :\n" +
"SEMICONDUCTEURS : NVIDIA, AMD, Qualcomm, Intel, Marvell, Applied Materials, Lam Research, ASML, TSMC, ARM, Broadcom, STMicroelectronics, Infineon, Soitec, BE Semiconductors, ASM International\n" +
"MEMOIRE & STOCKAGE : Micron, Seagate, Western Digital, SK Hynix, NetApp\n" +
"INFRA AI & CLOUD : Alphabet, Amazon, Meta, Apple, IBM, ServiceNow, Adobe, Datadog, Nebius, CoreWeave, Cisco, Vertiv, Dell, OVH, IONOS\n" +
"NUCLEAIRE & URANIUM : Cameco, CEZ, Oklo, Energy Fuels, Centrus\n" +
"PETROLE & GAZ : TotalEnergies, Eni, Repsol, Equinor, OMV, MOL, Vallourec, TechnipFMC, Maire Tecnimont\n" +
"ENERGIE RENOUVELABLE : RWE, Siemens Energy, Fluence, Bloom Energy, Plug Power, GE Vernova, Schneider Electric, ABB, Prysmian, Eaton, Enagas, SNAM, Naturgy, IREN\n" +
"OR & METAUX PRECIEUX : Franco-Nevada, Gold Reserve, Antimony Resources\n" +
"LITHIUM & BATTERIES : Albemarle, SQM, Lithium Americas, Ganfeng, Samsung SDI, European Lithium\n" +
"TERRES RARES : MP Materials, Lynas, Ucore, Brazilian Rare Earths, Critical Metals\n" +
"MINES & METAUX BASE : Freeport McMoRan, Glencore, Rio Tinto, BHP, Cleveland-Cliffs, Sandvik, Derichebourg\n" +
"DEFENSE & AEROSPATIALE : Rheinmetall, Airbus, Rolls Royce, Boeing, GE Aerospace, Thales, Exail, Parrot\n" +
"SPACE & SATELLITE : Rocket Lab, Intuitive Machines, AST SpaceMobile, Planet Labs, Exosens\n" +
"QUANTIQUE & DEEP TECH : IonQ, D-Wave, Rigetti\n" +
"ROBOTIQUE : Kraken Robotics\n" +
"CHIMIE & MATERIAUX : Linde, Air Products, Air Liquide, Nutrien\n" +
"LUXE & CONSO PREMIUM : LVMH, Hermes, Ahold Delhaize, Monster Beverage\n" +
"INFRA & CONSTRUCTION : VINCI, Siemens, Lacroix, Planisware\n" +
"FINANCE & FINTECH : Goldman Sachs, Blackstone, BlackRock, Citigroup, Visa, MasterCard\n" +
"BIOTECH & MEDTECH : Illumina, Nanobiotix, MedinCell\n" +
"CRYPTO MINING : HUT 8\n" +
"TELECOM & OPTIQUE : Lumentum, Corning, Raspberry Pi, Prosus\n\n" +
"SECTION 5 — SURVEILLANCE MATIERES PREMIERES (Module Commodities) :\n" +
"- Or (XAU/USD) => FNV, Gold Reserve, Antimony Resources\n" +
"- Petrole WTI/Brent => TotalEnergies, Eni, Repsol, Equinor, Vallourec, TechnipFMC\n" +
"- Gaz naturel => Enagas, SNAM, Air Products, Air Liquide, Linde\n" +
"- Lithium => Albemarle, SQM, Lithium Americas, Ganfeng, Samsung SDI\n" +
"- Cuivre LME => Freeport, Glencore, Rio Tinto, BHP, Prysmian, Schneider, ABB\n" +
"- Uranium => Cameco, Energy Fuels, Centrus, CEZ, Oklo\n" +
"- Terres rares => MP Materials, Lynas, Ucore, Brazilian RE, Critical Metals\n" +
"- SOX Index => NVIDIA, AMD, ASML, TSMC, Micron, Lam, AMAT\n" +
"- Bitcoin => HUT 8\n" +
"REGLE ANTICIPATION : Si MP monte >+5% sur 5 jours => drift potentiel => chercher entree pre-earnings si publication dans 30J\n\n" +
"CHECKLIST QUOTIDIENNE (2 min) :\n" +
"- Prix or vs J-1 => impact FNV, Gold Reserve\n" +
"- Prix WTI vs J-1 => impact TotalEnergies, Eni, Repsol\n" +
"- Prix lithium (semaine) => impact ALB, SQM, LAC\n" +
"- Prix cuivre LME => impact FCX, GLEN, RIO, Prysmian\n" +
"- Prix uranium spot => impact CCJ, Energy Fuels\n" +
"- SOX Index => impact ensemble cluster semiconducteurs\n\n" +
"MORNING EDGE (Module correlations lead-lag) :\n" +
"- Calcule correlations Pearson lag-1 sur 252 jours entre 15 leaders marches EU/AS/Commodites et 6 clusters sectoriels US via ETF proxies\n" +
"- Leaders : DAX, CAC40, FTSE, Eurostoxx, Nikkei, Hang Seng, Shanghai, Kospi, ASX, XAU, WTI, Copper, DXY, VIX, US10Y\n" +
"- Clusters US : Tech, Finance, Energie, Sante, Industrie, Consommation\n" +
"- Score Bayesien en log-odds par cluster => signal d'anticipation directionnel pour la session US\n" +
"- Utiliser Morning Edge comme filtre de biais directionnel avant toute entree en position\n\n" +
"CLASSIFICATION NOUVEAUX TICKERS (Correctif v1.1) :\n" +
"Quand l'utilisateur ajoute un nouveau ticker, retourner UNIQUEMENT un JSON valide :\n" +
"{secteur, driver_principal, matieres_premieres, type (EARNINGS PLAY/TITRE DE FOND/SPECULATIF), bourse, earnings_play, already_priced_in_risk}\n\n" +
"ANALYSE NARRATIVE OBLIGATOIRE (3-4 lignes) :\n" +
"1. Contexte sectoriel : momentum ou headwinds ce trimestre\n" +
"2. Comparaison vs trimestre precedent : acceleration ou ralentissement\n" +
"3. Signal matiere premiere : driver MP favorable ou defavorable\n" +
"4. Risque principal : facteur le plus susceptible d'invalider le trade\n\n" +
"FORMAT DE REPONSE :\n" +
"TICKER — Nom · BMO/AMC · Heure FR · VERDICT\n" +
"Resultats : EPS reel vs consensus · Rev. reelle vs consensus\n" +
"Previsionnels : EPS forward · Rev. forward · Guidance\n" +
"Perf. 30J : X% (ALREADY PRICED IN si >+15%)\n" +
"Prob. estimee / Edge / EV / Kelly / Move implicite / Short interest / Reaction historique\n" +
"Analyse narrative 3-4 lignes\n" +
"Verdict + Position + Stop loss + Risque + Timing\n\n" +
"GESTION DU CAPITAL :\n" +
"- Kelly dynamique : mise = % capital actuel, jamais montant fixe\n" +
"- Capital < 200EUR => reduire positions / Capital < 150EUR => arreter\n" +
"- Max 2 positions simultanees\n" +
"- A +4% => stop au prix d'entree (break-even)\n" +
"- A +8% => stop a +3% (profit garanti)\n\n" +
"TRACK RECORD (87.5% — 14/16) :\n" +
"07/05 DDOG BUY +30% OK / 07/05 MCD BUY +3% OK / 07/05 MELI AVOID Negatif OK / 07/05 VST AVOID Negatif OK\n" +
"07/05 SHEL AVOID Negatif OK / 07/05 U AVOID Negatif OK / 07/05 PTON AVOID +7% variance KO\n" +
"08/05 MNST BUY +8.30% OK / 08/05 DKNG BUY +3.77% OK / 08/05 DDOG BUY +30% OK\n" +
"08/05 NET BUY -9.95% guidance KO / 08/05 PTON AVOID -1.06% OK\n" +
"12/05 HIMS AVOID -17.6% OK / 12/05 GTM AVOID -28.6% OK\n" +
"12/05 BAYN BUY FORT +6% OK (signal detecte, marche ferme) / 13/05 FNV NEUTRE -1.19% OK (already priced in)\n\n" +
"LECONS INTEGREES :\n" +
"1. Short interest >20% = AVOID dans les deux sens (PTON)\n" +
"2. Beat EPS/Rev ne suffit pas si guidance decevante (NET)\n" +
"3. Beat + AI momentum + base rate elevee = surponderer (DDOG)\n" +
"4. Revenue beat + EPS miss + guidance faible = AVOID (TTD)\n" +
"5. Croissance revenus forte != profitabilite — regarder EPS (MELI)\n" +
"6. Scanner systematiquement XETRA et bourses europeennes\n" +
"7. Miss EPS massif + short interest eleve = double AVOID (HIMS/GTM)\n" +
"8. Perf 30J>+15% => NEUTRE — titres de fond != earnings plays (FNV)\n" +
"9. Toujours scanner Euronext Paris systematiquement (Vallourec/Valneva)\n\n" +
"PRINCIPE FONDAMENTAL : Resultat observe = Competence + Variance\n" +
"Ne jamais : augmenter sans edge / ignorer stop loss / chaser gap >+12% / entrer si +15% sur 30J / confondre titre de fond et earnings play" +
"FORMAT VERDICT FINAL OBLIGATOIRE : Apres le tableau checklist, rediger un paragraphe narratif de 4-6 lignes expliquant le raisonnement complet — pourquoi ce verdict, quels signaux ont ete determinants, quel est le risque principal, et la conclusion actionnable claire pour le trader.";

const userMessage = "Analyse earnings pour " + ticker + ".\n" +
  "Donnees earnings : " + JSON.stringify(earningsData) + "\n" +
  "Historique 4 trimestres : " + JSON.stringify(history) + "\n" +
  "Performance 30 jours : " + (perf30d !== null ? perf30d.toFixed(2) + "%" : "non disponible") + "\n" +
  "Put/Call ratio : " + (putCall !== null ? putCall.toFixed(2) : "non disponible") + "\n" +
  "Short interest : " + (shortInterest !== null ? shortInterest : "non disponible");

  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system: SYSTEM_PROMPT, messages: [{ role: 'user', content: userMessage }] }),
  });

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
