'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  getStockProfile,
  getPerf30d,
  getEarningsHistory,
  getShortInterest,
  getPutCallRatio,
  analyzeEarnings,
  classifyBatch,
} from '../lib/api';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const FINNHUB_KEY = process.env.NEXT_PUBLIC_FINNHUB_KEY;

export default function DriftModule() {
  const [watchlist, setWatchlist] = useState([]);
  const [calendrierPortfolio, setCalendrierPortfolio] = useState([]);
  const [calendrierNouveautes, setCalendrierNouveautes] = useState([]);
  const [nouveauteStatus, setNouveauteStatus] = useState('');
  const [scanning, setScanning] = useState(false);
  const [view, setView] = useState('watchlist');

  const [portfolioMap, setPortfolioMap] = useState({});
  const [portfolioSecteurs, setPortfolioSecteurs] = useState([]);

  const [loadingTicker, setLoadingTicker] = useState(null);

  const [resumeTicker, setResumeTicker] = useState(null);
  const [resumeText, setResumeText] = useState('');
  const [resumeLoading, setResumeLoading] = useState(false);

  useEffect(function () {
    loadWatchlist();
    loadPortfolio();
  }, []);

  async function loadWatchlist() {
    const { data } = await supabase
      .from('drift_watchlist')
      .select('*')
      .order('earnings_date', { ascending: true });
    if (data) setWatchlist(data);
  }

  // ─── Charger le portfolio IBKR depuis Supabase (table portfolio_tickers) ────
  async function loadPortfolio() {
    try {
      const res = await fetch('/api/portfolio');
      if (!res.ok) return;
      const data = await res.json();
      const raw = data.raw || [];

      const map = {};
      const secteursSet = {};
      for (let i = 0; i < raw.length; i++) {
        const row = raw[i];
        map[row.ticker] = { name: row.name, secteur: row.secteur, bourse: row.bourse };
        if (row.secteur) secteursSet[row.secteur] = true;
      }
      setPortfolioMap(map);
      setPortfolioSecteurs(Object.keys(secteursSet));
    } catch (e) {
      // pas bloquant — le scan fonctionnera quand même, juste sans priorisation portfolio
    }
  }

  // ─── STEP 1 : Finnhub scan + split portfolio / nouveautés ───────────────────
  async function scanCalendrier() {
    setScanning(true);
    setNouveauteStatus('');
    setCalendrierPortfolio([]);
    setCalendrierNouveautes([]);
    try {
      const today = new Date();
      const future = new Date();
      future.setDate(future.getDate() + 30);
      const from = today.toISOString().split('T')[0];
      const to = future.toISOString().split('T')[0];

      const url = 'https://finnhub.io/api/v1/calendar/earnings?from=' + from + '&to=' + to + '&token=' + FINNHUB_KEY;
      const res = await fetch(url);
      const data = await res.json();
      const list = (data && data.earningsCalendar) ? data.earningsCalendar : [];
      const propres = list.filter(function (e) { return e.symbol && e.date; });

      // Section 1 : titres déjà dans mon portfolio IBKR — affichage immédiat, zéro coût Claude
      const matched = [];
      for (let i = 0; i < propres.length; i++) {
        const item = propres[i];
        const infos = portfolioMap[item.symbol];
        if (infos) {
          matched.push(Object.assign({}, item, {
            name: infos.name,
            secteur: infos.secteur,
            bourse: infos.bourse,
          }));
        }
      }
      matched.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
      setCalendrierPortfolio(matched);
      setView('calendrier');
      setScanning(false);

      // Section 2 : nouveautés — candidats hors portfolio, avec données dispo (filtre anti-bruit)
      const candidats = propres.filter(function (e) {
        return !portfolioMap[e.symbol] && (e.epsEstimate != null || e.revenueEstimate != null);
      }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }).slice(0, 30);

      if (candidats.length > 0) {
        classifierNouveautes(candidats);
      } else {
        setNouveauteStatus('Aucune nouveauté avec données disponibles sur 30J.');
      }
    } catch (e) {
      alert('Erreur scan calendrier');
      setScanning(false);
    }
  }

  // ─── STEP 2 : Classification Claude (nom + secteur) sur la liste réduite ────
  async function classifierNouveautes(candidats) {
    setNouveauteStatus('🔍 Identification des nouveautés dans tes secteurs...');
    try {
      const items = candidats.map(function (c) { return { ticker: c.symbol }; });
      const classified = await classifyBatch(items);

      const retenus = [];
      for (let i = 0; i < candidats.length; i++) {
        const item = candidats[i];
        const match = classified.find(function (c) { return c.ticker === item.symbol; });
        if (!match || !match.name || match.name === match.ticker) continue; // Claude ne connaît pas ce titre
        if (portfolioSecteurs.length > 0 && portfolioSecteurs.indexOf(match.secteur) === -1) continue; // hors secteurs watchlist
        retenus.push(Object.assign({}, item, {
          name: match.name,
          secteur: match.secteur,
          bourse: match.bourse,
        }));
      }

      setCalendrierNouveautes(retenus.slice(0, 15));
      setNouveauteStatus(retenus.length > 0
        ? '✓ ' + retenus.length + ' nouveauté(s) dans tes secteurs'
        : 'Aucune nouveauté pertinente trouvée dans tes secteurs.');
    } catch (e) {
      setNouveauteStatus('⚠ Classification indisponible');
    }
  }

  // ─── Résumé complet au clic sur un ticker (réutilise analyzeEarnings) ───────
  async function ouvrirResume(item) {
    if (resumeTicker === item.symbol) {
      setResumeTicker(null);
      return;
    }
    setResumeTicker(item.symbol);
    setResumeText('');
    setResumeLoading(true);
    try {
      const results = await Promise.all([
        getStockProfile(item.symbol).catch(function () { return null; }),
        getPerf30d(item.symbol).catch(function () { return null; }),
        getEarningsHistory(item.symbol).catch(function () { return []; }),
        getShortInterest(item.symbol).catch(function () { return null; }),
        getPutCallRatio(item.symbol).catch(function () { return null; }),
      ]);
      const profile = results[0];
      const perf30d = results[1];
      const history = results[2];
      const shortInterest = results[3];
      const putCall = results[4];

      const text = await analyzeEarnings(item.symbol, item, history, perf30d, putCall, shortInterest, profile, true);
      setResumeText(text);
    } catch (e) {
      setResumeText('Erreur génération du résumé.');
    }
    setResumeLoading(false);
  }

  // ─── Analyse drift légère pour la fiche watchlist ────────────────────────────
  async function analyserDrift(ticker, earningsDate) {
    try {
      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: "Tu es un analyste drift pre-earnings. Retourne UNIQUEMENT un JSON valide sans backticks ni markdown : {\"drift_score\": 0-10, \"signal\": \"FORT ou MODERE ou FAIBLE ou NEUTRE\", \"secteur\": \"secteur\", \"base_rate\": number, \"analyse\": \"narrative 2-3 lignes\"}",
          messages: [{ role: 'user', content: "Analyse drift pre-earnings pour " + ticker + " avec publication le " + earningsDate }]
        }),
      });
      const data = await response.json();
      const text = data.content && data.content[0] ? data.content[0].text : '{}';
      const clean = text.replace(/```json|```/g, '').trim();
      return JSON.parse(clean);
    } catch (e) {
      return { drift_score: 5, signal: 'MODERE', secteur: 'Inconnu', base_rate: 50, analyse: 'Analyse indisponible' };
    }
  }

  async function ajouterWatchlist(item) {
    setLoadingTicker(item.symbol);
    try {
      const analyse = await analyserDrift(item.symbol, item.date);
      await supabase.from('drift_watchlist').upsert({
        ticker: item.symbol,
        company_name: item.name || item.symbol,
        earnings_date: item.date,
        secteur: item.secteur || analyse.secteur,
        base_rate: analyse.base_rate,
        drift_score: analyse.drift_score,
        signal: analyse.signal,
        analyse_narrative: analyse.analyse,
        statut: 'WATCHING',
      }, { onConflict: 'ticker' });
      await loadWatchlist();
      setResumeTicker(null);
    } catch (e) {
      alert('Erreur ajout watchlist');
    }
    setLoadingTicker(null);
  }

  async function updateStatut(id, statut) {
    await supabase.from('drift_watchlist').update({ statut, last_updated: new Date().toISOString() }).eq('id', id);
    await loadWatchlist();
  }

  async function supprimerTitre(id) {
    await supabase.from('drift_watchlist').delete().eq('id', id);
    await loadWatchlist();
  }

  const signalColor = { 'FORT': '#3fb950', 'MODERE': '#58a6ff', 'FAIBLE': '#e3b341', 'NEUTRE': '#484f58' };
  const statutColor = { 'WATCHING': '#58a6ff', 'ENTERED': '#3fb950', 'EXITED': '#484f58' };
  const hourColor = { 'BMO': '#3fb950', 'AMC': '#f0b429' };

  function dejaEnWatchlist(symbol) {
    return watchlist.some(function (w) { return w.ticker === symbol; });
  }

  // ─── Card réutilisable pour Portfolio + Nouveautés ───────────────────────────
  function renderTickerCard(item, badgeLabel, badgeColor) {
    const hourLabel = item.hour ? item.hour.toUpperCase() : null;
    const estOuvert = resumeTicker === item.symbol;
    const dejaAjoute = dejaEnWatchlist(item.symbol);

    return (
      <div key={item.symbol} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '6px', padding: '10px', marginBottom: '8px' }}>
        <div onClick={function () { ouvrirResume(item); }} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{item.symbol}</span>
              <span style={{ color: '#8b949e', fontSize: '11px', marginLeft: '8px' }}>{item.name || ''}</span>
            </div>
            <span style={{ background: badgeColor, color: '#000', fontSize: '9px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', flexShrink: 0 }}>
              {badgeLabel}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap' }}>
            <span style={{ color: '#8b949e', fontSize: '11px' }}>📅 {item.date}</span>
            {hourLabel && (
              <span style={{ background: hourColor[hourLabel] || '#484f58', color: '#000', fontSize: '9px', fontWeight: 'bold', padding: '1px 6px', borderRadius: '4px' }}>
                {hourLabel}
              </span>
            )}
            {item.secteur && <span style={{ color: '#8b949e', fontSize: '11px' }}>{item.secteur}</span>}
            {item.epsEstimate != null && <span style={{ color: '#8b949e', fontSize: '11px' }}>EPS est: ${item.epsEstimate}</span>}
            {dejaAjoute && <span style={{ color: '#3fb950', fontSize: '10px' }}>✓ en watchlist</span>}
          </div>
        </div>

        {estOuvert && (
          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #30363d' }}>
            {resumeLoading ? (
              <p style={{ color: '#8b949e', fontSize: '11px' }}>Analyse en cours...</p>
            ) : (
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '11px', color: '#c9d1d9', lineHeight: '1.5', margin: 0, marginBottom: '10px' }}>
                {resumeText}
              </pre>
            )}
            <div style={{ display: 'flex', gap: '6px' }}>
              {!dejaAjoute && (
                <button onClick={function () { ajouterWatchlist(item); }} disabled={loadingTicker === item.symbol}
                  style={{ padding: '6px 12px', background: '#f0b429', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px' }}>
                  {loadingTicker === item.symbol ? '...' : '+ Ajouter à la watchlist'}
                </button>
              )}
              <button onClick={function () { setResumeTicker(null); }}
                style={{ padding: '6px 12px', background: '#21262d', color: '#8b949e', border: '1px solid #30363d', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                ✕ Fermer
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', fontFamily: 'monospace', color: '#e6edf3' }}>

      {/* HEADER */}
      <h2 style={{ color: '#f0b429', fontSize: '18px', marginBottom: '4px' }}>📈 Pre-Earnings Drift</h2>
      <p style={{ color: '#8b949e', fontSize: '12px', marginBottom: '16px' }}>
        ~60% des titres qui vont beater dérivent haussièrement 2-4 semaines avant publication
      </p>

      {/* REGLES */}
      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
        <p style={{ color: '#f0b429', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>Règles drift</p>
        {[
          { color: '#8b949e', text: 'J-30 à J-25 → Identifier si base rate > 65%' },
          { color: '#3fb950', text: 'J-20 à J-15 → ENTRER — 40% capital (120€)' },
          { color: '#e3b341', text: 'J-0 Option A → Vendre veille résultats (sécuriser)' },
          { color: '#e3b341', text: 'J-0 Option B → Garder si signal earnings fort' },
          { color: '#f85149', text: 'STOP si titre >+15% avant résultats → sortir' },
          { color: '#e3b341', text: 'Stop loss drift : -7% | Trailing stop à +5% → break-even' },
        ].map(function (r, i) {
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '4px' }}>
              <span style={{ color: r.color, fontSize: '11px' }}>●</span>
              <span style={{ color: '#c9d1d9', fontSize: '11px' }}>{r.text}</span>
            </div>
          );
        })}
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button onClick={function () { setView('watchlist'); }}
          style={{ flex: 1, padding: '8px', background: view === 'watchlist' ? '#f0b429' : '#21262d', color: view === 'watchlist' ? '#000' : '#e6edf3', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
          Watchlist ({watchlist.length})
        </button>
        <button onClick={scanCalendrier} disabled={scanning}
          style={{ flex: 1, padding: '8px', background: view === 'calendrier' ? '#f0b429' : '#21262d', color: view === 'calendrier' ? '#000' : '#e6edf3', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
          {scanning ? 'Scan...' : 'Calendrier 30J'}
        </button>
      </div>

      {/* WATCHLIST */}
      {view === 'watchlist' && (
        <div>
          {watchlist.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#8b949e', padding: '24px' }}>
              <p style={{ fontSize: '12px' }}>Aucun titre en watchlist</p>
              <p style={{ fontSize: '11px', marginTop: '4px' }}>Clique sur "Calendrier 30J" pour scanner</p>
            </div>
          ) : (
            watchlist.map(function (item) {
              return (
                <div key={item.id} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '12px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div>
                      <span style={{ fontWeight: 'bold', fontSize: '15px' }}>{item.ticker}</span>
                      <span style={{ color: '#8b949e', fontSize: '11px', marginLeft: '8px' }}>{item.company_name}</span>
                    </div>
                    <span style={{ background: signalColor[item.signal] || '#484f58', color: '#000', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                      {item.signal}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#8b949e', marginBottom: '6px' }}>
                    <span>📅 {item.earnings_date}</span>
                    <span>🎯 {item.drift_score}/10</span>
                    <span>📊 {item.base_rate}%</span>
                    <span>{item.secteur}</span>
                  </div>
                  <p style={{ fontSize: '11px', color: '#c9d1d9', marginBottom: '8px', lineHeight: '1.5' }}>{item.analyse_narrative}</p>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ background: statutColor[item.statut], color: '#000', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>{item.statut}</span>
                    {item.statut === 'WATCHING' && (
                      <button onClick={function () { updateStatut(item.id, 'ENTERED'); }}
                        style={{ padding: '2px 8px', background: '#3fb950', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>
                        ENTRER
                      </button>
                    )}
                    {item.statut === 'ENTERED' && (
                      <button onClick={function () { updateStatut(item.id, 'EXITED'); }}
                        style={{ padding: '2px 8px', background: '#f85149', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>
                        SORTIR
                      </button>
                    )}
                    <button onClick={function () { supprimerTitre(item.id); }}
                      style={{ padding: '2px 8px', background: '#21262d', color: '#8b949e', border: '1px solid #30363d', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}>
                      ✕
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* CALENDRIER */}
      {view === 'calendrier' && (
        <div>
          {/* SECTION PORTFOLIO */}
          <p style={{ color: '#f0b429', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>
            📂 Mon portfolio ({calendrierPortfolio.length})
          </p>
          {calendrierPortfolio.length === 0 ? (
            <p style={{ color: '#8b949e', fontSize: '11px', marginBottom: '16px' }}>Aucune publication sur 30J parmi tes tickers IBKR.</p>
          ) : (
            <div style={{ marginBottom: '16px' }}>
              {calendrierPortfolio.map(function (item) { return renderTickerCard(item, 'PORTFOLIO', '#58a6ff'); })}
            </div>
          )}

          {/* SECTION NOUVEAUTES */}
          <p style={{ color: '#f0b429', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>
            ✨ Nouveautés — tes secteurs ({calendrierNouveautes.length})
          </p>
          {nouveauteStatus && (
            <p style={{ fontSize: '11px', color: '#58a6ff', marginBottom: '10px' }}>{nouveauteStatus}</p>
          )}
          {calendrierNouveautes.map(function (item) { return renderTickerCard(item, 'NOUVEAU', '#3fb950'); })}
        </div>
      )}
    </div>
  );
}
