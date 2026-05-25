'use client';
import { useState } from 'react';
import {
  getEarningsToday,
  getEarningsHistory,
  getPerf30d,
  getPutCallRatio,
  getShortInterest,
  getStockProfile,
  analyzeEarnings,
} from '../lib/api';

const VERDICT_STYLE = {
  'BUY FORT':  { color: '#3fb950', bg: 'rgba(63,185,80,0.10)',   border: '#3fb950' },
  'BUY':       { color: '#58a6ff', bg: 'rgba(88,166,255,0.10)',  border: '#58a6ff' },
  'BUY LÉGER': { color: '#388bfd', bg: 'rgba(56,139,253,0.10)',  border: '#388bfd' },
  'NEUTRE':    { color: '#e3b341', bg: 'rgba(227,179,65,0.10)',  border: '#e3b341' },
  'AVOID':     { color: '#f85149', bg: 'rgba(248,81,73,0.10)',   border: '#f85149' },
  'SHORT':     { color: '#ff7b72', bg: 'rgba(255,123,114,0.10)', border: '#ff7b72' },
};

const VERDICT_ORDER = ['BUY FORT', 'BUY', 'BUY LÉGER', 'NEUTRE', 'AVOID', 'SHORT'];

function detectVerdict(text) {
  if (!text) return 'NEUTRE';
  if (text.includes('BUY FORT'))  return 'BUY FORT';
  if (text.includes('BUY LÉGER')) return 'BUY LÉGER';
  if (text.includes('SHORT'))     return 'SHORT';
  if (text.includes('AVOID'))     return 'AVOID';
  if (text.includes('NEUTRE'))    return 'NEUTRE';
  if (text.includes('BUY'))       return 'BUY';
  return 'NEUTRE';
}

// Vérifie si les données sont suffisantes pour une analyse sans web search
function hasEnoughData(history, perf30d, profile) {
  const hasHistory = Array.isArray(history) && history.length >= 2;
  const hasPerf    = perf30d !== null;
  const hasProfile = profile && profile.sector;
  return hasHistory && hasPerf && hasProfile;
}

export default function EarningsModule() {
  const [earningsList, setEarningsList]   = useState([]);
  const [loading, setLoading]             = useState(false);
  const [globalAnalyzing, setGlobalAnalyzing] = useState(false);
  const [analyses, setAnalyses]           = useState({});
  const [analyzing, setAnalyzing]         = useState({});
  const [expanded, setExpanded]           = useState({});
  const [error, setError]                 = useState('');
  const [manualTicker, setManualTicker]   = useState('');
  // tickers sans données suffisantes
  const [insufficientTickers, setInsufficientTickers] = useState([]);

  // ── Chargement + auto-analyse ──────────────────────────────────────────────
  async function loadEarnings() {
    setLoading(true);
    setGlobalAnalyzing(true);
    setError('');
    setAnalyses({});
    setExpanded({});
    setInsufficientTickers([]);

    try {
      const data = await getEarningsToday();
      const list = data.slice(0, 20);
      setEarningsList(list);

      // Collecte tickers avec/sans données
      const withData    = [];
      const withoutData = [];

      // Pré-fetch profil + historique pour tous → décider
      await Promise.all(list.map(async (item) => {
        const ticker = item.symbol;
        const [history, perf30d, profile] = await Promise.all([
          getEarningsHistory(ticker).catch(() => []),
          getPerf30d(ticker).catch(() => null),
          getStockProfile(ticker).catch(() => null),
        ]);
        if (hasEnoughData(history, perf30d, profile)) {
          withData.push({ item, history, perf30d, profile });
        } else {
          withoutData.push({ item, history, perf30d, profile });
        }
      }));

      setInsufficientTickers(withoutData.map(x => x.item));

      // Auto-analyse séquentielle uniquement sur tickers avec données
      for (const { item, history, perf30d, profile } of withData) {
        const ticker = item.symbol;
        setAnalyzing(prev => ({ ...prev, [ticker]: true }));

        try {
          const [putCall, shortInt] = await Promise.all([
            getPutCallRatio(ticker).catch(() => null),
            getShortInterest(ticker).catch(() => null),
          ]);
          const result = await analyzeEarnings(
            ticker, item, history, perf30d, putCall, shortInt, profile, false
          );
          setAnalyses(prev => ({ ...prev, [ticker]: result }));
        } catch (e) {
          setAnalyses(prev => ({ ...prev, [ticker]: '❌ Erreur : ' + e.message }));
        }

        setAnalyzing(prev => ({ ...prev, [ticker]: false }));
        await new Promise(r => setTimeout(r, 800));
      }

    } catch (e) {
      setError('Erreur chargement earnings : ' + e.message);
    }

    setLoading(false);
    setGlobalAnalyzing(false);
  }

  // ── Analyse avec web search (tickers insuffisants) ─────────────────────────
  async function runWebSearchAnalysis(item) {
    const ticker = item.symbol;
    setAnalyzing(prev => ({ ...prev, [ticker]: true }));
    try {
      const [history, perf30d, profile, putCall, shortInt] = await Promise.all([
        getEarningsHistory(ticker).catch(() => []),
        getPerf30d(ticker).catch(() => null),
        getStockProfile(ticker).catch(() => null),
        getPutCallRatio(ticker).catch(() => null),
        getShortInterest(ticker).catch(() => null),
      ]);
      // useWebSearch = true → active le web search dans api.js
      const result = await analyzeEarnings(
        ticker, item, history, perf30d, putCall, shortInt, profile, true
      );
      setAnalyses(prev => ({ ...prev, [ticker]: result }));
      // Retirer de la liste insuffisante et ajouter à la liste principale
      setEarningsList(prev => {
        if (!prev.find(e => e.symbol === ticker)) return [item, ...prev];
        return prev;
      });
      setInsufficientTickers(prev => prev.filter(e => e.symbol !== ticker));
    } catch (e) {
      setAnalyses(prev => ({ ...prev, [ticker]: '❌ ' + e.message }));
    }
    setAnalyzing(prev => ({ ...prev, [ticker]: false }));
  }

  // ── Ticker manuel ──────────────────────────────────────────────────────────
  async function addManual() {
    const ticker = manualTicker.trim().toUpperCase();
    if (!ticker) return;
    setManualTicker('');
    setAnalyzing(prev => ({ ...prev, [ticker]: true }));

    const syntheticItem = { symbol: ticker, time: '?' };
    setEarningsList(prev => {
      if (prev.find(e => e.symbol === ticker)) return prev;
      return [syntheticItem, ...prev];
    });

    try {
      const [history, perf30d, profile, putCall, shortInt] = await Promise.all([
        getEarningsHistory(ticker).catch(() => []),
        getPerf30d(ticker).catch(() => null),
        getStockProfile(ticker).catch(() => null),
        getPutCallRatio(ticker).catch(() => null),
        getShortInterest(ticker).catch(() => null),
      ]);
      // Toujours avec web search pour les tickers manuels
      const result = await analyzeEarnings(
        ticker, syntheticItem, history, perf30d, putCall, shortInt, profile, true
      );
      setAnalyses(prev => ({ ...prev, [ticker]: result }));
    } catch (e) {
      setAnalyses(prev => ({ ...prev, [ticker]: '❌ ' + e.message }));
    }
    setAnalyzing(prev => ({ ...prev, [ticker]: false }));
  }

  function toggleExpand(ticker) {
    setExpanded(prev => ({ ...prev, [ticker]: !prev[ticker] }));
  }

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  // Tickers analysés (ont un résultat)
  const analysedTickers = earningsList.filter(item => analyses[item.symbol]);

  return (
    <div style={{ padding: '0' }}>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
          <span style={{ fontSize: '22px' }}>📊</span>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#e6edf3', fontFamily: 'Syne, sans-serif', margin: 0 }}>
            Earnings du Jour
          </h2>
        </div>
        <p style={{ fontSize: '11px', color: '#8b949e', textTransform: 'capitalize', margin: 0 }}>{today}</p>
      </div>

      {/* Saisie manuelle */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input
          value={manualTicker}
          onChange={e => setManualTicker(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && addManual()}
          placeholder="Ticker manuel (ex: NVDA)"
          style={inputStyle}
        />
        <button onClick={addManual} style={btnStyle('#f0b429', '#0d1117')}>
          Analyser
        </button>
      </div>

      {/* Bouton charger */}
      <button
        onClick={loadEarnings}
        disabled={loading || globalAnalyzing}
        style={{ ...btnStyle('#161b22', '#e6edf3'), width: '100%', marginBottom: '20px', border: '1px solid #21262d' }}
      >
        {loading ? '⏳ Chargement...' : globalAnalyzing ? '🔄 Analyse en cours...' : '🔄 Charger les earnings du jour'}
      </button>

      {error && (
        <div style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid #f85149', borderRadius: '8px', padding: '12px', marginBottom: '16px', fontSize: '12px', color: '#f85149' }}>
          {error}
        </div>
      )}

      {/* Spinner global */}
      {globalAnalyzing && (
        <div style={{ textAlign: 'center', color: '#8b949e', fontSize: '12px', padding: '20px', marginBottom: '16px' }}>
          🔄 Analyse en cours — les résultats apparaîtront ici une fois toutes les analyses terminées...
        </div>
      )}

      {/* Résultats triés par verdict — affichés seulement quand toutes les analyses sont finies */}
      {!globalAnalyzing && analysedTickers.length > 0 && (
        <div>
          {VERDICT_ORDER.map(group => {
            const items = analysedTickers.filter(item => detectVerdict(analyses[item.symbol]) === group);
            if (items.length === 0) return null;
            const vs = VERDICT_STYLE[group];

            return (
              <div key={group} style={{ marginBottom: '24px' }}>
                {/* Label groupe */}
                <div style={{
                  fontSize: '11px', fontWeight: 700, color: vs.color,
                  letterSpacing: '1px', marginBottom: '8px',
                  borderBottom: `1px solid ${vs.border}33`, paddingBottom: '6px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  {group}
                  <span style={{ fontWeight: 400, color: '#484f58' }}>({items.length})</span>
                </div>

                {items.map(item => {
                  const ticker  = item.symbol;
                  const analyse = analyses[ticker];
                  const isOpen  = expanded[ticker];

                  return (
                    <div key={ticker} style={{
                      background: '#0d1117',
                      border: `1px solid ${vs.border}44`,
                      borderRadius: '12px',
                      marginBottom: '8px',
                      overflow: 'hidden',
                    }}>
                      {/* Row ticker */}
                      <div
                        onClick={() => toggleExpand(ticker)}
                        style={{
                          display: 'flex', alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 16px', cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontWeight: 700, fontSize: '15px', color: '#e6edf3' }}>{ticker}</span>
                          <span style={{ fontSize: '10px', color: '#8b949e', background: '#161b22', padding: '2px 8px', borderRadius: '4px' }}>
                            {item.time === 'BMO' ? '🌅 BMO' : item.time === 'AMC' ? '🌙 AMC' : '📅 ' + (item.time || '?')}
                          </span>
                          <span style={{
                            fontSize: '11px', fontWeight: 700,
                            color: vs.color, background: vs.bg,
                            border: `1px solid ${vs.border}`,
                            padding: '2px 8px', borderRadius: '4px',
                          }}>
                            {group}
                          </span>
                        </div>
                        <span style={{ color: '#484f58', fontSize: '14px' }}>{isOpen ? '▲' : '▼'}</span>
                      </div>

                      {/* Analyse dépliée */}
                      {isOpen && analyse && (
                        <div style={{
                          borderTop: '1px solid #161b22',
                          padding: '16px',
                          background: vs.bg,
                        }}>
                          <pre style={{
                            whiteSpace: 'pre-wrap', fontSize: '12px',
                            lineHeight: '1.7', color: '#c9d1d9',
                            fontFamily: 'IBM Plex Mono, monospace', margin: 0,
                          }}>
                            {analyse}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Section tickers insuffisants */}
      {insufficientTickers.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <div style={{
            fontSize: '11px', fontWeight: 700, color: '#484f58',
            letterSpacing: '1px', marginBottom: '8px',
            borderBottom: '1px solid #21262d', paddingBottom: '6px',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            ⚠️ DONNÉES INSUFFISANTES
            <span style={{ fontWeight: 400 }}>({insufficientTickers.length})</span>
          </div>
          <p style={{ fontSize: '11px', color: '#484f58', marginBottom: '12px' }}>
            Ces tickers manquent de données. Tu peux en demander une analyse approfondie via web search.
          </p>

          {insufficientTickers.map(item => {
            const ticker = item.symbol;
            const busy   = analyzing[ticker];
            const result = analyses[ticker];
            const verdict = result ? detectVerdict(result) : null;
            const vs = verdict ? VERDICT_STYLE[verdict] : null;

            return (
              <div key={ticker} style={{
                background: '#080c10',
                border: '1px solid #21262d',
                borderRadius: '12px',
                marginBottom: '8px',
                overflow: 'hidden',
                opacity: busy ? 0.7 : 1,
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', padding: '12px 16px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: '#484f58' }}>{ticker}</span>
                    <span style={{ fontSize: '10px', color: '#21262d', background: '#0d1117', padding: '2px 8px', borderRadius: '4px' }}>
                      {item.time === 'BMO' ? '🌅 BMO' : item.time === 'AMC' ? '🌙 AMC' : '📅 ?'}
                    </span>
                    {verdict && vs && (
                      <span style={{
                        fontSize: '11px', fontWeight: 700,
                        color: vs.color, background: vs.bg,
                        border: `1px solid ${vs.border}`,
                        padding: '2px 8px', borderRadius: '4px',
                      }}>
                        {verdict}
                      </span>
                    )}
                  </div>
                  {!result && (
                    <button
                      onClick={() => runWebSearchAnalysis(item)}
                      disabled={busy}
                      style={btnStyle(busy ? '#161b22' : '#21262d', busy ? '#484f58' : '#8b949e')}
                    >
                      {busy ? '⏳' : '🔍 Web search'}
                    </button>
                  )}
                  {result && (
                    <span
                      onClick={() => toggleExpand(ticker)}
                      style={{ color: '#484f58', fontSize: '14px', cursor: 'pointer' }}
                    >
                      {expanded[ticker] ? '▲' : '▼'}
                    </span>
                  )}
                </div>

                {result && expanded[ticker] && (
                  <div style={{
                    borderTop: '1px solid #161b22',
                    padding: '16px',
                    background: vs ? vs.bg : 'transparent',
                  }}>
                    <pre style={{
                      whiteSpace: 'pre-wrap', fontSize: '12px',
                      lineHeight: '1.7', color: '#c9d1d9',
                      fontFamily: 'IBM Plex Mono, monospace', margin: 0,
                    }}>
                      {result}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {earningsList.length === 0 && !loading && !globalAnalyzing && (
        <div style={{ textAlign: 'center', color: '#484f58', fontSize: '13px', paddingTop: '40px' }}>
          Aucun earnings chargé. Clique sur "Charger" ou saisis un ticker manuellement.
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  flex: 1,
  background: '#0d1117',
  border: '1px solid #21262d',
  borderRadius: '8px',
  padding: '10px 14px',
  color: '#e6edf3',
  fontSize: '13px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

function btnStyle(bg, color) {
  return {
    background: bg,
    color,
    border: 'none',
    borderRadius: '8px',
    padding: '10px 16px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
}
