'use client';
import { useState } from 'react';
import {
  getEarningsSession,
  getEarningsHistory,
  getPerf30d,
  getPutCallRatio,
  getShortInterest,
  getStockProfile,
  analyzeEarnings,
} from '../lib/api';

const VERDICT_STYLE = {
  'BUY FORT':  { color: '#3fb950', bg: 'rgba(63,185,80,0.08)',   border: '#3fb950', emoji: '🟢' },
  'BUY':       { color: '#58a6ff', bg: 'rgba(88,166,255,0.08)',  border: '#58a6ff', emoji: '🔵' },
  'BUY LEGER': { color: '#388bfd', bg: 'rgba(56,139,253,0.08)',  border: '#388bfd', emoji: '🔵' },
  'NEUTRE':    { color: '#e3b341', bg: 'rgba(227,179,65,0.08)',  border: '#e3b341', emoji: '🟡' },
  'AVOID':     { color: '#f85149', bg: 'rgba(248,81,73,0.08)',   border: '#f85149', emoji: '🔴' },
  'SHORT':     { color: '#ff7b72', bg: 'rgba(255,123,114,0.08)', border: '#ff7b72', emoji: '⛔' },
};

const VERDICT_ORDER = ['BUY FORT', 'BUY', 'BUY LEGER', 'NEUTRE', 'AVOID', 'SHORT'];

function detectVerdict(text) {
  if (!text) return 'NEUTRE';
  if (text.includes('BUY FORT'))  return 'BUY FORT';
  if (text.includes('BUY LEGER') || text.includes('BUY LEGER')) return 'BUY LEGER';
  if (text.includes('SHORT'))     return 'SHORT';
  if (text.includes('AVOID'))     return 'AVOID';
  if (text.includes('NEUTRE'))    return 'NEUTRE';
  if (text.includes('BUY'))       return 'BUY';
  return 'NEUTRE';
}

export default function EarningsModule() {
  const [sessionText, setSessionText]   = useState('');
  const [tickers, setTickers]           = useState([]);
  const [analyses, setAnalyses]         = useState({});
  const [profiles, setProfiles]         = useState({});
  const [analyzing, setAnalyzing]       = useState({});
  const [openTicker, setOpenTicker]     = useState(null);
  const [loading, setLoading]           = useState(false);
  const [analyzing2, setAnalyzing2]     = useState(false);
  const [error, setError]               = useState('');
  const [manualTicker, setManualTicker] = useState('');

  function toggleTicker(ticker) {
    setOpenTicker(function(prev) { return prev === ticker ? null : ticker; });
  }

  async function loadSession() {
    setLoading(true);
    setError('');
    setSessionText('');
    setTickers([]);
    setAnalyses({});
    setProfiles({});
    setOpenTicker(null);

    try {
      var result = await getEarningsSession();
      setSessionText(result.sessionText);
      setTickers(result.tickers);

      // Lancer les analyses individuelles en arriere-plan
      if (result.tickers.length > 0) {
        setAnalyzing2(true);
        for (var i = 0; i < result.tickers.length; i++) {
          var ticker = result.tickers[i];
          setAnalyzing(function(prev) { var n = Object.assign({}, prev); n[ticker] = true; return n; });
          try {
            var history  = await getEarningsHistory(ticker).catch(function() { return []; });
            var perf30d  = await getPerf30d(ticker).catch(function() { return null; });
            var profile  = await getStockProfile(ticker).catch(function() { return null; });
            var putCall  = await getPutCallRatio(ticker).catch(function() { return null; });
            var shortInt = await getShortInterest(ticker).catch(function() { return null; });
            setProfiles(function(prev) { var n = Object.assign({}, prev); n[ticker] = profile; return n; });
            var res = await analyzeEarnings(ticker, { symbol: ticker, time: '?' }, history, perf30d, putCall, shortInt, profile, false);
            setAnalyses(function(prev) { var n = Object.assign({}, prev); n[ticker] = res; return n; });
          } catch(e) {
            setAnalyses(function(prev) { var n = Object.assign({}, prev); n[ticker] = 'Erreur : ' + e.message; return n; });
          }
          setAnalyzing(function(prev) { var n = Object.assign({}, prev); n[ticker] = false; return n; });
          await new Promise(function(r) { setTimeout(r, 800); });
        }
        setAnalyzing2(false);
      }
    } catch(e) {
      setError('Erreur : ' + e.message);
    }
    setLoading(false);
  }

  async function addManual() {
    var ticker = manualTicker.trim().toUpperCase();
    if (!ticker || ticker.length < 2) return;
    setManualTicker('');
    if (tickers.indexOf(ticker) === -1) {
      setTickers(function(prev) { return [ticker].concat(prev); });
    }
    setAnalyzing(function(prev) { var n = Object.assign({}, prev); n[ticker] = true; return n; });
    try {
      var history  = await getEarningsHistory(ticker).catch(function() { return []; });
      var perf30d  = await getPerf30d(ticker).catch(function() { return null; });
      var profile  = await getStockProfile(ticker).catch(function() { return null; });
      var putCall  = await getPutCallRatio(ticker).catch(function() { return null; });
      var shortInt = await getShortInterest(ticker).catch(function() { return null; });
      setProfiles(function(prev) { var n = Object.assign({}, prev); n[ticker] = profile; return n; });
      var res = await analyzeEarnings(ticker, { symbol: ticker, time: '?' }, history, perf30d, putCall, shortInt, profile, true);
      setAnalyses(function(prev) { var n = Object.assign({}, prev); n[ticker] = res; return n; });
    } catch(e) {
      setAnalyses(function(prev) { var n = Object.assign({}, prev); n[ticker] = 'Erreur : ' + e.message; return n; });
    }
    setAnalyzing(function(prev) { var n = Object.assign({}, prev); n[ticker] = false; return n; });
  }

  var today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  var analysedTickers = tickers.filter(function(t) { return analyses[t]; });
  var pendingTickers  = tickers.filter(function(t) { return analyzing[t]; });

  return (
    <div style={{ padding: '0' }}>

      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <span style={{ fontSize: '20px' }}>📊</span>
          <h2 style={{ fontSize: '19px', fontWeight: 800, color: '#e6edf3', fontFamily: 'Syne, sans-serif', margin: 0 }}>
            Earnings du Jour
          </h2>
        </div>
        <p style={{ fontSize: '11px', color: '#8b949e', textTransform: 'capitalize', margin: 0 }}>{today}</p>
      </div>

      {/* Saisie manuelle */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <input
          value={manualTicker}
          onChange={function(e) { setManualTicker(e.target.value.toUpperCase()); }}
          onKeyDown={function(e) { if (e.key === 'Enter') addManual(); }}
          placeholder="Ticker manuel (ex: NVDA)"
          style={inputStyle}
        />
        <button onClick={addManual} style={btnStyle('#f0b429', '#0d1117')}>Analyser</button>
      </div>

      {/* Bouton charger */}
      <button
        onClick={loadSession}
        disabled={loading}
        style={Object.assign({}, btnStyle('#161b22', '#e6edf3'), { width: '100%', marginBottom: '20px', border: '1px solid #21262d' })}
      >
        {loading ? '⏳ Recherche en cours...' : '🔄 Charger les earnings du jour'}
      </button>

      {error && (
        <div style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid #f85149', borderRadius: '8px', padding: '12px', marginBottom: '16px', fontSize: '12px', color: '#f85149' }}>
          {error}
        </div>
      )}

      {/* PARTIE 1 — Session du jour (texte complet scrollable) */}
      {sessionText !== '' && (
        <div style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', paddingBottom: '6px', borderBottom: '1px solid #21262d' }}>
            <span style={{ fontSize: '13px' }}>🔍</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#e6edf3', letterSpacing: '1px' }}>SESSION DU JOUR</span>
          </div>
          <div style={{ background: '#080c10', border: '1px solid #1e2530', borderRadius: '12px', padding: '16px' }}>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12.5px', lineHeight: '1.9', color: '#c9d1d9', fontFamily: 'IBM Plex Mono, monospace', margin: 0 }}>
              {sessionText}
            </pre>
          </div>
        </div>
      )}

      {/* PARTIE 2 — Cartes individuelles triees par verdict */}
      {analysedTickers.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', paddingBottom: '6px', borderBottom: '1px solid #21262d' }}>
            <span style={{ fontSize: '13px' }}>📋</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#e6edf3', letterSpacing: '1px' }}>ANALYSES DÉTAILLÉES</span>
            {analyzing2 && (
              <span style={{ fontSize: '10px', color: '#484f58', marginLeft: 'auto' }}>🔄 en cours...</span>
            )}
          </div>

          {VERDICT_ORDER.map(function(group) {
            var items = analysedTickers.filter(function(t) {
              return detectVerdict(analyses[t]) === group;
            });
            if (items.length === 0) return null;
            var vs = VERDICT_STYLE[group];

            return (
              <div key={group} style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', paddingBottom: '5px', borderBottom: '1px solid ' + vs.border + '33' }}>
                  <span>{vs.emoji}</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: vs.color, letterSpacing: '1px' }}>{group}</span>
                  <span style={{ fontSize: '10px', color: '#484f58' }}>({items.length})</span>
                </div>

                {items.map(function(ticker) {
                  var analyse  = analyses[ticker];
                  var isOpen   = openTicker === ticker;
                  var profile  = profiles[ticker];
                  var name     = profile && profile.name ? profile.name : '';
                  var exchange = profile && profile.exchange ? profile.exchange : '';

                  return (
                    <div key={ticker} style={{ background: '#0d1117', border: '1px solid ' + (isOpen ? vs.border + '66' : '#1e2530'), borderRadius: '12px', marginBottom: '8px', overflow: 'hidden' }}>

                      <div onClick={function() { toggleTicker(ticker); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', cursor: 'pointer', background: isOpen ? vs.bg : 'transparent' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 800, fontSize: '14px', color: '#e6edf3', fontFamily: 'IBM Plex Mono, monospace' }}>{ticker}</span>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: vs.color, background: vs.bg, border: '1px solid ' + vs.border, padding: '1px 7px', borderRadius: '4px' }}>{group}</span>
                          </div>
                          {(name || exchange) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              {name && <span style={{ fontSize: '11px', color: '#8b949e' }}>{name.length > 32 ? name.slice(0, 32) + '...' : name}</span>}
                              {exchange && <span style={{ fontSize: '10px', color: '#484f58' }}>· {exchange}</span>}
                            </div>
                          )}
                        </div>
                        <span style={{ color: '#484f58', fontSize: '12px', flexShrink: 0, marginLeft: '8px' }}>{isOpen ? '▲' : '▼'}</span>
                      </div>

                      {isOpen && analyse && (
                        <div style={{ borderTop: '1px solid #161b22', padding: '16px 14px', background: '#080c10' }}>
                          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12.5px', lineHeight: '1.8', color: '#c9d1d9', fontFamily: 'IBM Plex Mono, monospace', margin: 0 }}>
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

      {/* Tickers en cours d'analyse */}
      {pendingTickers.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          {pendingTickers.map(function(ticker) {
            return (
              <div key={ticker} style={{ background: '#0d1117', border: '1px solid #1e2530', borderRadius: '10px', padding: '12px 14px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '12px', color: '#484f58' }}>⏳</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#484f58', fontFamily: 'IBM Plex Mono, monospace' }}>{ticker}</span>
                <span style={{ fontSize: '11px', color: '#484f58' }}>analyse en cours...</span>
              </div>
            );
          })}
        </div>
      )}

      {sessionText === '' && tickers.length === 0 && !loading && (
        <div style={{ textAlign: 'center', color: '#484f58', fontSize: '12px', paddingTop: '48px', lineHeight: '1.8' }}>
          Clique sur "Charger" pour lancer la session earnings du jour.<br />
          Ou saisis un ticker manuellement.
        </div>
      )}
    </div>
  );
}

var inputStyle = {
  flex: 1, background: '#0d1117', border: '1px solid #21262d',
  borderRadius: '8px', padding: '10px 14px', color: '#e6edf3',
  fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box',
};

function btnStyle(bg, color) {
  return { background: bg, color: color, border: 'none', borderRadius: '8px', padding: '10px 16px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' };
}
