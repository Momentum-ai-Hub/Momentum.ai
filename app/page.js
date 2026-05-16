'use client';
import { useState } from 'react';
import EarningsModule    from '../components/EarningsModule';
import DriftModule       from '../components/DriftModule';
import MomentumModule    from '../components/MomentumModule';
import CommoditiesModule from '../components/CommoditiesModule';
import MorningEdgeModule from '../components/MorningEdgeModule';

const TRACK_RECORD = [
  { date:'07/05', ticker:'DDOG',  verdict:'BUY',       resultat:'+30%',             ok:true  },
  { date:'07/05', ticker:'MCD',   verdict:'BUY',       resultat:'+3%',              ok:true  },
  { date:'07/05', ticker:'MELI',  verdict:'AVOID',     resultat:'Négatif',          ok:true  },
  { date:'07/05', ticker:'VST',   verdict:'AVOID',     resultat:'Négatif',          ok:true  },
  { date:'07/05', ticker:'SHEL',  verdict:'AVOID',     resultat:'Négatif',          ok:true  },
  { date:'07/05', ticker:'U',     verdict:'AVOID',     resultat:'Négatif',          ok:true  },
  { date:'07/05', ticker:'PTON',  verdict:'AVOID',     resultat:'+7% variance',     ok:false },
  { date:'08/05', ticker:'MNST',  verdict:'BUY',       resultat:'+8.30%',           ok:true  },
  { date:'08/05', ticker:'DKNG',  verdict:'BUY',       resultat:'+3.77%',           ok:true  },
  { date:'08/05', ticker:'DDOG',  verdict:'BUY',       resultat:'+30%',             ok:true  },
  { date:'08/05', ticker:'NET',   verdict:'BUY',       resultat:'-9.95% guidance',  ok:false },
  { date:'08/05', ticker:'PTON',  verdict:'AVOID',     resultat:'-1.06%',           ok:true  },
  { date:'12/05', ticker:'HIMS',  verdict:'AVOID',     resultat:'-17.6%',           ok:true  },
  { date:'12/05', ticker:'GTM',   verdict:'AVOID',     resultat:'-28.6%',           ok:true  },
  { date:'12/05', ticker:'BAYN',  verdict:'BUY FORT',  resultat:'+6% ★',            ok:true  },
  { date:'13/05', ticker:'FNV',   verdict:'NEUTRE',    resultat:'-1.19% ★★',        ok:true  },
];

function TrackRecord() {
  const wins  = TRACK_RECORD.filter(t => t.ok).length;
  const total = TRACK_RECORD.length;
  const rate  = ((wins / total) * 100).toFixed(1);

  const verdictColor = {
    'BUY FORT': '#3fb950',
    'BUY':      '#58a6ff',
    'NEUTRE':   '#e3b341',
    'AVOID':    '#f85149',
  };

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px' }}>
        <span style={{ fontSize:'22px' }}>🏆</span>
        <h2 style={{ fontSize:'20px', fontWeight:800, color:'#e6edf3', fontFamily:'Syne, sans-serif', margin:0 }}>
          Track Record
        </h2>
      </div>

      <div style={{
        background:'linear-gradient(135deg,rgba(63,185,80,0.15),rgba(240,180,41,0.1))',
        border:'1px solid rgba(63,185,80,0.2)', borderRadius:'12px',
        padding:'16px', marginBottom:'20px', textAlign:'center',
      }}>
        <div style={{ fontSize:'42px', fontWeight:800, color:'#3fb950', fontFamily:'Syne, sans-serif' }}>
          {rate}%
        </div>
        <div style={{ fontSize:'13px', color:'#8b949e', marginTop:'4px' }}>{wins}/{total} décisions correctes</div>
        <div style={{ fontSize:'11px', color:'#484f58', marginTop:'8px' }}>
          Résultat = Compétence + Variance
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
        {[...TRACK_RECORD].reverse().map((t, i) => (
          <div key={i} style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'8px 10px', background:'#0d1117',
            border:'1px solid #21262d', borderRadius:'8px',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <span style={{ fontSize:'10px', color:'#484f58', minWidth:'36px' }}>{t.date}</span>
              <span style={{ fontSize:'13px', fontWeight:700, color:'#e6edf3', minWidth:'44px' }}>{t.ticker}</span>
              <span style={{ fontSize:'10px', fontWeight:600, color: verdictColor[t.verdict] || '#8b949e' }}>
                {t.verdict}
              </span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
              <span style={{ fontSize:'11px', color:'#8b949e' }}>{t.resultat}</span>
              <span style={{ fontSize:'14px' }}>{t.ok ? '✅' : '❌'}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ fontSize:'10px', color:'#484f58', marginTop:'12px', lineHeight:'1.8' }}>
        ★ BAYN : signal détecté mais non tradeable (marché fermé)<br/>
        ★★ FNV : reclassé NEUTRE après règle 'already priced in' (+23.7% YTD)
      </div>
    </div>
  );
}

const TABS = [
  { id:'earnings',  emoji:'📊', label:'Earnings'  },
  { id:'drift',     emoji:'📈', label:'Drift'      },
  { id:'momentum',  emoji:'⚡', label:'Momentum'  },
  { id:'mp',        emoji:'🌐', label:'MP'         },
  { id:'edge',      emoji:'🎯', label:'Edge'       },
  { id:'track',     emoji:'🏆', label:'Track'      },
];

export default function Home() {
  const [tab, setTab] = useState('earnings');

  return (
    <div style={{ minHeight:'100vh', background:'#080c10' }}>

      {/* HEADER */}
      <div style={{ background:'#0d1117', borderBottom:'1px solid #21262d', padding:'14px 20px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <h1 style={{ fontSize:'18px', fontWeight:800, color:'#f0b429', fontFamily:'Syne, sans-serif', margin:0 }}>
              Momentum.ai
            </h1>
            <p style={{ fontSize:'10px', color:'#484f58', marginTop:'1px', margin:0 }}>
              Earnings · Drift · Momentum · MP · Edge · Track
            </p>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:'14px', fontWeight:700, color:'#3fb950' }}>300€</div>
            <div style={{ fontSize:'10px', color:'#484f58' }}>Capital</div>
          </div>
        </div>
      </div>

      {/* CONTENU */}
      <div style={{ padding:'20px', maxWidth:'600px', margin:'0 auto', paddingBottom:'100px' }}>
        {tab === 'earnings'  && <EarningsModule />}
        {tab === 'drift'     && <DriftModule />}
        {tab === 'momentum'  && <MomentumModule />}
        {tab === 'mp'        && <CommoditiesModule />}
        {tab === 'edge'      && <MorningEdgeModule />}
        {tab === 'track'     && <TrackRecord />}
      </div>

      {/* NAV BAS */}
      <div style={{
        position:'fixed', bottom:0, left:0, right:0,
        background:'#0d1117', borderTop:'1px solid #21262d',
        display:'flex', justifyContent:'space-around', padding:'8px 0',
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              display:'flex', flexDirection:'column', alignItems:'center', gap:'2px',
              background:'none', border:'none', cursor:'pointer', padding:'4px 8px',
            }}
          >
            <span style={{ fontSize:'18px' }}>{t.emoji}</span>
            <span style={{ fontSize:'10px', fontWeight:600, color: tab === t.id ? '#f0b429' : '#484f58' }}>
              {t.label}
            </span>
            {tab === t.id && (
              <div style={{ width:'14px', height:'2px', background:'#f0b429', borderRadius:'1px' }} />
            )}
          </button>
        ))}
      </div>

    </div>
  );
}
