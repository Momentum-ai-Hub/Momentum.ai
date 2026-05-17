'use client';
import { useState, useEffect } from 'react';
import { classifyTicker, classifyBatch, saveTickersToSupabase, loadPortfolioFromSupabase } from '../lib/api';

// ─── PORTEFEUILLE DE SECOURS (si Supabase vide ou erreur) ────────────────────
const PORTFOLIO_FALLBACK = {
  'SEMICONDUCTEURS': ['NVIDIA','AMD','Qualcomm','Intel','Marvell Technology','Applied Materials','ASML','Lam Research','Tokyo Electron','Aixtron'],
  'MÉMOIRE & STOCKAGE': ['Micron','Seagate','Western Digital','Kioxia','SK Hynix','Everspin'],
  'INFRA AI & CLOUD': ['Alphabet','Amazon','Meta','Apple','IBM','ServiceNow','Adobe','Datadog','DigitalOcean','Oracle','Salesforce','Workday','Broadcom'],
  'NUCLÉAIRE & URANIUM': ['Cameco','CEZ','Oklo','Energy Fuels','Centrus'],
  'PÉTROLE & GAZ': ['TotalEnergies','Eni','Repsol','Equinor','OMV','MOL','Vallourec','TechnipFMC'],
  'ÉNERGIE RENOUVELABLE': ['RWE','Siemens Energy','Fluence','Bloom Energy','Plug Power','Fuel Cell','Xcel Energy','SolarEdge','HydroGraph Clean Power','Enovix'],
  'OR & MÉTAUX PRÉCIEUX': ['Franco-Nevada','Gold Reserve','Antimony Resources'],
  'LITHIUM & BATTERIES': ['Albemarle','SQM','Lithium Americas','Ganfeng','Electrovaya','Samsung SDI'],
  'TERRES RARES': ['MP Materials','Lynas','Ucore','Rare Earth & Strategic Metals','Energy Transition'],
  'MINES & MÉTAUX DE BASE': ['Freeport McMoRan','Glencore','Rio Tinto','BHP','Cleveland-Cliffs','5N Plus'],
  'DÉFENSE & AÉROSPATIALE': ['Rheinmetall','Airbus','Rolls Royce','Boeing','GE Aerospace','TransDigm','Jabil','Axon Enterprise'],
  'SPACE & SATELLITE': ['Rocket Lab','Intuitive Machines','AST SpaceMobile','Planet Labs'],
  'QUANTIQUE & DEEP TECH': ['IonQ','D-Wave','Rigetti'],
  'ROBOTIQUE & AUTO.': ['Kraken Robotics','ICOP S.p.A.','Harmonic Drive Systems','Digi Power X'],
  'CHIMIE & MATÉRIAUX': ['Linde','Air Products','Air Liquide','Nutrien','Hawkins'],
  'LUXE & CONSO PREMIUM': ['LVMH','Hermes','Ahold Delhaize','Monster Beverage'],
  'INFRA & CONSTRUCTION': ['VINCI','Siemens','Lacroix','Planisware','IDEX','Waste Management','Equity Residential'],
  'FINANCE & FINTECH': ['Goldman Sachs','Blackstone','BlackRock','Citigroup','Visa','Mastercard','Barclays','PNC Financial','State Street','Ares Management','Intercontinental Exchange'],
  'BIOTECH & MEDTECH': ['Illumina','Nanobiotix','MedinCell'],
  'CRYPTO MINING': ['HUT 8','Bitcoin'],
  'TELECOM & OPTIQUE': ['Lumentum','Applied Optoelectronics','Raspberry Pi','Prosus','Corning','Nokia','F5','KLA Corporation','Cadence Design Systems','Synopsys','Texas Instruments'],
};

// ─── PORTFOLIO VIEW ───────────────────────────────────────────────────────────
function PortfolioView() {
  const [search,    setSearch]    = useState('');
  const [open,      setOpen]      = useState(null);
  const [portfolio, setPortfolio] = useState(PORTFOLIO_FALLBACK);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    loadPortfolioFromSupabase()
      .then(data => {
        // Merge Supabase + fallback (Supabase prioritaire)
        const merged = { ...PORTFOLIO_FALLBACK };
        Object.entries(data).forEach(([secteur, noms]) => {
          merged[secteur] = [...new Set([...(merged[secteur] || []), ...noms])];
        });
        setPortfolio(merged);
      })
      .catch(() => {}) // garde le fallback si erreur
      .finally(() => setLoading(false));
  }, []);

  const filtered = Object.entries(portfolio).reduce((acc, [sector, tickers]) => {
    const q = search.toLowerCase();
    const matched = q ? tickers.filter(t => t.toLowerCase().includes(q)) : tickers;
    if (matched.length) acc[sector] = matched;
    return acc;
  }, {});

  const total = Object.values(portfolio).flat().length;

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                    marginBottom:'12px' }}>
        <span style={{ fontSize:'11px', color:'#484f58' }}>
          {loading ? 'Chargement...' : `${total} titres · ${Object.keys(portfolio).length} secteurs`}
        </span>
      </div>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Rechercher un titre..."
        style={{ ...inputStyle, marginBottom:'16px' }}
      />
      <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
        {Object.entries(filtered).map(([sector, tickers]) => (
          <div key={sector} style={{ background:'#0d1117', border:'1px solid #21262d',
                                      borderRadius:'10px', overflow:'hidden' }}>
            <button
              onClick={() => setOpen(open === sector ? null : sector)}
              style={{ width:'100%', display:'flex', alignItems:'center',
                       justifyContent:'space-between', padding:'12px 16px',
                       background:'none', border:'none', cursor:'pointer' }}
            >
              <span style={{ fontSize:'12px', fontWeight:700, color:'#e6edf3' }}>{sector}</span>
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <span style={{ fontSize:'10px', color:'#484f58' }}>{tickers.length} titres</span>
                <span style={{ fontSize:'12px', color:'#484f58' }}>{open === sector ? '▲' : '▼'}</span>
              </div>
            </button>
            {open === sector && (
              <div style={{ borderTop:'1px solid #161b22', padding:'12px 16px',
                             display:'flex', flexWrap:'wrap', gap:'6px' }}>
                {tickers.map(t => (
                  <span key={t} style={{ fontSize:'11px', color:'#8b949e',
                    background:'#161b22', borderRadius:'4px', padding:'3px 8px' }}>
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── CLASSIFY VIEW ────────────────────────────────────────────────────────────
function ClassifyView() {
  const [mode,         setMode]         = useState('single');

  // Single
  const [name,   setName]   = useState('');
  const [ticker, setTicker] = useState('');
  const [result, setResult] = useState(null);

  // Batch
  const [batchText,    setBatchText]    = useState('');
  const [batchResults, setBatchResults] = useState(null);
  const [saved,        setSaved]        = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);

  // ── Single ──
  async function classify() {
    if (!name || !ticker) return;
    setLoading(true); setResult(null); setError(null);
    try {
      const data = await classifyTicker(name, ticker.toUpperCase());
      setResult(data);
      // Sauvegarde automatique en Supabase
      if (data && !data.error) {
        await saveTickersToSupabase([data]);
      }
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  // ── Batch ──
  function parseLines(text) {
    return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
      const dashMatch  = line.match(/^([A-Z0-9.]+)\s*[-–]\s*(.+)$/);
      const parenMatch = line.match(/^(.+?)\s*\(([A-Z0-9.]+)\)$/);
      const spaceMatch = line.match(/^([A-Z0-9.]{1,6})\s+(.+)$/);
      if (dashMatch)  return { ticker: dashMatch[1].trim(),  name: dashMatch[2].trim() };
      if (parenMatch) return { ticker: parenMatch[2].trim(), name: parenMatch[1].trim() };
      if (spaceMatch) return { ticker: spaceMatch[1].trim(), name: spaceMatch[2].trim() };
      return { ticker: line, name: line };
    });
  }

  async function classifyAll() {
    const items = parseLines(batchText);
    if (!items.length) return;
    setLoading(true); setBatchResults(null); setSaved(false); setError(null);
    try {
      const data = await classifyBatch(items);
      setBatchResults(data);
      // Sauvegarde automatique en Supabase
      if (data.length > 0) {
        await saveTickersToSupabase(data);
        setSaved(true);
      }
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  const typeColor = {
    'EARNINGS PLAY': '#3fb950',
    'TITRE DE FOND': '#e3b341',
    'SPÉCULATIF':    '#f85149',
  };

  const lineCount = batchText.split('\n').filter(l => l.trim()).length;

  return (
    <div>
      {/* Mode selector */}
      <div style={{ display:'flex', gap:'8px', marginBottom:'16px',
                    background:'#0d1117', padding:'4px', borderRadius:'8px' }}>
        {['single','batch'].map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            flex:1, padding:'7px 4px', borderRadius:'6px', border:'none',
            cursor:'pointer', fontSize:'11px', fontWeight:600,
            background: mode === m ? '#f0b429' : 'transparent',
            color:       mode === m ? '#0d1117' : '#8b949e',
          }}>
            {m === 'single' ? '⚡ Un ticker' : '📋 Batch (liste)'}
          </button>
        ))}
      </div>

      {/* ── SINGLE ── */}
      {mode === 'single' && (
        <div>
          <p style={{ fontSize:'11px', color:'#8b949e', marginBottom:'16px', lineHeight:'1.6' }}>
            Classe un titre et l'ajoute automatiquement au portfolio Supabase.
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'16px' }}>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Nom complet (ex: Broadcom)" style={inputStyle} />
            <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())}
              placeholder="Ticker (ex: AVGO)" style={inputStyle} />
            <button onClick={classify} disabled={loading || !name || !ticker} style={{
              background: loading||!name||!ticker ? '#161b22' : '#f0b429',
              color:       loading||!name||!ticker ? '#484f58' : '#0d1117',
              border:'none', borderRadius:'8px', padding:'10px',
              fontSize:'13px', fontWeight:700,
              cursor: loading||!name||!ticker ? 'not-allowed' : 'pointer',
            }}>
              {loading ? '⏳ Classification...' : '🤖 Classifier + Sauvegarder'}
            </button>
          </div>
          {result && !result.error && (
            <div style={{ background:'#0d1117', border:'1px solid #21262d',
                          borderRadius:'10px', padding:'14px',
                          display:'flex', flexDirection:'column', gap:'8px' }}>
              <div style={{ fontSize:'11px', color:'#3fb950', marginBottom:'4px' }}>
                ✓ Ajouté au portfolio
              </div>
              <Row label="Secteur" value={result.secteur}          color="#58a6ff" />
              <Row label="Driver"  value={result.driver_principal} color="#e6edf3" />
              <Row label="Bourse"  value={result.bourse}           color="#8b949e" />
              <Row label="Type"    value={result.type}             color={typeColor[result.type]} />
              <div style={{ display:'flex', gap:'8px', marginTop:'4px', flexWrap:'wrap' }}>
                <Tag label="Earnings play"          active={result.earnings_play} />
                <Tag label="Already priced in risk" active={result.already_priced_in_risk} color="#f85149" />
              </div>
            </div>
          )}
          {error && <div style={{ color:'#f85149', fontSize:'12px' }}>❌ {error}</div>}
        </div>
      )}

      {/* ── BATCH ── */}
      {mode === 'batch' && (
        <div>
          <p style={{ fontSize:'11px', color:'#8b949e', marginBottom:'12px', lineHeight:'1.6' }}>
            Colle ta liste — une ligne par ticker. Claude classifie tout et sauvegarde directement dans Supabase.
          </p>
          <div style={{ background:'#0d1117', border:'1px solid #21262d',
                        borderRadius:'8px', padding:'10px 14px', marginBottom:'12px' }}>
            {['AVGO - Broadcom', 'Broadcom (AVGO)', 'AVGO Broadcom'].map(ex => (
              <div key={ex} style={{ fontSize:'10px', color:'#484f58', fontFamily:'monospace' }}>
                {ex}
              </div>
            ))}
          </div>
          <textarea
            value={batchText}
            onChange={e => setBatchText(e.target.value)}
            placeholder={'AVGO - Broadcom\nSNPS - Synopsys\nORCL - Oracle\n...'}
            rows={10}
            style={{ ...inputStyle, resize:'vertical', fontFamily:'monospace',
                     fontSize:'12px', lineHeight:'1.6' }}
          />
          <button onClick={classifyAll} disabled={loading || !batchText.trim()} style={{
            width:'100%', marginTop:'10px',
            background: loading || !batchText.trim() ? '#161b22' : '#f0b429',
            color:       loading || !batchText.trim() ? '#484f58' : '#0d1117',
            border:'none', borderRadius:'8px', padding:'10px',
            fontSize:'13px', fontWeight:700,
            cursor: loading || !batchText.trim() ? 'not-allowed' : 'pointer',
          }}>
            {loading
              ? '⏳ Classification + sauvegarde...'
              : `🤖 Classifier ${lineCount} ticker(s) → Supabase`}
          </button>

          {saved && (
            <div style={{ marginTop:'12px', fontSize:'11px', color:'#3fb950' }}>
              ✓ {batchResults?.length} ticker(s) classifié(s) et sauvegardés dans Supabase
            </div>
          )}
          {error && <div style={{ color:'#f85149', fontSize:'12px', marginTop:'8px' }}>❌ {error}</div>}

          {/* Résultats groupés par secteur */}
          {batchResults && batchResults.length > 0 && (
            <div style={{ marginTop:'16px', display:'flex', flexDirection:'column', gap:'8px' }}>
              {Object.entries(
                batchResults.reduce((acc, r) => {
                  const s = r.secteur || 'AUTRE';
                  if (!acc[s]) acc[s] = [];
                  acc[s].push(r);
                  return acc;
                }, {})
              ).map(([secteur, tickers]) => (
                <div key={secteur} style={{ background:'#0d1117', border:'1px solid #21262d',
                                            borderRadius:'8px', overflow:'hidden' }}>
                  <div style={{ padding:'8px 14px', borderBottom:'1px solid #161b22',
                                display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:'11px', fontWeight:700, color:'#58a6ff' }}>{secteur}</span>
                    <span style={{ fontSize:'10px', color:'#484f58' }}>{tickers.length} titre(s)</span>
                  </div>
                  <div style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:'6px' }}>
                    {tickers.map(t => (
                      <div key={t.ticker} style={{ display:'flex', justifyContent:'space-between',
                                                    alignItems:'center' }}>
                        <div>
                          <span style={{ fontSize:'12px', fontWeight:700,
                                         color:'#e6edf3', marginRight:'8px' }}>{t.ticker}</span>
                          <span style={{ fontSize:'11px', color:'#8b949e' }}>{t.name}</span>
                        </div>
                        <span style={{ fontSize:'10px', fontWeight:600,
                                       color: typeColor[t.type] || '#8b949e' }}>{t.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── COMPOSANTS UTILITAIRES ───────────────────────────────────────────────────
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
    <span style={{ fontSize:'10px', fontWeight:600,
                   color: active ? color : '#484f58',
                   background: active ? `${color}18` : '#161b22',
                   borderRadius:'4px', padding:'2px 8px' }}>
      {active ? '✓' : '✗'} {label}
    </span>
  );
}

// ─── EXPORT PRINCIPAL ─────────────────────────────────────────────────────────
export default function MomentumModule() {
  const [tab, setTab] = useState('portfolio');
  const tabs = [
    { id:'portfolio', label:'📊 Portefeuille' },
    { id:'classify',  label:'🤖 Classifier'   },
  ];
  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px' }}>
        <span style={{ fontSize:'22px' }}>⚡</span>
        <h2 style={{ fontSize:'20px', fontWeight:800, color:'#e6edf3',
                     fontFamily:'Syne, sans-serif', margin:0 }}>Momentum</h2>
      </div>
      <div style={{ display:'flex', gap:'8px', marginBottom:'24px',
                    background:'#0d1117', padding:'4px', borderRadius:'10px' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex:1, padding:'8px 4px', borderRadius:'8px', border:'none',
            cursor:'pointer', fontSize:'12px', fontWeight:600,
            background: tab === t.id ? '#f0b429' : 'transparent',
            color:       tab === t.id ? '#0d1117' : '#8b949e',
            transition:'all .15s',
          }}>
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
  width:'100%', background:'#0d1117', border:'1px solid #21262d',
  borderRadius:'8px', padding:'10px 14px', color:'#e6edf3',
  fontSize:'13px', outline:'none', boxSizing:'border-box',
};
