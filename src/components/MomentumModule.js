'use client';
import { useState, useEffect } from 'react';
import { classifyTicker, classifyBatch, saveTickersToSupabase, loadPortfolioFromSupabase } from '../lib/api';

// ─── FAMILLES ─────────────────────────────────────────────────────────────────
const FAMILLES = {
  'TECH & IA': {
    icon: '🤖', color: '#58a6ff',
    secteurs: ['SEMICONDUCTEURS','MÉMOIRE & STOCKAGE','INFRA AI & CLOUD','TELECOM & OPTIQUE','QUANTIQUE & DEEP TECH'],
  },
  'ÉNERGIE': {
    icon: '⚡', color: '#f0b429',
    secteurs: ['NUCLÉAIRE & URANIUM','PÉTROLE & GAZ','ÉNERGIE RENOUVELABLE','CHIMIE & MATÉRIAUX'],
  },
  'RESSOURCES': {
    icon: '⛰️', color: '#e3b341',
    secteurs: ['OR & MÉTAUX PRÉCIEUX','LITHIUM & BATTERIES','TERRES RARES','MINES & MÉTAUX DE BASE'],
  },
  'DÉFENSE & SPACE': {
    icon: '🛡️', color: '#f85149',
    secteurs: ['DÉFENSE & AÉROSPATIALE','SPACE & SATELLITE','ROBOTIQUE & AUTO.'],
  },
  'FINANCE': {
    icon: '💰', color: '#3fb950',
    secteurs: ['FINANCE & FINTECH','CRYPTO MINING'],
  },
  'AUTRE': {
    icon: '📋', color: '#8b949e',
    secteurs: ['INFRA & CONSTRUCTION','LUXE & CONSO PREMIUM','BIOTECH & MEDTECH'],
  },
};

const TYPE_COLOR = {
  'EARNINGS PLAY': '#3fb950',
  'TITRE DE FOND': '#58a6ff',
  'SPÉCULATIF':    '#f85149',
};

const PERIODS = ['1J','1S','1M','1A'];
const PERIOD_KEY = { '1J':'change_1d','1S':'change_1w','1M':'change_1m','1A':'change_1y' };

function getFamilleForSecteur(secteur) {
  for (const [fam, cfg] of Object.entries(FAMILLES)) {
    if (cfg.secteurs.includes(secteur)) return fam;
  }
  return 'AUTRE';
}

function ibLink(ticker) {
  return `https://www.interactivebrokers.com/en/index.php?f=2510&search=${ticker}`;
}

function fmtChange(val) {
  if (val == null) return '—';
  return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
}

function changeColor(val) {
  if (val == null) return '#8b949e';
  return val >= 0 ? '#3fb950' : '#f85149';
}

// ─── SPARKLINE ────────────────────────────────────────────────────────────────
function Sparkline({ data }) {
  if (!data) return <div style={{ width:70, height:28, background:'#161b22', borderRadius:4 }} />;
  const pts = typeof data === 'string' ? data.split(',').map(Number) : data;
  if (pts.length < 2) return <div style={{ width:70, height:28, background:'#161b22', borderRadius:4 }} />;
  const min = Math.min(...pts), max = Math.max(...pts), range = max - min || 1;
  const W = 70, H = 28;
  const points = pts.map((v, i) =>
    `${(i / (pts.length - 1)) * W},${H - ((v - min) / range) * H}`
  ).join(' ');
  const color = pts[pts.length - 1] >= pts[0] ? '#3fb950' : '#f85149';
  return (
    <svg width={W} height={H}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── TICKER ROW ───────────────────────────────────────────────────────────────
function TickerRow({ ticker, snapshot, period }) {
  const change = snapshot?.[PERIOD_KEY[period]] ?? null;
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:8,
      padding:'8px 10px', borderBottom:'1px solid #161b22',
    }}>
      <div style={{
        width:3, height:32, borderRadius:2, flexShrink:0,
        background: TYPE_COLOR[ticker.type] || '#484f58',
      }} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#e6edf3' }}>{ticker.ticker}</div>
        <div style={{ fontSize:10, color:'#484f58', overflow:'hidden',
          textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:120 }}>
          {ticker.name}
        </div>
      </div>
      <Sparkline data={snapshot?.sparkline_1m} />
      <div style={{ textAlign:'right', minWidth:65 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#e6edf3' }}>
          {snapshot?.price ? `$${Number(snapshot.price).toFixed(2)}` : '—'}
        </div>
        <div style={{ fontSize:10, fontWeight:600, color: changeColor(change) }}>
          {fmtChange(change)}
        </div>
      </div>
      <a href={ibLink(ticker.ticker)} target="_blank" rel="noopener noreferrer"
        style={{ fontSize:9, color:'#484f58', background:'#161b22', borderRadius:4,
          padding:'2px 5px', textDecoration:'none', fontWeight:600, flexShrink:0 }}>
        IB →
      </a>
    </div>
  );
}

// ─── PORTFOLIO VIEW ───────────────────────────────────────────────────────────
function PortfolioView({ tickers, snapshots, period, setPeriod }) {
  const [openFamille, setOpenFamille] = useState(null);
  const [openSecteur, setOpenSecteur] = useState(null);
  const [search, setSearch] = useState('');

  const snapshotMap = {};
  (snapshots || []).forEach(s => { snapshotMap[s.ticker] = s; });

  const filtered = search
    ? tickers.filter(t =>
        t.name?.toLowerCase().includes(search.toLowerCase()) ||
        t.ticker?.toLowerCase().includes(search.toLowerCase()))
    : null;

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
        <span style={{ fontSize:11, color:'#484f58' }}>{tickers.length} titres</span>
        <span style={{ fontSize:11, color: snapshots.length > 0 ? '#3fb950' : '#484f58' }}>
          {snapshots.length > 0 ? `✓ ${snapshots.length} prix` : '⏳ Snapshot en attente'}
        </span>
      </div>

      {/* Période */}
      <div style={{ display:'flex', gap:6, marginBottom:10 }}>
        {PERIODS.map(p => (
          <button key={p} onClick={() => setPeriod(p)} style={{
            padding:'3px 10px', borderRadius:6, border:'none',
            background: period === p ? '#f0b429' : '#161b22',
            color: period === p ? '#0d1117' : '#8b949e',
            fontSize:11, fontWeight:600, cursor:'pointer',
          }}>{p}</button>
        ))}
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Rechercher..." style={{ ...inputStyle, marginBottom:12 }} />

      {filtered ? (
        <div style={{ border:'1px solid #21262d', borderRadius:8, overflow:'hidden' }}>
          {filtered.length === 0
            ? <div style={{ padding:20, textAlign:'center', fontSize:12, color:'#484f58' }}>Aucun résultat</div>
            : filtered.map(t => <TickerRow key={t.ticker} ticker={t} snapshot={snapshotMap[t.ticker]} period={period} />)
          }
        </div>
      ) : (
        Object.entries(FAMILLES).map(([famille, cfg]) => {
          const famTickers = tickers.filter(t => cfg.secteurs.includes(t.secteur));
          if (famTickers.length === 0) return null;
          const famOpen = openFamille === famille;
          return (
            <div key={famille} style={{
              marginBottom:6,
              border:`1px solid ${famOpen ? cfg.color + '55' : '#21262d'}`,
              borderRadius:10, overflow:'hidden',
            }}>
              <button onClick={() => { setOpenFamille(famOpen ? null : famille); setOpenSecteur(null); }}
                style={{
                  width:'100%', display:'flex', alignItems:'center',
                  justifyContent:'space-between', padding:'11px 14px',
                  background: famOpen ? `${cfg.color}11` : '#0d1117',
                  border:'none', cursor:'pointer',
                }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:15 }}>{cfg.icon}</span>
                  <span style={{ fontSize:12, fontWeight:700, color: famOpen ? cfg.color : '#c9d1d9' }}>
                    {famille}
                  </span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:10, color:'#484f58' }}>{famTickers.length}</span>
                  <span style={{ fontSize:11, color:'#484f58' }}>{famOpen ? '▲' : '▼'}</span>
                </div>
              </button>
              {famOpen && cfg.secteurs.map(secteur => {
                const secTickers = famTickers.filter(t => t.secteur === secteur);
                if (secTickers.length === 0) return null;
                const secOpen = openSecteur === secteur;
                return (
                  <div key={secteur} style={{ borderTop:'1px solid #161b22' }}>
                    <button onClick={() => setOpenSecteur(secOpen ? null : secteur)}
                      style={{
                        width:'100%', display:'flex', alignItems:'center',
                        justifyContent:'space-between', padding:'9px 14px',
                        background: secOpen ? '#161b22' : 'transparent',
                        border:'none', cursor:'pointer',
                      }}>
                      <span style={{ fontSize:11, fontWeight:600, color:'#8b949e' }}>{secteur}</span>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ fontSize:10, color:'#484f58' }}>{secTickers.length}</span>
                        <span style={{ fontSize:10, color:'#484f58' }}>{secOpen ? '▲' : '▼'}</span>
                      </div>
                    </button>
                    {secOpen && (
                      <div style={{ background:'#080d13' }}>
                        {secTickers.map(t => (
                          <TickerRow key={t.ticker} ticker={t} snapshot={snapshotMap[t.ticker]} period={period} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── PERFORMANCE VIEW ─────────────────────────────────────────────────────────
function PerformanceView({ tickers, snapshots }) {
  const [period, setPeriod] = useState('1J');
  const [groupBy, setGroupBy] = useState('global');
  const snapshotMap = {};
  (snapshots || []).forEach(s => { snapshotMap[s.ticker] = s; });

  const sorted = [...tickers]
    .map(t => ({ ...t, change: snapshotMap[t.ticker]?.[PERIOD_KEY[period]] ?? null }))
    .sort((a, b) => {
      if (a.change === null && b.change === null) return 0;
      if (a.change === null) return 1;
      if (b.change === null) return -1;
      return b.change - a.change;
    });

  function PerfRow({ t, rank }) {
    return (
      <div style={{
        display:'flex', alignItems:'center', gap:8,
        padding:'9px 12px', borderBottom:'1px solid #161b22',
      }}>
        <span style={{ fontSize:10, color:'#484f58', width:18, textAlign:'center', flexShrink:0 }}>
          {rank}
        </span>
        <div style={{ width:3, height:30, borderRadius:2, flexShrink:0,
          background: TYPE_COLOR[t.type] || '#484f58' }} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#e6edf3' }}>{t.ticker}</div>
          <div style={{ fontSize:10, color:'#484f58', overflow:'hidden',
            textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:110 }}>
            {t.name}
          </div>
        </div>
        <span style={{ fontSize:9, color:'#484f58', background:'#161b22',
          borderRadius:4, padding:'2px 5px', maxWidth:70,
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {t.secteur?.split(' ')[0]}
        </span>
        <span style={{ fontSize:12, fontWeight:700, color: changeColor(t.change),
          minWidth:65, textAlign:'right' }}>
          {fmtChange(t.change)}
        </span>
        <a href={ibLink(t.ticker)} target="_blank" rel="noopener noreferrer"
          style={{ fontSize:9, color:'#484f58', background:'#161b22', borderRadius:4,
            padding:'2px 5px', textDecoration:'none', fontWeight:600, flexShrink:0 }}>
          IB →
        </a>
      </div>
    );
  }

  function renderList(list) {
    return (
      <div style={{ border:'1px solid #21262d', borderRadius:8, overflow:'hidden' }}>
        {list.map((t, i) => <PerfRow key={t.ticker} t={t} rank={i + 1} />)}
      </div>
    );
  }

  function renderByGroupe(getFn, groups) {
    return groups.map(group => {
      const list = sorted.filter(t => getFn(t) === group);
      if (list.length === 0) return null;
      const cfg = FAMILLES[group];
      return (
        <div key={group} style={{ marginBottom:14 }}>
          <div style={{ fontSize:11, fontWeight:700, color: cfg?.color || '#8b949e',
            marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>
            {cfg?.icon} {group}
            <span style={{ fontSize:10, color:'#484f58', fontWeight:400 }}>· {list.length}</span>
          </div>
          {renderList(list)}
        </div>
      );
    });
  }

  return (
    <div>
      <div style={{ display:'flex', gap:6, marginBottom:10 }}>
        {PERIODS.map(p => (
          <button key={p} onClick={() => setPeriod(p)} style={{
            padding:'3px 10px', borderRadius:6, border:'none',
            background: period === p ? '#f0b429' : '#161b22',
            color: period === p ? '#0d1117' : '#8b949e',
            fontSize:11, fontWeight:600, cursor:'pointer',
          }}>{p}</button>
        ))}
      </div>
      <div style={{ display:'flex', gap:6, marginBottom:14,
        background:'#0d1117', padding:4, borderRadius:8 }}>
        {[{id:'global',label:'🌐 Global'},{id:'famille',label:'📁 Famille'},{id:'secteur',label:'🔬 Secteur'}].map(g => (
          <button key={g.id} onClick={() => setGroupBy(g.id)} style={{
            flex:1, padding:'6px 4px', borderRadius:6, border:'none',
            background: groupBy === g.id ? '#f0b429' : 'transparent',
            color: groupBy === g.id ? '#0d1117' : '#8b949e',
            fontSize:11, fontWeight:600, cursor:'pointer',
          }}>{g.label}</button>
        ))}
      </div>
      {groupBy === 'global' && renderList(sorted)}
      {groupBy === 'famille' && renderByGroupe(t => getFamilleForSecteur(t.secteur), Object.keys(FAMILLES))}
      {groupBy === 'secteur' && renderByGroupe(t => t.secteur, [...new Set(tickers.map(t => t.secteur))])}
      {snapshots?.length > 0 && (
        <div style={{ fontSize:10, color:'#484f58', textAlign:'center', marginTop:12 }}>
          Snapshot · {new Date(snapshots[0]?.snapshot_time).toLocaleString('fr-FR')}
        </div>
      )}
    </div>
  );
}

// ─── IMPORT VIEW ──────────────────────────────────────────────────────────────
function ImportView({ onImportDone }) {
  const [rawText, setRawText]         = useState('');
  const [parsed, setParsed]           = useState([]);
  const [step, setStep]               = useState('paste'); // paste | preview | classifying | done
  const [progress, setProgress]       = useState('');
  const [results, setResults]         = useState([]);
  const [error, setError]             = useState('');

  // ── Parser le copier-coller IBKR ──────────────────────────────────────────
  function parseIBKR(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const items = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Un ticker IBKR = ligne courte MAJUSCULES (1-6 chars, parfois avec chiffres)
      const isTicker = /^[A-Z][A-Z0-9.]{0,5}$/.test(line);

      if (isTicker && i + 1 < lines.length) {
        const ticker = line;
        const name   = lines[i + 1];

        // Vérifier que la ligne suivante ressemble à un nom (pas un prix)
        const isName = !/^\d/.test(name) && !/^[+-]/.test(name) && !/^C\d/.test(name);

        if (isName) {
          // Éviter doublons
          if (!items.find(x => x.ticker === ticker)) {
            items.push({ ticker, name });
          }
          i += 2; // sauter ticker + nom
          // sauter les lignes de prix (jusqu'au prochain ticker)
          while (i < lines.length && !/^[A-Z][A-Z0-9.]{0,5}$/.test(lines[i])) {
            i++;
          }
          continue;
        }
      }
      i++;
    }

    return items;
  }

  function handleParse() {
    setError('');
    const items = parseIBKR(rawText);
    if (items.length === 0) {
      setError('Aucun ticker détecté. Vérifie le format du copier-coller.');
      return;
    }
    setParsed(items);
    setStep('preview');
  }

  function removeTicker(ticker) {
    setParsed(prev => prev.filter(x => x.ticker !== ticker));
  }

  async function classifyAndSave() {
    if (parsed.length === 0) return;
    setStep('classifying');
    setError('');
    setResults([]);

    try {
      let allResults = [];
      const chunks = [];
      for (let i = 0; i < parsed.length; i += 10) chunks.push(parsed.slice(i, i + 10));

      for (let i = 0; i < chunks.length; i++) {
        setProgress(`Classification ${i + 1}/${chunks.length}...`);
        const res = await classifyBatch(chunks[i]);
        if (res.length > 0) {
          await saveTickersToSupabase(res);
          allResults = [...allResults, ...res];
        }
      }

      setResults(allResults);
      setStep('done');
      if (onImportDone) onImportDone();
    } catch (e) {
      setError(e.message);
      setStep('preview');
    }
  }

  function reset() {
    setRawText('');
    setParsed([]);
    setStep('paste');
    setProgress('');
    setResults([]);
    setError('');
  }

  // ── STEP : Coller ─────────────────────────────────────────────────────────
  if (step === 'paste') return (
    <div>
      <div style={{ marginBottom:16 }}>
        <p style={{ fontSize:12, color:'#8b949e', marginBottom:8 }}>
          Dans IBKR, sélectionne ta watchlist → Copier tout → Colle ici.
        </p>
        <p style={{ fontSize:11, color:'#484f58', marginBottom:12 }}>
          Format reconnu : <code style={{ color:'#58a6ff' }}>TICKER / NOM / PRIX…</code> (une watchlist complète)
        </p>
      </div>
      <textarea
        value={rawText}
        onChange={e => setRawText(e.target.value)}
        placeholder={'HUT\nHUT 8 CORP\n105,50  +0,23% ...\nNVDA\nNVIDIA CORP\n...'}
        rows={14}
        style={{
          ...inputStyle,
          resize: 'vertical',
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: 11,
          lineHeight: '1.6',
          marginBottom: 12,
        }}
      />
      {error && <div style={{ color:'#f85149', fontSize:12, marginBottom:10 }}>❌ {error}</div>}
      <button
        onClick={handleParse}
        disabled={!rawText.trim()}
        style={{
          ...btnStyle(rawText.trim() ? '#f0b429' : '#161b22', rawText.trim() ? '#0d1117' : '#484f58'),
          width: '100%',
        }}
      >
        Analyser le copier-coller →
      </button>
    </div>
  );

  // ── STEP : Prévisualisation ───────────────────────────────────────────────
  if (step === 'preview') return (
    <div>
      <div style={{
        background: 'rgba(63,185,80,0.1)', border: '1px solid #3fb95044',
        borderRadius: 8, padding: '10px 14px', marginBottom: 16,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize:13, fontWeight:700, color:'#3fb950' }}>
          ✓ {parsed.length} tickers détectés
        </span>
        <button onClick={reset} style={btnStyle('#161b22', '#8b949e')}>
          ← Recommencer
        </button>
      </div>

      <p style={{ fontSize:11, color:'#484f58', marginBottom:10 }}>
        Retire les tickers que tu ne veux pas importer, puis confirme.
      </p>

      <div style={{
        border: '1px solid #21262d', borderRadius: 8,
        overflow: 'hidden', marginBottom: 16, maxHeight: 320, overflowY: 'auto',
      }}>
        {parsed.map((item, idx) => (
          <div key={item.ticker} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px',
            borderBottom: idx < parsed.length - 1 ? '1px solid #161b22' : 'none',
            background: '#0d1117',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize:12, fontWeight:700, color:'#e6edf3', minWidth:60 }}>
                {item.ticker}
              </span>
              <span style={{ fontSize:11, color:'#8b949e' }}>{item.name}</span>
            </div>
            <button
              onClick={() => removeTicker(item.ticker)}
              style={{ background:'transparent', border:'none', color:'#484f58',
                cursor:'pointer', fontSize:14, padding:'0 4px' }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {error && <div style={{ color:'#f85149', fontSize:12, marginBottom:10 }}>❌ {error}</div>}

      <button
        onClick={classifyAndSave}
        style={{ ...btnStyle('#f0b429', '#0d1117'), width:'100%' }}
      >
        Classifier et importer {parsed.length} tickers →
      </button>
    </div>
  );

  // ── STEP : Classification en cours ────────────────────────────────────────
  if (step === 'classifying') return (
    <div style={{ textAlign:'center', padding:'40px 20px' }}>
      <div style={{ fontSize:24, marginBottom:16 }}>🤖</div>
      <div style={{ fontSize:13, color:'#e6edf3', marginBottom:8 }}>Classification en cours...</div>
      <div style={{ fontSize:11, color:'#8b949e' }}>{progress}</div>
    </div>
  );

  // ── STEP : Done ───────────────────────────────────────────────────────────
  if (step === 'done') return (
    <div>
      <div style={{
        background: 'rgba(63,185,80,0.1)', border: '1px solid #3fb95044',
        borderRadius: 8, padding: '14px', marginBottom: 16, textAlign:'center',
      }}>
        <div style={{ fontSize:20, marginBottom:6 }}>✅</div>
        <div style={{ fontSize:13, fontWeight:700, color:'#3fb950' }}>
          {results.length} tickers importés et classifiés
        </div>
      </div>

      {/* Résumé par secteur */}
      <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:16 }}>
        {Object.entries(
          results.reduce((acc, r) => {
            const s = r.secteur || 'AUTRE';
            if (!acc[s]) acc[s] = [];
            acc[s].push(r);
            return acc;
          }, {})
        ).map(([secteur, tickers]) => (
          <div key={secteur} style={{
            background:'#0d1117', border:'1px solid #21262d',
            borderRadius:8, overflow:'hidden',
          }}>
            <div style={{ padding:'7px 12px', borderBottom:'1px solid #161b22',
              display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontSize:11, fontWeight:700, color:'#58a6ff' }}>{secteur}</span>
              <span style={{ fontSize:10, color:'#484f58' }}>{tickers.length}</span>
            </div>
            <div style={{ padding:'8px 12px', display:'flex', flexWrap:'wrap', gap:6 }}>
              {tickers.map(t => (
                <span key={t.ticker} style={{
                  fontSize:10, fontWeight:700, color:'#e6edf3',
                  background:'#161b22', borderRadius:4, padding:'2px 6px',
                }}>
                  {t.ticker}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button onClick={reset} style={{ ...btnStyle('#161b22', '#8b949e'), width:'100%', border:'1px solid #21262d' }}>
        Importer une autre liste
      </button>
    </div>
  );

  return null;
}

// ─── CLASSIFIER VIEW ──────────────────────────────────────────────────────────
function ClassifyView() {
  const [mode, setMode]               = useState('single');
  const [name, setName]               = useState('');
  const [ticker, setTicker]           = useState('');
  const [result, setResult]           = useState(null);
  const [batchText, setBatchText]     = useState('');
  const [batchResults, setBatchResults] = useState(null);
  const [saved, setSaved]             = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);

  async function classify() {
    if (!name || !ticker) return;
    setLoading(true); setResult(null); setError(null);
    try {
      const data = await classifyTicker(name, ticker.toUpperCase());
      setResult(data);
      if (data && !data.error) await saveTickersToSupabase([data]);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  function parseLines(text) {
    return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
      const d = line.match(/^([A-Z0-9.]+)\s*[-–]\s*(.+)$/);
      const p = line.match(/^(.+?)\s*\(([A-Z0-9.]+)\)$/);
      const s = line.match(/^([A-Z0-9.]{1,6})\s+(.+)$/);
      if (d) return { ticker: d[1].trim(), name: d[2].trim() };
      if (p) return { ticker: p[2].trim(), name: p[1].trim() };
      if (s) return { ticker: s[1].trim(), name: s[2].trim() };
      return { ticker: line, name: line };
    });
  }

  async function classifyAll() {
    const items = parseLines(batchText);
    if (!items.length) return;
    setLoading(true); setBatchResults(null); setSaved(false); setError(null);
    try {
      let allResults = [];
      const chunks = [];
      for (let i = 0; i < items.length; i += 10) chunks.push(items.slice(i, i + 10));
      for (let i = 0; i < chunks.length; i++) {
        setError(`⏳ ${i + 1}/${chunks.length}...`);
        const res = await classifyBatch(chunks[i]);
        if (res.length > 0) { await saveTickersToSupabase(res); allResults = [...allResults, ...res]; }
      }
      setBatchResults(allResults); setSaved(true); setError(null);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:16,
        background:'#0d1117', padding:4, borderRadius:8 }}>
        {['single','batch'].map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            flex:1, padding:'7px 4px', borderRadius:6, border:'none', cursor:'pointer',
            fontSize:11, fontWeight:600,
            background: mode === m ? '#f0b429' : 'transparent',
            color: mode === m ? '#0d1117' : '#8b949e',
          }}>
            {m === 'single' ? '⚡ Un ticker' : '📋 Batch'}
          </button>
        ))}
      </div>

      {mode === 'single' && (
        <div>
          <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:14 }}>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Nom complet (ex: Broadcom)" style={inputStyle} />
            <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())}
              placeholder="Ticker (ex: AVGO)" style={inputStyle} />
            <button onClick={classify} disabled={loading || !name || !ticker} style={{
              background: loading||!name||!ticker ? '#161b22' : '#f0b429',
              color: loading||!name||!ticker ? '#484f58' : '#0d1117',
              border:'none', borderRadius:8, padding:10, fontSize:13, fontWeight:700,
              cursor: loading||!name||!ticker ? 'not-allowed' : 'pointer',
            }}>
              {loading ? '⏳ Classification...' : '🤖 Classifier + Sauvegarder'}
            </button>
          </div>
          {result && !result.error && (
            <div style={{ background:'#0d1117', border:'1px solid #21262d',
              borderRadius:10, padding:14 }}>
              <div style={{ fontSize:11, color:'#3fb950', marginBottom:8 }}>✓ Ajouté</div>
              {[
                ['Secteur', result.secteur, '#58a6ff'],
                ['Driver', result.driver_principal, '#e6edf3'],
                ['Bourse', result.bourse, '#8b949e'],
                ['Type', result.type, TYPE_COLOR[result.type] || '#8b949e'],
              ].map(([l, v, c]) => (
                <div key={l} style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:11, color:'#484f58' }}>{l}</span>
                  <span style={{ fontSize:11, fontWeight:600, color:c }}>{v}</span>
                </div>
              ))}
            </div>
          )}
          {error && <div style={{ color:'#f85149', fontSize:12 }}>❌ {error}</div>}
        </div>
      )}

      {mode === 'batch' && (
        <div>
          <textarea value={batchText} onChange={e => setBatchText(e.target.value)}
            placeholder={'AVGO - Broadcom\nSNPS - Synopsys\nORCL - Oracle'} rows={10}
            style={{ ...inputStyle, resize:'vertical', fontFamily:'monospace', fontSize:12, lineHeight:'1.6' }} />
          <button onClick={classifyAll} disabled={loading || !batchText.trim()} style={{
            width:'100%', marginTop:10,
            background: loading || !batchText.trim() ? '#161b22' : '#f0b429',
            color: loading || !batchText.trim() ? '#484f58' : '#0d1117',
            border:'none', borderRadius:8, padding:10, fontSize:13, fontWeight:700,
            cursor: loading || !batchText.trim() ? 'not-allowed' : 'pointer',
          }}>
            {loading ? error || '⏳ En cours...' : `🤖 Classifier ${batchText.split('\n').filter(Boolean).length} lignes`}
          </button>
          {saved && batchResults && (
            <div style={{ marginTop:10, fontSize:11, color:'#3fb950' }}>
              ✓ {batchResults.length} tickers sauvegardés
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── EXPORT PRINCIPAL ─────────────────────────────────────────────────────────
export default function MomentumModule() {
  const [tab, setTab]           = useState('portfolio');
  const [tickers, setTickers]   = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [period, setPeriod]     = useState('1J');
  const [loading, setLoading]   = useState(true);

  async function loadData() {
    try {
      const [tRes, sRes] = await Promise.all([
        fetch('/api/portfolio'),
        fetch('/api/portfolio/latest-snapshot'),
      ]);
      const tData = await tRes.json();
      const sData = await sRes.json();
      setTickers(tData.raw || []);
      setSnapshots(sData.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  const tabs = [
    { id:'portfolio',    label:'📊 Portfolio' },
    { id:'performance',  label:'📈 Perf' },
    { id:'import',       label:'📥 Importer' },
    { id:'classify',     label:'🤖 Classifier' },
  ];

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18 }}>
        <span style={{ fontSize:22 }}>⚡</span>
        <h2 style={{ fontSize:20, fontWeight:800, color:'#e6edf3',
          fontFamily:'Syne, sans-serif', margin:0 }}>Momentum</h2>
        {loading && <span style={{ fontSize:10, color:'#484f58', marginLeft:'auto' }}>Chargement...</span>}
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:18,
        background:'#0d1117', padding:4, borderRadius:10 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex:1, padding:'8px 4px', borderRadius:8, border:'none', cursor:'pointer',
            fontSize:10, fontWeight:600, transition:'all .15s',
            background: tab === t.id ? '#f0b429' : 'transparent',
            color: tab === t.id ? '#0d1117' : '#8b949e',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'portfolio' && (
        <PortfolioView tickers={tickers} snapshots={snapshots} period={period} setPeriod={setPeriod} />
      )}
      {tab === 'performance' && <PerformanceView tickers={tickers} snapshots={snapshots} />}
      {tab === 'import' && <ImportView onImportDone={() => { loadData(); setTab('portfolio'); }} />}
      {tab === 'classify' && <ClassifyView />}
    </div>
  );
}

const inputStyle = {
  width:'100%', background:'#0d1117', border:'1px solid #21262d',
  borderRadius:8, padding:'10px 14px', color:'#e6edf3',
  fontSize:13, outline:'none', boxSizing:'border-box',
};

function btnStyle(bg, color) {
  return {
    background: bg, color,
    border: 'none', borderRadius: '8px',
    padding: '10px 16px', fontSize: '12px',
    fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
  };
}
