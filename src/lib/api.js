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

// ─── SYSTEM PROMPT SESSION ────────────────────────────────────────────────────
const SESSION_SYSTEM_PROMPT =
"Tu es un desk d'analyse quantitatif senior. Style salle de marché : factuel, chiffré, direct.\n" +
"Zéro formule de politesse. Zéro 'il convient de'. Zéro 'Momentum AI'.\n" +
"Pas de markdown (pas de **, pas de ##). Séparateurs : ---\n\n" +

"FORMAT OBLIGATOIRE — respecte exactement ces blocs dans cet ordre :\n\n" +

"CONTEXTE MACRO\n" +
"Indices clôture J-1 ou dernier cours connu :\n" +
"S&P500 : XXXX (+/-X.XX%) | Nasdaq : XXXX (+/-X.XX%) | DOW : XXXX (+/-X.XX%)\n" +
"CAC40 : XXXX (+/-X.XX%) | DAX : XXXX (+/-X.XX%) | FTSE : XXXX (+/-X.XX%)\n" +
"Nikkei : XXXX (+/-X.XX%) | Hang Seng : XXXX (+/-X.XX%)\n" +
"VIX : XX.XX (+/-X.XX%) — [FEAR / NEUTRE / GREED selon niveau]\n\n" +
"Matieres premieres (variation 24h ou derniere session) :\n" +
"Or XAU/USD : XXXX (+/-X.XX%) | Petrole WTI : XX.XX (+/-X.XX%) | Brent : XX.XX (+/-X.XX%)\n" +
"Cuivre LME : X.XX (+/-X.XX%) | Uranium spot : XX.XX | Lithium : tendance\n" +
"Bitcoin : XXXXX (+/-X.XX%)\n\n" +
"Secteurs en mouvement dans l'univers Momentum (ETF proxies) :\n" +
"SOX (semis) : +/-X.XX% | XLE (energie) : +/-X.XX% | XLF (finance) : +/-X.XX%\n" +
"GDX (gold miners) : +/-X.XX% | XLK (tech) : +/-X.XX% | ITA (defense) : +/-X.XX%\n\n" +
"Theme macro dominant : [1 ligne — ex: Fed pause + dollar faible + or haussier]\n" +
"Catalyseurs du jour : [donnees macro publiees, discours Fed/BCE, geopolitique — 2-3 points max]\n\n" +

"---\n\n" +

"CALENDRIER DU JOUR\n" +
"[Section AUJOURD'HUI — earnings publiés ce jour]\n" +
"TICKER | Nom | Bourse | Timing | Verdict\n" +
"[une ligne par ticker retenu, cap > 1Md ou move > 5%, ou 'Aucune publication tradeable aujourd'hui.']\n\n" +

"CALENDRIER J+1\n" +
"[Section DEMAIN — earnings prévus le prochain jour de bourse, toutes places : Tokyo, HK, EU, US]\n" +
"TICKER | Nom | Bourse | Timing | Verdict préliminaire\n" +
"[une ligne par ticker retenu, ou 'Aucune publication notable demain.']\n" +
"Priorité BMO demain : [liste des tickers BMO a surveiller ce soir]\n\n" +

"---\n\n" +

"[Pour chaque ticker AUJOURD'HUI retenu, une section :]\n" +
"[EMOJI] TICKER -- Nom . Bourse . BMO/AMC . ~HH:MM FR\n" +
"Resultats attendus : EPS consensus $X.XX . EPS N-1 $X.XX . Rev. consensus $XM\n" +
"Analyse quant :\n" +
"- Base rate : X/4 = XX%\n" +
"- Prob. estimee : XX% vs ~XX% implicite\n" +
"- Edge : +/-Xpts\n" +
"- EV : +/-X%\n" +
"- Kelly : XX% => XXXEUR\n" +
"- Move implicite : ~+/-X%\n" +
"- Short interest : X%\n" +
"- Reaction historique moy. : +/-X%\n" +
"- Perf. 30J : +/-X%\n" +
"Contexte : [2-3 lignes : secteur + driver MP + risque principal]\n" +
"Verdict : [BUY FORT / BUY / BUY LEGER / NEUTRE / AVOID / SHORT]\n" +
"Position : XX% capital = XXXEUR | Stop : -5% | Trailing : +4% => break-even\n" +
"Timing : [entree avant ouverture ou attendre gap 30-45min]\n\n" +

"[Pour chaque ticker J+1 retenu, une section courte :]\n" +
"[EMOJI] TICKER -- Nom . Bourse . BMO/AMC . ~HH:MM FR\n" +
"Resultats attendus : EPS consensus $X.XX . Rev. consensus $XM\n" +
"Setup preliminaire :\n" +
"- Base rate : X/4 = XX%\n" +
"- Perf. 30J : +/-X%\n" +
"- Driver principal : [1 ligne]\n" +
"- Risque principal : [1 ligne]\n" +
"Signal J+1 : [SURVEILLER / NEUTRE / AVOID] — confirmation apres resultats\n\n" +

"---\n\n" +
"RECAP\n" +
"Aujourd'hui — Total positions : X EUR | Capital alloue : X/300 EUR | Exposition : X%\n" +
"Demain (BMO) — Tickers a surveiller ce soir : [liste]";

// ─── Earnings du jour + J+1 ───────────────────────────────────────────────────
export async function getEarningsSession() {
  var now = new Date();
  var today = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Calculer J+1 (prochain jour de bourse : skip dimanche->lundi, samedi->lundi)
  var tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (tomorrow.getDay() === 0) tomorrow.setDate(tomorrow.getDate() + 1); // dimanche -> lundi
  if (tomorrow.getDay() === 6) tomorrow.setDate(tomorrow.getDate() + 2); // samedi -> lundi
  var tomorrowStr = tomorrow.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  var userMessage =
    'Nous sommes le ' + today + '. Prochain jour de bourse : ' + tomorrowStr + '.\n\n' +
    'SECTION 1 — CONTEXTE MACRO : cherche les derniers cours connus pour tous les indices et matieres premieres du format. Chiffres reels uniquement, pas d\'estimations vagues.\n\n' +
    'SECTION 2 — EARNINGS AUJOURD\'HUI : publications sur NYSE, NASDAQ, XETRA, Euronext Paris, LSE, Tokyo, HK. Cap > 1Md USD ou move potentiel > 5%.\n\n' +
    'SECTION 3 — EARNINGS J+1 (' + tomorrowStr + ') : meme perimetre de bourses. ' +
    'Priorite aux BMO car ils se tradent des l\'ouverture. Inclure aussi les AMC notables du soir. ' +
    'Si dimanche->lundi : couvrir aussi les earnings asiatiques du lundi matin.\n\n' +
    'REGLE ALREADY PRICED IN : Perf 30J > +15% => NEUTRE obligatoire.\n' +
    'REGLE SHORT : SI > 20% float => AVOID dans les deux sens.';

  var body = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system: SESSION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      useWebSearch: true
    }),
  };
  var res = await fetch('/api/claude', body);
  if (!res.ok) throw new Error('Session error ' + res.status);
  var data = await res.json();
  var text = (data.content && data.content[0]) ? data.content[0].text || '' : '';

  // Extraire les tickers depuis les lignes "TICKER --"
  var tickers = [];
  var lines = text.split('\n');
  for (var i = 0; i < lines.length; i++) {
    var match = lines[i].match(/^[^\w]*([A-Z]{2,6})\s*--/);
    if (match) {
      var sym = match[1];
      var exclude = ['BMO', 'AMC', 'EPS', 'EV', 'USA', 'NYSE', 'LSE', 'THE', 'AND', 'ETF'];
      if (exclude.indexOf(sym) === -1 && tickers.indexOf(sym) === -1) tickers.push(sym);
    }
  }
  return { sessionText: text, tickers: tickers };
}

// ─── Profile stock ────────────────────────────────────────────────────────────
// FIX : fetch manquant sur res
export async function getStockProfile(ticker) {
  const url = 'https://finnhub.io/api/v1/stock/profile2?symbol=' + ticker + '&token=' + FINNHUB_KEY;
  const res = await fetch(url);  // FIX : fetch ajouté
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
  const url = 'https://finnhub.io/api/v1/quote?symbol=' + ticker + '&token=' + FINNHUB_KEY;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Finnhub quote error');
  return res.json();
}

// ─── TWELVEDATA : Performance 30 jours ───────────────────────────────────────
// FIX : fetch manquant sur res
export async function getPerf30d(ticker) {
  const url = 'https://api.twelvedata.com/time_series?symbol=' + ticker + '&interval=1day&outputsize=31&apikey=' + TWELVEDATA_KEY;
  const res = await fetch(url);  // FIX : fetch ajouté
  if (!res.ok) throw new Error('TwelveData perf error');
  const data = await res.json();
  if (!data.values || data.values.length < 2) return null;
  const latest = parseFloat(data.values[0].close);
  const oldest = parseFloat(data.values[data.values.length - 1].close);
  return ((latest - oldest) / oldest) * 100;
}

// ─── FINNHUB : Short interest ─────────────────────────────────────────────────
export async function getShortInterest(ticker) {
  const url = 'https://finnhub.io/api/v1/stock/short-interest?symbol=' + ticker + '&token=' + FINNHUB_KEY;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data?.data?.[0]?.shortInterest ?? null;
}

// ─── FINNHUB : Earnings history ───────────────────────────────────────────────
export async function getEarningsHistory(ticker) {
  const url = 'https://finnhub.io/api/v1/stock/earnings?symbol=' + ticker + '&token=' + FINNHUB_KEY;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data.slice(0, 4) : [];
}

// ─── FINNHUB : Put/Call ratio ─────────────────────────────────────────────────
export async function getPutCallRatio(ticker) {
  const url = 'https://finnhub.io/api/v1/stock/option-chain?symbol=' + ticker + '&token=' + FINNHUB_KEY;
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
  const url = 'https://api.twelvedata.com/quote?symbol=' + symbol + '&apikey=' + TWELVEDATA_KEY;
  const res = await fetch(url);
  if (!res.ok) throw new Error('TwelveData commodity error');
  return res.json();
}

// ─── TWELVEDATA : Variation % sur N jours ────────────────────────────────────
export async function getCommodityChange(symbol, days = 5) {
  const url = 'https://api.twelvedata.com/time_series?symbol=' + symbol + '&interval=1day&outputsize=' + days + '&apikey=' + TWELVEDATA_KEY;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.values || data.values.length < 2) return null;
  const latest = parseFloat(data.values[0].close);
  const oldest = parseFloat(data.values[data.values.length - 1].close);
  return ((latest - oldest) / oldest) * 100;
}

// ─── ANTHROPIC CLAUDE : Analyse earnings individuelle ────────────────────────
export async function analyzeEarnings(ticker, earningsData, history, perf30d, putCall, shortInterest, profile, useWebSearch = false) {

  const SYSTEM_PROMPT =
"Tu es un analyste quant spécialisé earnings. Ton output est lu par un trader, pas par un grand public.\n\n" +
"CAPITAL : 300EUR | Risque max/trade : 5% | Taille std : 65% | Fort edge : 80% | Max 2 positions | Trade Republic 1EUR/ordre\n\n" +
"RÈGLES OBLIGATOIRES :\n" +
"- Perf 30J > +15% => NEUTRE (already priced in), sans exception\n" +
"- SI > 20% float => AVOID dans les deux sens, sans exception\n" +
"- Beat+Beat+Guidance relevée => BUY\n" +
"- Beat+Beat+Guidance stable => BUY modéré\n" +
"- Beat+Beat+Guidance décevante => NEUTRE\n" +
"- Miss EPS => AVOID\n" +
"- Gap ouverture : attendre 30-45min. Gap > 12% => attendre pull-back\n\n" +
"CALCUL PROBABILITÉ (Bayes) :\n" +
"Base rate (% beats sur 4 trimestres) + ajustements :\n" +
"Rev growth >20%=>+6pts / >10%=>+3pts / >0%=>+1pt / négatif=>-4pts\n" +
"EPS momentum hausse >10%=>+3pts / hausse=>+1pt / baisse=>-3pts\n" +
"Put/call <0.7=>+4pts / >1.2=>-3pts\n\n" +
"VERDICTS :\n" +
"EV > 8% ET Edge > 10pts => BUY FORT — 80% capital = 240EUR\n" +
"EV > 5% ET Edge > 7pts => BUY — 65% capital = 195EUR\n" +
"EV > 2% ET Edge > 4pts => BUY LEGER — 40% capital = 120EUR\n" +
"EV entre -2% et +2% => NEUTRE\n" +
"EV < -2% ET Edge < -4pts => AVOID\n" +
"EV < -5% ET Edge < -8pts => AVOID / SHORT possible\n\n" +
"TON : factuel, chiffré, direct. Zéro langue de bois. Zéro formule de politesse.\n" +
"Pas de phrase du type 'il convient de noter', 'Momentum AI recommande', 'il est important de'.\n" +
"Si données insuffisantes : verdict quand même avec mention CONFIANCE FAIBLE.\n\n" +
"FORMAT OBLIGATOIRE — pas de ## ni de ** dans le texte :\n\n" +
"[EMOJI] TICKER -- Nom complet . BOURSE . BMO/AMC . ~HH:MM FR\n\n" +
"Résultats attendus : EPS consensus $X.XX . EPS N-1 $X.XX . Rev. consensus $XM\n\n" +
"Analyse quant :\n" +
"- Base rate : X/4 trimestres battus = XX%\n" +
"- Prob. estimée : XX% vs ~XX% implicite marché\n" +
"- Edge : +/-Xpts\n" +
"- EV : +/-X%\n" +
"- Kelly fractionnel : (p - q) / 4 = XX% => taille XX% capital = XXXEUR\n" +
"- Move implicite : ~+/-X%\n" +
"- Short interest : X% (squeeze risk / safe)\n" +
"- Réaction historique moy. : +/-X%\n" +
"- Perf. 30J : +/-X% [ALREADY PRICED IN si >+15%]\n\n" +
"Contexte :\n" +
"[3-4 lignes : secteur ce trimestre + comparaison T précédent + signal matière première + risque principal. Direct, sans langue de bois.]\n\n" +
"Verdict : BUY FORT / BUY / BUY LEGER / NEUTRE / AVOID / SHORT\n" +
"Position : XX% capital = XXXEUR | Stop : -5% = -XXEUR | Trailing : +4% => break-even\n\n" +
"Timing :\n" +
"BMO : [précision sur entrée]\n" +
"AMC : [précision sur entrée]";

  const userMessage =
"Analyse earnings pour " + ticker + ".\n" +
"Profil : " + (profile ? JSON.stringify(profile) : "non disponible") + "\n" +
"Earnings data : " + JSON.stringify(earningsData) + "\n" +
"Historique 4T : " + JSON.stringify(history) + "\n" +
"Perf 30J : " + (perf30d !== null ? perf30d.toFixed(2) + "%" : "non disponible") + "\n" +
"Put/Call : " + (putCall !== null ? putCall.toFixed(2) : "non disponible") + "\n" +
"Short interest : " + (shortInterest !== null ? shortInterest : "non disponible");

  const body = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      useWebSearch: useWebSearch
    }),
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
  const system =
"Analyste pre-earnings drift. Réponds en format direct : setup VALIDE ou INVALIDE, raison + timing + stop.\n\n" +
"RÈGLES DRIFT :\n" +
"- Entrer J-20 à J-15 si base rate > 65% + secteur momentum + driver MP positif + titre < +10% sur 30J\n" +
"- Stop si titre > +15% avant résultats\n" +
"- Stop loss : -7% | Trailing stop : +5% => break-even\n" +
"- Sortie option A : veille résultats | Option B : garder si signal fort\n" +
"Capital : 300EUR | Entrée drift : 40% = 120EUR";

  const today = new Date();
  const earnings = new Date(earningsDate);
  const daysToEarnings = Math.round((earnings - today) / (1000 * 60 * 60 * 24));

  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system,
      messages: [{
        role: 'user',
        content: `Ticker : ${ticker}\nPerf 30J : ${perf30d !== null ? perf30d.toFixed(2) + '%' : 'non disponible'}\nDate earnings : ${earningsDate}\nJours restants : ${daysToEarnings}J`
      }]
    }),
  });

  if (!response.ok) throw new Error('Claude drift error');
  const data = await response.json();
  return data.content?.[0]?.text ?? 'Erreur analyse drift';
}

// ─── COUCHES L1-L12 : Charger architecture complète depuis Supabase ──────────
export async function getCouchesData() {
  const layersRes = await supabase
    .from('couches_layers')
    .select('*')
    .order('order_index');
  if (layersRes.error) throw new Error(layersRes.error.message);

  const panelsRes = await supabase
    .from('couches_panels')
    .select('*')
    .order('order_index');
  if (panelsRes.error) throw new Error(panelsRes.error.message);

  const companiesRes = await supabase
    .from('couches_companies')
    .select('*');
  if (companiesRes.error) throw new Error(companiesRes.error.message);

  const sectionsRes = await supabase
    .from('couches_sections')
    .select('id, slug, parent_type, parent_id, group_title, list_title, note, order_index, couches_section_tickers(ticker, order_index)')
    .order('order_index');
  if (sectionsRes.error) throw new Error(sectionsRes.error.message);

  const companies = {};
  (companiesRes.data || []).forEach(function (c) {
    companies[c.ticker] = c;
  });

  function sortByOrder(a, b) {
    return a.order_index - b.order_index;
  }

  function buildLists(parentType, parentId) {
    return (sectionsRes.data || [])
      .filter(function (s) { return s.parent_type === parentType && s.parent_id === parentId; })
      .sort(sortByOrder)
      .map(function (s) {
        const tickers = (s.couches_section_tickers || [])
          .sort(sortByOrder)
          .map(function (st) { return st.ticker; });
        return {
          id: s.slug || String(s.id),
          title: s.list_title,
          note: s.note,
          groupTitle: s.group_title,
          tickers: tickers
        };
      });
  }

  const layers = (layersRes.data || []).map(function (l) {
    return {
      id: l.id,
      num: l.num,
      name: l.name,
      cc: l.color_chip,
      bc: l.color_border,
      bg: l.color_bg,
      connBelow: l.conn_below,
      lists: buildLists('layer', l.id)
    };
  });

  const panels = (panelsRes.data || []).map(function (p) {
    const allSections = buildLists('panel', p.id);
    const directLists = [];
    const subsMap = {};
    const subsOrder = [];

    allSections.forEach(function (sec) {
      if (sec.groupTitle) {
        if (!subsMap[sec.groupTitle]) {
          subsMap[sec.groupTitle] = [];
          subsOrder.push(sec.groupTitle);
        }
        subsMap[sec.groupTitle].push(sec);
      } else {
        directLists.push(sec);
      }
    });

    const subs = subsOrder.map(function (title) {
      return { title: title, lists: subsMap[title] };
    });

    return {
      id: p.id,
      badge: p.badge,
      name: p.name,
      cc: p.color_chip,
      bc: p.color_border,
      bg: p.color_bg,
      connectedAfter: p.connected_after_layer_id,
      lists: directLists.length ? directLists : null,
      subs: subs.length ? subs : null
    };
  });

  return { layers: layers, panels: panels, companies: companies };
}
