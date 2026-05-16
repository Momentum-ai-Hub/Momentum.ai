'use client';
import { useState } from 'react';
import { getCommodityChange } from '../lib/api';

// Section 5 du prompt v1.0 — strictement
const COMMODITIES = [
  {
    symbol: 'XAU/USD',
    label: '🥇 Or',
    desc: 'Prix or vs J-1 → impact FNV, Gold Reserve',
    actions_hausse: ['FNV', 'Gold Reserve', 'Antimony Resources'],
    actions_baisse: [],
  },
  {
    symbol: 'USOIL',
    label: '🛢️ Pétrole WTI/Brent',
    desc: 'Prix WTI vs J-1 → impact TotalEnergies, Eni, Repsol...',
    actions_hausse: ['TotalEnergies', 'Eni', 'Repsol', 'Equinor', 'OMV', 'MOL', 'Vallourec', 'TechnipFMC'],
    actions_baisse: [],
  },
  {
    symbol: 'NATGAS',
    label: '🔥 Gaz naturel',
    desc: 'Prix gaz naturel → impact Enagas, SNAM...',
    actions_hausse: ['Enagas', 'SNAM', 'Naturgy', 'Air Products', 'Air Liquide', 'Linde'],
    actions_baisse: [],
  },
  {
    symbol: 'LIT',
    label: '🔋 Lithium carbonate',
    desc: 'Prix lithium carbonate (semaine) → impact ALB, SQM, LAC',
    actions_hausse: ['Albemarle', 'SQM', 'Lithium Americas', 'Ganfeng', 'Samsung SDI'],
    actions_baisse: ['Tesla (coûts batteries)'],
  },
  {
    symbol: 'COPPER',
    label: '🔶 Cuivre LME',
    desc: 'Prix cuivre LME → impact FCX, GLEN, RIO, Prysmian',
    actions_hausse: ['Freeport McMoRan', 'Glencore', 'Rio Tinto', 'BHP', 'Prysmian', 'Schneider', 'ABB'],
    actions_baisse: [],
  },
  {
    symbol: 'URA',
    label: '☢️ Uranium spot',
    desc: 'Prix uranium spot → impact CCJ, Energy Fuels',
    actions_hausse: ['Cameco', 'Energy Fuels', 'Centrus', 'CEZ', 'Oklo'],
    actions_baisse: [],
  },
  {
    symbol: 'MP',
    label: '🌍 Terres rares',
    desc: 'Prix terres rares + politique USA/Chine',
    actions_hausse: ['MP Materials', 'Lynas', 'Ucore', 'Brazilian RE', 'Critical Metals'],
    actions_baisse: ['Semis (coûts matières)'],
  },
  {
    symbol: 'SOX',
    label: '💻 SOX Index',
    desc: 'SOX Index → impact ensemble cluster semiconducteurs',
    actions_hausse: ['NVIDIA', 'AMD', 'ASML', 'TSMC', 'Micron', 'Lam Research', 'Applied Materials'],
    actions_baisse: [],
  },
  {
    symbol: 'BTC/USD',
    label: '₿ Bitcoin',
    desc: 'Prix Bitcoin → impact HUT 8',
    actions_hausse: ['HUT 8'],
    actions_baisse: [],
  },
];

export default function CommoditiesModule() {
  const [data, setData]       = useState({});
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLast] = useState('');

  async function loadAll() {
    setLoading(true);
    const results = {};
    await Promise.all(
      COMMODITIES.map(async (c) => {
        try {
          const change5d = await getCommodityChange(c.symbol, 5);
          results[c.symbol] = change5d;
        } catch {
          results[c.symbol] = null;
        }
      })
    );
    setData(results);
    setLast(new Date().toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }));
    setLoading(false);
  }

  function getSignal(change) {
    if (change === null) return { color:'#484f58', label:'—', trigger:false };
    if (change >= 5)  return { color:'#3fb950', label:'▲ SIGNAL +5%', trigger:true,  dir:'hausse' };
    if (change >= 2)  return { color:'#8bc34a', label:'▲ Haussier',   trigger:false, dir:'hausse' };
    if (change <= -5) return { color:'#f85149', label:'▼ SIGNAL -5%', trigger:true,  dir:'baisse' };
    if (change <= -2) return { color:'#ff9800', label:'▼ Baissier',   trigger:false, dir:'baisse' };
    return { color:'#8b949e', label:'→ Neutre', trigger:false };
  }

  const signalsActifs = COMMODITIES.filter(c => {
    const s = getSignal(data[c.symbol]);
    return s.trigger;
  }).length;

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <span style={{ fontSize:'22px' }}>🌐</span>
          <h2 style={{ fontSize:'20px', fontWeight:800, color:'#e6edf3', fontFamily:'Syne, sans-serif' }}>Matières Premières</h2>
        </div>
        {lastUpdate && (
          <span style={{ fontSize:'10px', color:'#484f58' }}>Maj {lastUpdate}</span>
        )}
      </div>

      {/* Règle anticipation */}
      <div style={{ background:'rgba(240,180,41,0.07)', border:'1px solid rgba(240,180,41,0.2)', borderRadius:'10px', padding:'14px', marginBottom:'16px', fontSize:'11px', color:'#8b949e', lineHeight:'1.7' }}>
        <span style={{ color:'#f0b429', fontWeight:700 }}>★ Règle anticipation : </span>
        Si MP monte &gt;+5% sur 5 jours → actions corrélées ont drift potentiel → chercher entrée pre-earnings ou swing si publication dans 30J
      </div>

      {/* Signals actifs */}
      {signalsActifs > 0 && (
        <div style={{ background:'rgba(63,185,80,0.1)', border:'1px solid rgba(63,185,80,0.3)', borderRadius:'10px', padding:'12px 16px', marginBottom:'16px', fontSize:'12px', color:'#3fb950', fontWeight:700 }}>
          ⚡ {signalsActifs} signal{signalsActifs > 1 ? 's' : ''} actif{signalsActifs > 1 ? 's' : ''} détecté{signalsActifs > 1 ? 's' : ''}
        </div>
      )}

      {/* Bouton */}
      <button onClick={loadAll} disabled={loading} style={{ background:'#161b22', color:'#e6edf3', border:'1px solid #21262d', borderRadius:'8px', padding:'12px', fontSize:'13px', fontWeight:600, cursor:'pointer', width:'100%', marginBottom:'20px' }}>
        {loading ? '⏳ Chargement...' : '🔄 Checklist quotidienne (2 min)'}
      </button>

      {/* Liste MP */}
      <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
        {COMMODITIES.map(c => {
          const change = data[c.symbol] ?? null;
          const sig    = getSignal(change);

          return (
            <div key={c.symbol} style={{ background:'#0d1117', border:`1px solid ${sig.trigger ? sig.color + '55' : '#21262d'}`, borderRadius:'10px', padding:'14px 16px' }}>

              {/* Ligne principale */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: sig.trigger ? '10px' : '0' }}>
                <div>
                  <div style={{ fontSize:'13px', fontWeight:700, color:'#e6edf3' }}>{c.label}</div>
                  <div style={{ fontSize:'10px', color:'#484f58', marginTop:'2px' }}>{c.desc}</div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0, marginLeft:'12px' }}>
                  {change !== null && (
                    <div style={{ fontSize:'15px', fontWeight:700, color:sig.color }}>
                      {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                    </div>
                  )}
                  <div style={{ fontSize:'10px', fontWeight:600, color:sig.color }}>{sig.label}</div>
                </div>
              </div>

              {/* Actions corrélées si signal déclenché */}
              {sig.trigger && sig.dir === 'hausse' && c.actions_hausse.length > 0 && (
                <div style={{ borderTop:'1px solid #161b22', paddingTop:'10px' }}>
                  <div style={{ fontSize:'10px', color:'#3fb950', fontWeight:600, marginBottom:'6px' }}>▲ Surveiller :</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'4px' }}>
                    {c.actions_hausse.map(a => (
                      <span key={a} style={{ fontSize:'11px', color:'#8b949e', background:'#161b22', padding:'3px 8px', borderRadius:'4px' }}>{a}</span>
                    ))}
                  </div>
                </div>
              )}
              {sig.trigger && sig.dir === 'baisse' && c.actions_baisse.length > 0 && (
                <div style={{ borderTop:'1px solid #161b22', paddingTop:'10px' }}>
                  <div style={{ fontSize:'10px', color:'#f85149', fontWeight:600, marginBottom:'6px' }}>▼ Éviter :</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'4px' }}>
                    {c.actions_baisse.map(a => (
                      <span key={a} style={{ fontSize:'11px', color:'#8b949e', background:'#161b22', padding:'3px 8px', borderRadius:'4px' }}>{a}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
