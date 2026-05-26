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

function hasEnoughData(history, perf30d, profile) {
  var hasHistory = Array.isArray(history) && history.length >= 2;
  var hasPerf    = perf30d !== null;
  var hasProfile = profile && profile.sector;
  return hasHistory && hasPerf && hasProfile;
}

export default function EarningsModule() {
  var [earningsList, setEarningsList]               = useState([]);
  var [loading, setLoading]                         = useState(false);
  var [globalAnalyzing, setGlobalAnalyzing]         = useState(false);
  var [analyses, setAnalyses]                       = useState({});
  var [analyzing, setAnalyzing]                     = useState({});
  var [openTicker, setOpenTicker]                   = useState(null);
  var [error, setError]                             = useState('');
  var [manualTicker, setManualTicker]               = useState('');
  var [insufficientTickers, setInsufficientTickers] = useState([]);
  var [profiles, setProfiles]                       = useState({});

  function toggleTicker(ticker) {
    setOpenTicker(function(prev) { return prev === ticker ? null : ticker; });
  }

  async function loadEarnings() {
    setLoading(true);
    setGlobalAnalyzing(true);
    setError('');
    setAnalyses({});
    setOpenTicker(null);
    setInsufficientTickers([]);
    setProfiles({});

    try {
      var data = await getEarningsToday();
      var list = data.filter(function(e) { return e.symbol && e.symbol.length >= 2; }).slice(0, 20);
      setEarningsList(list);

      var withData    = [];
      var withoutData = [];

      await Promise.all(list.map(async function(item) {
        var ticker  = item.symbol;
        var history = await getEarningsHistory(ticker).catch(function() { return []; });
        var perf30d = await getPerf30d(ticker).catch(function() { return null; });
        var profile = await getStockProfile(ticker).catch(function() { return null; });

        setProfiles(function(prev) {
          var next = Object.assign({}, prev);
          next[ticker] = profile;
          return next;
        });

        if (hasEnoughData(history, perf30d, profile)) {
          withData.push({ item: item, history: history, perf30d: perf30d, profile: profile });
        } else {
          withoutData.push({ item: item });
        }
      }));

      setInsufficientTickers(withoutData.map(function(x) { return x.item; }));

      for (var idx = 0; idx < withData.length; idx++) {
        var entry  = withData[idx];
        var ticker = entry.item.symbol;
        setAnalyzing(function(prev) { var n = Object.assign({}, prev); n[ticker] = true; return n; });

        try {
          var putCall  = await getPutCallRatio(ticker).catch(function() { return null; });
          var shortInt = await getShortInterest(ticker).catch(function() { return null; });
          var result   = await analyzeEarnings(ticker, entry.item, entry.history, entry.perf30d, putCall, shortInt, entry.profile, false);
          setAnalyses(function(prev) { var n = Object.assign({}, prev); n[ticker] = result; return n; });
        } catch(e) {
          setAnalyses(function(prev) { var n = Object.assign({}, prev); n[ticker] = 'Erreur : ' + e.message; return n; });
        }

        setAnalyzing(function(prev) { var n = Object.assign({}, prev); n[ticker] = false; return n; });
        await new Promise(function(r) { setTimeout(r, 800); });
      }

    } catch(e) {
      setError('Erreur chargement earnings : ' + e.message);
    }

    setLoading(false);
    setGlobalAnalyzing(false);
  }

  async function runWebSearchAnalysis(item) {
    var ticker = item.symbol;
    setAnalyzing(function(prev) { var n = Object.assign({}, prev); n[ticker] = true; return n; });
    try {
      var history  = await getEarningsHistory(ticker).catch(function() { return []; });
      var perf30d  = await getPerf30d(ticker).catch(function() { return null; });
      var profile  = await getStockProfile(ticker).catch(function() { return null; });
      var putCall  = await getPutCallRatio(ticker).catch(function() { return null; });
      var shortInt = await getShortInterest(ticker).catch(function() { return null; });
      var result   = await analyzeEarnings(ticker, item, history, perf30d, putCall, shortInt, profile, true);
      setAnalyses(function(prev) { var n = Object.assign({}, prev); n[ticker] = result; return n; });
      setProfiles(function(prev) { var n = Object.assign({}, prev); n[ticker] = profile; return n; });
      setInsufficientTickers(function(prev) { return prev.filter(function(e) { return e.symbol !== ticker; }); });
      setEarningsList(function(prev) {
        if (prev.find(function(e) { return e.symbol === ticker; })) return prev;
        return [item].concat(prev);
      });
    } catch(e) {
      setAnalyses(function(prev) { var n = Object.assign({}, prev); n[ticker] = 'Erreur : ' + e.message; return n; });
    }
    setAnalyzing(function(prev) { var n = Object.assign({}, prev); n[ticker] = false; return n; });
  }

  async function addManual() {
    var ticker = manualTicker.trim().toUpperCase();
    if (!ticker || ticker.length < 2) return;
    setManualTicker('');
    var syntheticItem = { symbol: ticker, time: '?', exchange: '' };
    setEarningsList(function(prev) {
      if (prev.find(function(e) { return e.symbol === ticker; })) return prev;
      return [syntheticItem].concat(prev);
    });
    setAnalyzing(function(prev) { var n = Object.assign({}, prev); n[ticker] = true; return n; });
    try {
      var history  = await getEarningsHistory(ticker).catch(function() { return []; });
      var perf30d  = await getPerf30d(ticker).catch(function() { return null; });
      var profile  = await getStockProfile(ticker).catch(function() { return null; });
      var putCall  = await getPutCallRatio(ticker).catch(function() { return null; });
      var shortInt = await getShortInterest(ticker).catch(function() { return null; });
      setProfiles(function(prev) { var n = Object.assign({}, prev); n[ticker] = profile; return n; });
      var result = await analyzeEarnings(ticker, syntheticItem, history, perf30d, putCall, shortInt, profile, true);
      setAnalyses(function(prev) { var n = Object.assign({}, prev); n[ticker] = result; return n; });
    } catch(e) {
      setAnalyses(function(prev) { var n = Object.assign({}, prev); n[ticker] = 'Erreur : ' + e.message; return n; });
    }
    setAnalyzing(function(prev) { var n = Object.assign({}, prev); n[ticker] = false; return n; });
  }

  var today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  var analysedTickers = earningsList.filter(function(item) { return analyses[item.symbol]; });

  return (
    <div style={{ padding: '0' }}>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <span style={{ fontSize: '20px' }}>📊</span>
          <h2 style={{ fontSize: '19px', fontWeight: 800, color: '#e6edf3', fontFamily: 'Syne, sans-serif', margin: 0 }}>
            Earnings du Jour
          </h2>
        </div>
        <p style={{ fontSize: '11px', color: '#8b949e', textTransform: 'capitalize', margin: 0 }}>{today}</p>
      </div>

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

      <button
        onClick={loadEarnings}
        disabled={loading || globalAnalyzing}
        style={Object.assign({}, btnStyle('#161b22', '#e6edf3'), { width: '100%', marginBottom: '20px', border: '1px solid #21262d' })}
      >
        {loading ? '⏳ Chargement...' : globalAnalyzing ? '🔄 Analyse en cours...' : '🔄 Charger les earnings du jour'}
      </button>

      {error && (
        <div style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid #f85149', borderRadius: '8px', padding: '12px', marginBottom: '16px', fontSize: '12px', color: '#f85149' }}>
          {error}
        </div>
      )}

      {globalAnalyzing && (
        <div style={{ textAlign: 'center', color: '#484f58', fontSize: '12px', padding: '24px', border: '1px dashed #21262d', borderRadius: '10px', marginBottom: '16px' }}>
          🔄 Analyse en cours — résultats disponibles à la fin
        </div>
      )}

      {!globalAnalyzing && analysedTickers.length > 0 && (
        <div>
          {VERDICT_ORDER.map(function(group) {
            var items = analysedTickers.filter(function(item) {
              return detectVerdict(analyses[item.symbol]) === group;
            });
            if (items.length === 0) return null;
            var vs = VERDICT_STYLE[group];

            return (
              <div key={group} style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid ' + vs.border + '33' }}>
                  <span style={{ fontSize: '13px' }}>{vs.emoji}</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: vs.color, letterSpacing: '1px' }}>{group}</span>
                  <span style={{ fontSize: '10px', color: '#484f58' }}>({items.length})</span>
                </div>

                {items.map(function(item) {
                  var ticker   = item.symbol;
                  var analyse  = analyses[ticker];
                  var isOpen   = openTicker === ticker;
                  var profile  = profiles[ticker];
                  var name     = profile && profile.name ? profile.name : '';
                  var exchange = profile && profile.exchange ? profile.exchange : (item.exchange || '');

                  return (
                    <div key={ticker} style={{ background: '#0d1117', border: '1px solid ' + (isOpen ? vs.border + '66' : '#1e2530'), borderRadius: '12px', marginBottom: '8px', overflow: 'hidden' }}>
                      <div onClick={function() { toggleTicker(ticker); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', cursor: 'pointer', background: isOpen ? vs.bg : 'transparent' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 800, fontSize: '14px', color: '#e6edf3', fontFamily: 'IBM Plex Mono, monospace' }}>{ticker}</span>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: vs.color, background: vs.bg, border: '1px solid ' + vs.border, padding: '1px 7px', borderRadius: '4px' }}>{group}</span>
                            <span style={{ fontSize: '10px', color: '#8b949e', background: '#161b22', padding: '1px 6px', borderRadius: '4px' }}>
                              {item.time === 'BMO' ? '🌅 BMO' : item.time === 'AMC' ? '🌙 AMC' : '📅 ?'}
                            </span>
                          </div>
                          {(name || exchange) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              {name && <span style={{ fontSize: '11px', color: '#8b949e' }}>{name.length > 30 ? name.slice(0, 30) + '…' : name}</span>}
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

      {insufficientTickers.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid #21262d' }}>
            <span style={{ fontSize: '12px' }}>⚠️</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#484f58', letterSpacing: '1px' }}>DONNÉES INSUFFISANTES</span>
            <span style={{ fontSize: '10px', color: '#484f58' }}>({insufficientTickers.length})</span>
          </div>
          <p style={{ fontSize: '11px', color: '#484f58', marginBottom: '10px', lineHeight: '1.5' }}>
            Données limitées. Demande une analyse via web search si le titre t'intéresse.
          </p>

          {insufficientTickers.map(function(item) {
            var ticker   = item.symbol;
            var busy     = analyzing[ticker];
            var result   = analyses[ticker];
            var verdict  = result ? detectVerdict(result) : null;
            var vs       = verdict ? VERDICT_STYLE[verdict] : null;
            var profile  = profiles[ticker];
            var name     = profile && profile.name ? profile.name : '';
            var exchange = profile && profile.exchange ? profile.exchange : '';
            var isOpen   = openTicker === ticker;

            return (
              <div key={ticker} style={{ background: '#080c10', border: '1px solid ' + (result && vs ? vs.border + '44' : '#1e2530'), borderRadius: '10px', marginBottom: '6px', overflow: 'hidden', opacity: busy ? 0.6 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: '#484f58', fontFamily: 'IBM Plex Mono, monospace' }}>{ticker}</span>
                      {verdict && vs && (
                        <span style={{ fontSize: '10px', fontWeight: 700, color: vs.color, background: vs.bg, border: '1px solid ' + vs.border, padding: '1px 6px', borderRadius: '4px' }}>{verdict}</span>
                      )}
                    </div>
                    {(name || exchange) && (
                      <span style={{ fontSize: '10px', color: '#484f58' }}>{name}{exchange ? ' · ' + exchange : ''}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {!result && (
                      <button onClick={function() { runWebSearchAnalysis(item); }} disabled={busy} style={btnStyle(busy ? '#0d1117' : '#161b22', busy ? '#484f58' : '#8b949e')}>
                        {busy ? '⏳' : '🔍 Web search'}
                      </button>
                    )}
                    {result && (
                      <span onClick={function() { toggleTicker(ticker); }} style={{ color: '#484f58', fontSize: '12px', cursor: 'pointer' }}>
                        {isOpen ? '▲' : '▼'}
                      </span>
                    )}
                  </div>
                </div>

                {result && isOpen && (
                  <div style={{ borderTop: '1px solid #161b22', padding: '14px', background: vs ? vs.bg : 'transparent' }}>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px', lineHeight: '1.8', color: '#c9d1d9', fontFamily: 'IBM Plex Mono, monospace', margin: 0 }}>
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
        <div style={{ textAlign: 'center', color: '#484f58', fontSize: '12px', paddingTop: '48px', lineHeight: '1.8' }}>
          Aucun earnings chargé.<br />Clique sur "Charger" ou saisis un ticker manuellement.
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
