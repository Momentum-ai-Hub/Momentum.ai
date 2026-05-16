'use client';
import { useState } from 'react';
import { classifyTicker } from '../lib/api';

// ─── PORTEFEUILLE 21 SECTEURS (Section 4 du prompt) ──────────────────────────
const PORTFOLIO = {
  'SEMICONDUCTEURS': ['NVIDIA','AMD','Qualcomm','Intel','Marvell Technology','Applied Materials','Lam Research','ASML','TSMC','ARM','Broadcom','Sivers Semi','Tower Semi','Alpha & Omega','Vishay','Silicon Motion','Microchip','Rambus','Vicor','Himax','Aehr Test','STMicroelectronics','Infineon','Soitec','ams-OSRAM','BE Semiconductors','ASM International','LPKF','POET Technologies','Riber','PVA TePla','Coherent','Navitas','Aeva','One Stop Systems','2CRSI'],
  'MÉMOIRE & STOCKAGE': ['Micron','Seagate','Western Digital','Kioxia','SK Hynix','Everspin','NetApp'],
  'INFRA AI & CLOUD': ['Alphabet','Amazon','Meta','Apple','IBM','ServiceNow','Adobe','Datadog','Nebius','CoreWeave','Cisco','Vertiv','HP','Dell','OVH','IONOS'],
  'NUCLÉAIRE & URANIUM': ['Cameco','CEZ','Oklo','Energy Fuels','Centrus'],
  'PÉTROLE & GAZ': ['TotalEnergies','Eni','Repsol','Equinor','OMV','MOL','Vallourec','TechnipFMC','Maire Tecnimont'],
  'ÉNERGIE RENOUVELABLE': ['RWE','Siemens Energy','Fluence','Bloom Energy','Plug Power','Fuelcell','Ceres Power','T1 Energy','GE Vernova','GE Aerospace','Schneider Electric','ABB','Prysmian','Eaton','Enagas','SNAM','Naturgy','IREN'],
  'OR & MÉTAUX PRÉCIEUX': ['Franco-Nevada','Gold Reserve','Antimony Resources'],
  'LITHIUM & BATTERIES': ['Albemarle','SQM','Lithium Americas','Ganfeng','Electrovaya','Samsung SDI','European Lithium'],
  'TERRES RARES': ['MP Materials','Lynas','Ucore','Rare Earth & Strategic Metals','Energy Transition Metals','Critical Metals','Trilogy Metals','Brazilian Rare Earths'],
  'MINES & MÉTAUX DE BASE': ['Freeport McMoRan','Glencore','Rio Tinto','BHP','Cleveland-Cliffs','Sandvik','Derichebourg'],
  'DÉFENSE & AÉROSPATIALE': ['Rheinmetall','Airbus','Rolls Royce','Boeing','GE Aerospace','Thales','Exail Technologies','Assystem','Parrot','MilDef','Ondas Holdings','Arteche','Firefly Aerospace'],
  'SPACE & SATELLITE': ['Rocket Lab','Intuitive Machines','AST SpaceMobile','Planet Labs','Gilat Satellite','Exosens'],
  'QUANTIQUE & DEEP TECH': ['IonQ','D-Wave','Rigetti'],
  'ROBOTIQUE & AUTO.': ['Kraken Robotics','ICOP S.p.A.'],
  'CHIMIE & MATÉRIAUX': ['Linde','Air Products','Air Liquide','Nutrien','Hawkins'],
  'LUXE & CONSO PREMIUM': ['LVMH','Hermes','Ahold Delhaize','Monster Beverage'],
  'INFRA & CONSTRUCTION': ['VINCI','Siemens','Lacroix','Planisware'],
  'FINANCE & FINTECH': ['Goldman Sachs','Blackstone','BlackRock','Citigroup','Visa','Mastercard','Banca Monte Paschi','Circle Internet'],
  'BIOTECH & MEDTECH': ['Illumina','Nanobiotix','MedinCell'],
  'CRYPTO MINING': ['HUT 8'],
  'TELECOM & OPTIQUE': ['Lumentum','Applied Optoelectronics','Raspberry Pi','Prosus','Corning'],
};

function PortfolioView() {
  const [search, setSearch] = useState('');
  const [open, setOpen]     = useState(null);

  const filtered = Object.entries(PORTFOLIO).reduce((acc, [sector, tickers]) => {
    const q = search.toLowerCase();
    const matched = q ? tickers.filter(t => t.toLowerCase().includes(q)) : tickers;
    if (matched.length) acc[sector] = matched;
    return acc;
  }, {});

  return (
    <div>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Rechercher un titre..."
        style={{ ...inputStyle, marginBottom:'16px' }}
      />
      <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
        {Object.entries(filtered).map(([sector, tickers]) => (
          <div key={sector} style={{ background:'#0d1117', border:'1px solid #21262d', borderRadius:'10px', overflow:'hidden' }}>
            <button
              onClick={() => setOpen(open === sector ? null : sector)}
              style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', background:'none', border:'none', cursor:'pointer' }}
            >
              <span style={{ fontSize:'12px', fontWeight:700, color:'#e6edf3' }}>{sector}</span>
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <span style={{ fontSize:'10px', color:'#484f58' }}>{tickers.length} titres</span>
                <span style={{ fontSize:'12px', color:'#484f58' }}>{open === sector ? '▲' : '▼'}</span>
              </div>
            </button>
            {open === sector && (
              <div style={{ borderTop:'1px solid #161b22', padding:'12px 16px', display:'flex', flexWrap:'wrap', gap:'6px' }}>
                {tickers.map(t => (
                  <span key={t} style={{ fontSize:'11px', color:'#8b949e', background:'#161b22', padding:'3px 8px', borderRadius:'4px' }}>{t}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ClassifyView() {
  const [name, setName]       = useState('');
  const [ticker, setTicker]   = useState('');
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);

  async function classify() {
    if (!name || !ticker) return;
    setLoading(true);
    setResult(null);
    try {
      const data = await classifyTicker(name, ticker.toUpperCase());
      setResult(data);
    } catch (e) {
      setResult({ error: e.message });
    }
    setLoading(false);
  }

  const typeColor = { 'EARNINGS PLAY':'#3fb950', 'TITRE DE FOND':'#e3b341', 'SPÉCULATIF':'#f85149' };

  return (
    <div>
      <p style={{ fontSize:'11px', color:'#8b949e', marginBottom:'16px', lineHeight:'1.6' }}>
        Ajoute un nouveau titre : Claude le classe automatiquement dans le bon secteur avec son driver MP.
      </p>
      <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'16px' }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nom complet (ex: Rheinmetall)" style={inputStyle} />
        <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} placeholder="Ticker (ex: RHM)" style={inputStyle} />
        <button
          onClick={classify}
          disabled={loading || !name || !ticker}
          style={{ background:loading||!name||!ticker?'#161b22':'#f0b429', color:loading||!name||!ticker?'#484f58':'#080c10', border:'none', borderRadius:'8px', padding:'12px', fontSize:'13px', fontWeight:700, cursor:loading||!name||!ticker?'not-allowed':'pointer' }}
        >
          {loading ? '⏳ Classification...' : '🏷️ Classifier avec Claude'}
        </button>
      </div>
      {result && !result.error && (
        <div style={{ background:'#0d1117', border:'1px solid #21262d', borderRadius:'10px', padding:'16px', display:'flex', flexDirection:'column', gap:'10px' }}>
          <Row label="Secteur"   value={result.secteur}          color="#58a6ff" />
          <Row label="Driver"    value={result.driver_principal} color="#e6edf3" />
          <Row label="Bourse"    value={result.bourse}           color="#8b949e" />
          <Row label="Type"      value={result.type}             color={typeColor[result.type]||'#e6edf3'} />
          {result.matieres_premieres?.length > 0 && (
            <div>
              <span style={{ fontSize:'11px', color:'#484f58', display:'block', marginBottom:'4px' }}>Matières premières</span>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'4px' }}>
                {result.matieres_premieres.map(mp => (
                  <span key={mp} style={{ fontSize:'11px', color:'#e3b341', background:'rgba(227,179,65,0.1)', padding:'2px 8px', borderRadius:'4px' }}>{mp}</span>
                ))}
              </div>
            </div>
          )}
          <div style={{ display:'flex', gap:'8px', marginTop:'4px', flexWrap:'wrap' }}>
            <Tag label="Earnings play"           active={result.earnings_play} />
            <Tag label="Already priced in risk"  active={result.already_priced_in_risk} color="#f85149" />
          </div>
        </div>
      )}
      {result?.error && <div style={{ color:'#f85149', fontSize:'12px' }}>❌ {result.error}</div>}
    </div>
  );
}

function Row({ label, value, color }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
      <span style={{ fontSize:'11px', color:'#484f58' }}>{label}</span>
      <span style={{ fontSize:'12px', fontWeight:600, color }}>{value}</span>
    </div>
  );
}

function Tag({ label, active, color='#3fb950' }) {
  return (
    <span style={{ fontSize:'10px', fontWeight:600, color:active?color:'#484f58', background:active?color+'15':'#161b22', border:`1px solid ${active?color+'44':'#21262d'}`, padding:'3px 8px', borderRadius:'4px' }}>
      {active?'✓':'✗'} {label}
    </span>
  );
}

// ─── EXPORT PRINCIPAL ─────────────────────────────────────────────────────────
export default function MomentumModule() {
  const [tab, setTab] = useState('portfolio');
  const tabs = [
    { id:'portfolio', label:'📋 Portefeuille' },
    { id:'classify',  label:'🏷️ Classifier'  },
  ];
  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px' }}>
        <span style={{ fontSize:'22px' }}>⚡</span>
        <h2 style={{ fontSize:'20px', fontWeight:800, color:'#e6edf3', fontFamily:'Syne, sans-serif' }}>Momentum</h2>
      </div>
      <div style={{ display:'flex', gap:'8px', marginBottom:'24px', background:'#0d1117', padding:'6px', borderRadius:'10px', border:'1px solid #21262d' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex:1, padding:'8px 4px', borderRadius:'7px', border:'none', background:tab===t.id?'#f0b429':'transparent', color:tab===t.id?'#080c10':'#8b949e', fontSize:'12px', fontWeight:tab===t.id?700:400, cursor:'pointer' }}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'portfolio' && <PortfolioView />}
      {tab === 'classify'  && <ClassifyView />}
    </div>
  );
}

const inputStyle = {
  width:'100%', background:'#0d1117', border:'1px solid #21262d', borderRadius:'8px',
  padding:'10px 14px', color:'#e6edf3', fontSize:'13px', outline:'none',
};
