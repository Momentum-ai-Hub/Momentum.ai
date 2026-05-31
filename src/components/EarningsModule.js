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

// ─── CONFIG VERDICTS ──────────────────────────────────────────────────────────
// BUY FORT / BUY / BUY LEGER => même groupe BUY, label individuel affiché sur la carte
const VERDICT_STYLE = {
  'BUY':    { color: '#3fb950', bg: 'rgba(63,185,80,0.08)',   border: '#3fb950', emoji: '🟢' },
  'NEUTRE': { color: '#e3b341', bg: 'rgba(227,179,65,0.08)',  border: '#e3b341', emoji: '🟡' },
  'AVOID':  { color: '#f85149', bg: 'rgba(248,81,73,0.08)',   border: '#f85149', emoji: '🔴' },
  'SHORT':  { color: '#ff7b72', bg: 'rgba(255,123,114,0.08)', border: '#ff7b72', emoji: '⛔' },
};

// Labels visuels individuels conservés sur les cartes
const LABEL_STYLE = {
  'BUY FORT':  { color: '#3fb950', bg: 'rgba(63,185,80,0.15)',   border: '#3fb950' },
  'BUY':       { color: '#58a6ff', bg: 'rgba(88,166,255,0.12)',  border: '#58a6ff' },
  'BUY LEGER': { color: '#388bfd', bg: 'rgba(56,139,253,0.10)',  border: '#388bfd' },
  'NEUTRE':    { color: '#e3b341', bg: 'rgba(227,179,65,0.12)',  border: '#e3b341' },
  'AVOID':     { color: '#f85149', bg: 'rgba(248,81,73,0.12)',   border: '#f85149' },
  'SHORT':     { color: '#ff7b72', bg: 'rgba(255,123,114,0.12)', border: '#ff7b72' },
};

// Ordre des groupes d'affichage
const VERDICT_ORDER = ['BUY', 'NEUTRE', 'AVOID', 'SHORT'];

// ─── FIX detectVerdict ────────────────────────────────────────────────────────
// Recherche UNIQUEMENT sur la ligne "Verdict :" pour éviter les faux positifs
// Ex: "un BUY FORT serait prématuré" dans la narrative ne doit pas déclencher BUY FORT
function detectVerdict(text) {
  if (!text) return 'NEUTRE';

  // Chercher la ligne "Verdict : ..." (insensible aux espaces autour du :)
  var lines = text.split('\n');
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    // Ligne qui commence par "Verdict" (avec ou sans tirets/astérisques autour)
    if (/^[*_\-\s]*verdict\s*:/i.test(line)) {
      var upper = line.toUpperCase();
      if (upper.includes('BUY FORT'))  return 'BUY FORT';
      if (upper.includes('BUY LEGER')) return 'BUY LEGER';
      if (upper.includes('SHORT'))     return 'SHORT';
      if (upper.includes('AVOID'))     return 'AVOID';
      if (upper.includes('NEUTRE'))    return 'NEUTRE';
      if (upper.includes('BUY'))       return 'BUY';
      return 'NEUTRE';
    }
  }

  // Fallback si ligne Verdict non trouvée : cherche dans les 3 dernières lignes non vides
  var nonEmpty = lines.filter(function(l) { return l.trim().length > 0; });
  var tail = nonEmpty.slice(-3).join(' ').toUpperCase();
  if (tail.includes('BUY FORT'))  return 'BUY FORT';
  if (tail.includes('BUY LEGER')) return 'BUY LEGER';
  if (tail.includes('SHORT'))     return 'SHORT';
  if (tail.includes('AVOID'))     return 'AVOID';
  if (tail.includes('NEUTRE'))    return 'NEUTRE';
  if (tail.includes('BUY'))       return 'BUY';
  return 'NEUTRE';
}

// Groupe d'affichage (BUY FORT / BUY / BUY LEGER => groupe 'BUY')
function getGroup(verdict) {
  if (verdict === 'BUY FORT' || verdict === 'BUY' || verdict === 'BUY LEGER') return 'BUY';
  return verdict;
}

// ─── PARSER CONTEXTE MACRO ────────────────────────────────────────────────────
// Extrait le bloc CONTEXTE MACRO du sessionText pour l'afficher proprement
function parseSessionParts(text) {
  if (!text) return { macro: '', calendrier: '', reste: '' };

  var lines = text.split('\n');
  var macroLines = [];
  var calLines   = [];
  var resteLines = [];
  var zone = 'before'; // before | macro | sep | calendrier | reste

  for (var i = 0; i < lines.length; i++) {
    var l = lines[i];
    var ltrim = l.trim().toUpperCase();

    if (ltrim === 'CONTEXTE MACRO' || ltrim.startsWith('CONTEXTE MACRO')) {
      zone = 'macro';
      continue;
    }
    if (ltrim === 'CALENDRIER DU JOUR' || ltrim.startsWith('CALENDRIER DU JOUR')) {
      zone = 'calendrier';
      continue;
    }
    if (ltrim === 'RECAP' || ltrim.startsWith('RECAP')) {
      zone = 'reste';
    }
    if (ltrim === '---' || ltrim === '─────' || ltrim.startsWith('---')) {
      if (zone === 'macro') { zone = 'calendrier'; continue; }
      if (zone === 'calendrier') { zone = 'reste'; }
    }

    if (zone === 'macro')       macroLines.push(l);
    else if (zone === 'calendrier') calLines.push(l);
    else if (zone === 'reste')  resteLines.push(l);
  }

  return {
    macro:      macroLines.join('\n').trim(),
    calendrier: calLines.join('\n').trim(),
    reste:      resteLines.join('\n').trim(),
  };
}

// ─── COMPOSANT PRINCIPAL ──────────────────────────────────────────────────────
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

  // Parser les parties du sessionText
  var parts = parseSessionParts(sessionText);

  return (
    <div style={{ padding: '0' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <span style={{ fontSize: '20px' }}>📊</span>
          <h2 style={{ fontSize: '19px', fontWeight: 800, color: '#e6edf3', fontFamily: 'Syne, sans-serif', margin: 0 }}>
            Earnings du Jour
          </h2>
        </div>
        <p style={{ fontSize: '11px', color: '#8b949e', textTransform: 'capitalize', margin: 0 }}>{today}</p>
      </div>

      {/* ── Saisie manuelle ────────────────────────────────────────────────── */}
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

      {/* ── Bouton charger ─────────────────────────────────────────────────── */}
      <button
        onClick={loadSession}
        disabled={loading}
        style={Object.assign({}, btnStyle('#161b22', '#e6edf3'), {
          width: '100%', marginBottom: '20px', border: '1px solid #21262d'
        })}
      >
        {loading ? '⏳ Recherche en cours...' : '🔄 Charger les earnings du jour'}
      </button>

      {error && (
        <div style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid #f85149', borderRadius: '8px', padding: '12px', marginBottom: '16px', fontSize: '12px', color: '#f85149' }}>
          {error}
        </div>
      )}

      {/* ── CADRE 1 — Contexte macro ───────────────────────────────────────── */}
      {sessionText !== '' && (
        <div style={{ marginBottom: '20px' }}>
          <div style={sectionHeader}>
            <span style={{ fontSize: '13px' }}>🌐</span>
            <span style={sectionLabel}>CONTEXTE MACRO</span>
          </div>
          <div style={{ background: '#0a0e14', border: '1px solid #1e2530', borderRadius: '10px', padding: '14px 16px' }}>
            {parts.macro
              ? (
                <p style={{ fontSize: '13px', lineHeight: '1.75', color: '#c9d1d9', fontFamily: 'IBM Plex Mono, monospace', margin: 0, whiteSpace: 'pre-wrap' }}>
                  {parts.macro}
                </p>
              )
              : (
                /* Fallback : si le parser n'a pas trouvé de bloc macro, afficher les premières lignes */
                <p style={{ fontSize: '13px', lineHeight: '1.75', color: '#c9d1d9', fontFamily: 'IBM Plex Mono, monospace', margin: 0, whiteSpace: 'pre-wrap' }}>
                  {sessionText.split('\n').slice(0, 8).join('\n').trim()}
                </p>
              )
            }
          </div>
        </div>
      )}

      {/* ── CADRE 1b — Calendrier du jour ──────────────────────────────────── */}
      {sessionText !== '' && parts.calendrier && (
        <div style={{ marginBottom: '24px' }}>
          <div style={sectionHeader}>
            <span style={{ fontSize: '13px' }}>📅</span>
            <span style={sectionLabel}>CALENDRIER DU JOUR</span>
          </div>
          <div style={{ background: '#0a0e14', border: '1px solid #1e2530', borderRadius: '10px', padding: '14px 16px', overflowX: 'auto' }}>
            <pre style={{ fontSize: '12px', lineHeight: '1.7', color: '#c9d1d9', fontFamily: 'IBM Plex Mono, monospace', margin: 0, whiteSpace: 'pre' }}>
              {parts.calendrier}
            </pre>
          </div>
        </div>
      )}

      {/* ── CADRE 2 — Classement BUY / NEUTRE / AVOID / SHORT ─────────────── */}
      <div style={{ marginBottom: '16px' }}>
        <div style={sectionHeader}>
          <span style={{ fontSize: '13px' }}>📋</span>
          <span style={sectionLabel}>ANALYSES</span>
          {analyzing2 && (
            <span style={{ fontSize: '10px', color: '#484f58', marginLeft: 'auto' }}>🔄 en cours...</span>
          )}
        </div>

        {VERDICT_ORDER.map(function(group) {
          var vs = VERDICT_STYLE[group];

          // Items de ce groupe (BUY inclut BUY FORT / BUY / BUY LEGER)
          var items = analysedTickers.filter(function(t) {
            return getGroup(detectVerdict(analyses[t])) === group;
          });

          return (
            <div key={group} style={{ marginBottom: '16px' }}>

              {/* En-tête groupe */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                marginBottom: '8px', paddingBottom: '5px',
                borderBottom: '1px solid ' + vs.border + '44'
              }}>
                <span>{vs.emoji}</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: vs.color, letterSpacing: '1px' }}>
                  {group}
                </span>
                <span style={{ fontSize: '10px', color: '#484f58' }}>
                  ({items.length})
                </span>
              </div>

              {/* Message vide */}
              {items.length === 0 && (
                <div style={{
                  padding: '10px 14px',
                  background: '#0a0e14',
                  border: '1px solid #1a1f27',
                  borderRadius: '8px',
                  fontSize: '11px',
                  color: '#484f58',
                  fontFamily: 'IBM Plex Mono, monospace'
                }}>
                  Aucun ticker
                </div>
              )}

              {/* Cartes tickers */}
              {items.map(function(ticker) {
                var analyse   = analyses[ticker];
                var verdict   = detectVerdict(analyse);
                var isOpen    = openTicker === ticker;
                var profile   = profiles[ticker];
                var name      = profile && profile.name ? profile.name : '';
                var exchange  = profile && profile.exchange ? profile.exchange : '';
                var ls        = LABEL_STYLE[verdict] || LABEL_STYLE['NEUTRE'];

                return (
                  <div key={ticker} style={{
                    background: '#0d1117',
                    border: '1px solid ' + (isOpen ? vs.border + '77' : '#1e2530'),
                    borderRadius: '10px',
                    marginBottom: '6px',
                    overflow: 'hidden',
                    transition: 'border-color 0.15s'
                  }}>

                    {/* Ligne titre (cliquable) */}
                    <div
                      onClick={function() { toggleTicker(ticker); }}
                      style={{
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '11px 14px', cursor: 'pointer',
                        background: isOpen ? vs.bg : 'transparent'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 800, fontSize: '14px', color: '#e6edf3', fontFamily: 'IBM Plex Mono, monospace' }}>
                            {ticker}
                          </span>
                          {/* Label individuel (BUY FORT / BUY / BUY LEGER) */}
                          <span style={{
                            fontSize: '10px', fontWeight: 700,
                            color: ls.color, background: ls.bg,
                            border: '1px solid ' + ls.border,
                            padding: '1px 7px', borderRadius: '4px',
                            letterSpacing: '0.5px'
                          }}>
                            {verdict}
                          </span>
                        </div>
                        {(name || exchange) && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            {name && <span style={{ fontSize: '11px', color: '#8b949e' }}>{name.length > 32 ? name.slice(0, 32) + '…' : name}</span>}
                            {exchange && <span style={{ fontSize: '10px', color: '#484f58' }}>· {exchange}</span>}
                          </div>
                        )}
                      </div>
                      <span style={{ color: '#484f58', fontSize: '12px', flexShrink: 0, marginLeft: '8px' }}>
                        {isOpen ? '▲' : '▼'}
                      </span>
                    </div>

                    {/* Analyse dépliée */}
                    {isOpen && analyse && (
                      <div style={{ borderTop: '1px solid #161b22', padding: '16px 14px', background: '#080c10' }}>
                        <pre style={{
                          whiteSpace: 'pre-wrap', fontSize: '12.5px',
                          lineHeight: '1.85', color: '#c9d1d9',
                          fontFamily: 'IBM Plex Mono, monospace', margin: 0
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

      {/* ── Tickers en cours d'analyse ─────────────────────────────────────── */}
      {pendingTickers.length > 0 && (
        <div style={{ marginTop: '8px' }}>
          {pendingTickers.map(function(ticker) {
            return (
              <div key={ticker} style={{
                background: '#0d1117', border: '1px solid #1e2530',
                borderRadius: '10px', padding: '12px 14px',
                marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px'
              }}>
                <span style={{ fontSize: '12px', color: '#484f58' }}>⏳</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#484f58', fontFamily: 'IBM Plex Mono, monospace' }}>{ticker}</span>
                <span style={{ fontSize: '11px', color: '#484f58' }}>analyse en cours...</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── État vide ──────────────────────────────────────────────────────── */}
      {sessionText === '' && tickers.length === 0 && !loading && (
        <div style={{ textAlign: 'center', color: '#484f58', fontSize: '12px', paddingTop: '48px', lineHeight: '1.8' }}>
          Clique sur "Charger" pour lancer la session earnings du jour.<br />
          Ou saisis un ticker manuellement.
        </div>
      )}
    </div>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
var inputStyle = {
  flex: 1, background: '#0d1117', border: '1px solid #21262d',
  borderRadius: '8px', padding: '10px 14px', color: '#e6edf3',
  fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box',
};

var sectionHeader = {
  display: 'flex', alignItems: 'center', gap: '8px',
  marginBottom: '10px', paddingBottom: '6px',
  borderBottom: '1px solid #21262d'
};

var sectionLabel = {
  fontSize: '11px', fontWeight: 700,
  color: '#e6edf3', letterSpacing: '1px'
};

function btnStyle(bg, color) {
  return {
    background: bg, color: color, border: 'none',
    borderRadius: '8px', padding: '10px 16px',
    fontSize: '12px', fontWeight: 600,
    cursor: 'pointer', whiteSpace: 'nowrap'
  };
}
