'use client';
import { useState } from 'react';
import { getPerf30d, analyzeDrift } from '../lib/api';

export default function DriftModule() {
  const [ticker, setTicker]       = useState('');
  const [earningsDate, setDate]   = useState('');
  const [result, setResult]       = useState('');
  const [loading, setLoading]     = useState(false);

  function getPhase(dateStr) {
    if (!dateStr) return null;
    const days = Math.round((new Date(dateStr) - new Date()) / 86400000);
    if (days >= 25 && days <= 30) return { label:`J-${days} · Phase identification (J-30 à J-25)`, color:'#8b949e', days };
    if (days >= 15 && days <= 24) return { label:`J-${days} · Surveillance active`, color:'#e3b341', days };
    if (days >= 1  && days <= 14) return { label:`✅ J-${days} · FENÊTRE ENTRÉE (J-20 à J-15)`, color:'#3fb950', days };
    if (days === 0)               return { label:'J-0 · Jour des résultats', color:'#f0b429', days };
    if (days < 0)                 return { label:'Earnings passés', color:'#f85149', days };
    return { label:`J-${days} · Trop tôt`, color:'#8b949e', days };
  }

  async function analyze() {
    if (!ticker || !earningsDate) return;
    setLoading(true);
    setResult('');
    try {
      const perf30d = await getPerf30d(ticker.toUpperCase()).catch(() => null);
      const res = await analyzeDrift(ticker.toUpperCase(), perf30d, earningsDate);
      setResult(res);
    } catch (e) {
      setResult('❌ Erreur : ' + e.message);
    }
    setLoading(false);
  }

  const phase = getPhase(earningsDate);

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px' }}>
        <span style={{ fontSize:'22px' }}>📈</span>
        <h2 style={{ fontSize:'20px', fontWeight:800, color:'#e6edf3', fontFamily:'Syne, sans-serif' }}>
          Pre-Earnings Drift
        </h2>
      </div>

      {/* Concept */}
      <div style={{ background:'rgba(240,180,41,0.07)', border:'1px solid rgba(240,180,41,0.2)', borderRadius:'10px', padding:'14px', marginBottom:'20px', fontSize:'11px', color:'#8b949e', lineHeight:'1.8' }}>
        <div style={{ color:'#f0b429', fontWeight:700, marginBottom:'8px', fontSize:'12px' }}>Concept</div>
        ~60% des titres qui vont beater dérivent haussièrement 2-4 semaines avant publication. Objectif : entrer J-20 à J-15, profiter du drift, sortir avant ou après les résultats.
      </div>

      {/* Règles */}
      <div style={{ background:'#0d1117', border:'1px solid #21262d', borderRadius:'10px', padding:'14px', marginBottom:'20px', fontSize:'11px', color:'#8b949e', lineHeight:'2' }}>
        <div style={{ color:'#e6edf3', fontWeight:700, marginBottom:'8px', fontSize:'12px' }}>Règles drift</div>
        <div>🔍 <span style={{ color:'#8b949e' }}>J-30 à J-25</span> → Identifier si base rate &gt; 65%</div>
        <div>✅ <span style={{ color:'#3fb950' }}>J-20 à J-15</span> → ENTRER — 40% capital <span style={{ color:'#f0b429' }}>(120€)</span></div>
        <div>📤 <span style={{ color:'#58a6ff' }}>J-0 Option A</span> → Vendre veille résultats (sécuriser)</div>
        <div>📤 <span style={{ color:'#58a6ff' }}>J-0 Option B</span> → Garder si signal earnings fort</div>
        <div>⛔ <span style={{ color:'#f85149' }}>STOP</span> si titre &gt;+15% avant résultats → sortir</div>
        <div>🔒 Stop loss drift : <span style={{ color:'#f85149' }}>-7%</span> | Trailing stop à +5% → break-even</div>
      </div>

      {/* Inputs */}
      <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'16px' }}>
        <input
          value={ticker}
          onChange={e => setTicker(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && analyze()}
          placeholder="Ticker (ex: NVDA)"
          style={inputStyle}
        />
        <div>
          <label style={{ fontSize:'11px', color:'#8b949e', display:'block', marginBottom:'4px' }}>Date de publication des earnings</label>
          <input type="date" value={earningsDate} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, colorScheme:'dark' }} />
        </div>

        {/* Phase indicator */}
        {phase && (
          <div style={{ background:'#161b22', border:`1px solid ${phase.color}44`, borderRadius:'8px', padding:'10px 14px', fontSize:'12px', color:phase.color, fontWeight:600 }}>
            {phase.label}
          </div>
        )}

        <button
          onClick={analyze}
          disabled={loading || !ticker || !earningsDate}
          style={{ background: loading || !ticker || !earningsDate ? '#161b22' : '#f0b429', color: loading || !ticker || !earningsDate ? '#484f58' : '#080c10', border:'none', borderRadius:'8px', padding:'12px', fontSize:'13px', fontWeight:700, cursor: loading || !ticker || !earningsDate ? 'not-allowed' : 'pointer', width:'100%' }}
        >
          {loading ? '⏳ Analyse en cours...' : '🔍 Analyser le drift'}
        </button>
      </div>

      {/* Résultat */}
      {result && (
        <div style={{ background:'#0d1117', border:'1px solid #21262d', borderRadius:'10px', padding:'16px' }}>
          <pre style={{ whiteSpace:'pre-wrap', fontSize:'12px', lineHeight:'1.7', color:'#c9d1d9', fontFamily:'IBM Plex Mono, monospace' }}>
            {result}
          </pre>
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  width:'100%', background:'#0d1117', border:'1px solid #21262d', borderRadius:'8px',
  padding:'10px 14px', color:'#e6edf3', fontSize:'13px', outline:'none',
};
