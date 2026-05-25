'use client';
import { useState } from 'react';
import { getEarningsToday, getEarningsHistory, getPerf30d, getPutCallRatio, getShortInterest, analyzeEarnings } from '../lib/api';

const VERDICT_STYLE = {
  'BUY FORT':  { color: '#3fb950', bg: 'rgba(63,185,80,0.12)', border: '#3fb950' },
  'BUY':       { color: '#58a6ff', bg: 'rgba(88,166,255,0.12)', border: '#58a6ff' },
  'BUY LÉGER': { color: '#388bfd', bg: 'rgba(56,139,253,0.12)', border: '#388bfd' },
  'NEUTRE':    { color: '#e3b341', bg: 'rgba(227,179,65,0.12)',  border: '#e3b341' },
  'AVOID':     { color: '#f85149', bg: 'rgba(248,81,73,0.12)',   border: '#f85149' },
  'SHORT':     { color: '#ff7b72', bg: 'rgba(255,123,114,0.12)', border: '#ff7b72' },
};

function detectVerdict(text) {
  if (text.includes('BUY FORT'))  return 'BUY FORT';
  if (text.includes('BUY LÉGER')) return 'BUY LÉGER';
  if (text.includes('SHORT'))     return 'SHORT';
  if (text.includes('AVOID'))     return 'AVOID';
  if (text.includes('NEUTRE'))    return 'NEUTRE';
  if (text.includes('BUY'))       return 'BUY';
  return 'NEUTRE';
}

export default function EarningsModule() {
  const [earningsList, setEarningsList] = useState([]);
  const [loading, setLoading]           = useState(false);
  const [analyses, setAnalyses]         = useState({});
  const [analyzing, setAnalyzing]       = useState({});
  const [error, setError]               = useState('');
  const [manualTicker, setManualTicker] = useState('');

  async function loadEarnings() {
  setLoading(true);
  setError('');
  try {
    const data = await getEarningsToday();
    const list = data.slice(0, 15);
    setEarningsList(list);
    // Auto-analyse séquentielle pour ne pas flooder les APIs
    for (const item of list) {
      runAnalysis(item.symbol);
      await new Promise(r => setTimeout(r, 800));
    }
  } catch (e) {
    setError('Erreur chargement earnings : ' + e.message);
  }
  setLoading(false);
}

  async function runAnalysis(ticker) {
    setAnalyzing(prev => ({ ...prev, [ticker]: true }));
    try {
      const [history, perf30d, putCall, shortInt] = await Promise.all([
        getEarningsHistory(ticker).catch(() => []),
        getPerf30d(ticker).catch(() => null),
        getPutCallRatio(ticker).catch(() => null),
        getShortInterest(ticker).catch(() => null),
      ]);
      const earningsItem = earningsList.find(e => e.symbol === ticker) || { symbol: ticker };
      const result = await analyzeEarnings(ticker, earningsItem, history, perf30d, putCall, shortInt);
      setAnalyses(prev => ({ ...prev, [ticker]: result }));
    } catch (e) {
      setAnalyses(prev => ({ ...prev, [ticker]: '❌ Erreur : ' + e.message }));
    }
    setAnalyzing(prev => ({ ...prev, [ticker]: false }));
  }

  async function addManual() {
    const ticker = manualTicker.trim().toUpperCase();
    if (!ticker) return;
    if (!earningsList.find(e => e.symbol === ticker)) {
      setEarningsList(prev => [{ symbol: ticker, time: 'BMO' }, ...prev]);
    }
    setManualTicker('');
    await runAnalysis(ticker);
  }

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div style={{ padding: '0' }}>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
          <span style={{ fontSize: '22px' }}>📊</span>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#e6edf3', fontFamily: 'Syne, sans-serif' }}>
            Earnings du Jour
          </h2>
        </div>
        <p style={{ fontSize: '11px', color: '#8b949e', textTransform: 'capitalize' }}>{today}</p>
      </div>

      {/* Saisie manuelle */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input
          value={manualTicker}
          onChange={e => setManualTicker(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && addManual()}
          placeholder="Ticker manuel (ex: NVDA)"
          style={{
            flex: 1,
            background: '#0d1117',
            border: '1px solid #21262d',
            borderRadius: '8px',
            padding: '10px 14px',
            color: '#e6edf3',
            fontSize: '13px',
            outline: 'none',
          }}
        />
        <button onClick={addManual} style={btnStyle('#f0b429', '#0d1117')}>
          Analyser
        </button>
      </div>

      {/* Bouton charger */}
      <button onClick={loadEarnings} disabled={loading} style={{ ...btnStyle('#161b22', '#e6edf3'), width: '100%', marginBottom: '20px', border: '1px solid #21262d' }}>
        {loading ? '⏳ Chargement...' : '🔄 Charger les earnings du jour'}
      </button>

      {error && (
        <div style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid #f85149', borderRadius: '8px', padding: '12px', marginBottom: '16px', fontSize: '12px', color: '#f85149' }}>
          {error}
        </div>
      )}

      {/* Liste earnings */}
      {earningsList.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {earningsList.map(item => {
            const ticker  = item.symbol;
            const analyse = analyses[ticker];
            const busy    = analyzing[ticker];
            const verdict = analyse ? detectVerdict(analyse) : null;
            const vs      = verdict ? VERDICT_STYLE[verdict] : null;

            return (
              <div key={ticker} style={{
                background: '#0d1117',
                border: `1px solid ${vs ? vs.border + '55' : '#21262d'}`,
                borderRadius: '12px',
                overflow: 'hidden',
              }}>
                {/* Ticker row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontWeight: 700, fontSize: '15px', color: '#e6edf3' }}>{ticker}</span>
                    <span style={{ fontSize: '10px', color: '#8b949e', background: '#161b22', padding: '2px 8px', borderRadius: '4px' }}>
                      {item.time === 'BMO' ? '🌅 BMO' : item.time === 'AMC' ? '🌙 AMC' : '📅 ' + (item.time || '?')}
                    </span>
                    {verdict && (
                      <span style={{ fontSize: '11px', fontWeight: 700, color: vs.color, background: vs.bg, border: `1px solid ${vs.border}`, padding: '2px 8px', borderRadius: '4px' }}>
                        {verdict}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => runAnalysis(ticker)}
                    disabled={busy}
                    style={btnStyle('#f0b429', '#080c10')}
                  >
                    {busy ? '⏳' : analyse ? '↻' : 'Analyser'}
                  </button>
                </div>

                {/* Résultat analyse */}
                {analyse && (
                  <div style={{ borderTop: '1px solid #161b22', padding: '16px', background: vs ? vs.bg : 'transparent' }}>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px', lineHeight: '1.7', color: '#c9d1d9', fontFamily: 'IBM Plex Mono, monospace' }}>
                      {analyse}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {earningsList.length === 0 && !loading && (
        <div style={{ textAlign: 'center', color: '#484f58', fontSize: '13px', paddingTop: '40px' }}>
          Aucun earnings chargé. Clique sur "Charger" ou saisis un ticker manuellement.
        </div>
      )}
    </div>
  );
}

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
