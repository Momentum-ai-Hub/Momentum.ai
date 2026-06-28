'use client';
import { useState, useEffect } from 'react';
import EarningsModule from '../src/components/EarningsModule';
import DriftModule from '../src/components/DriftModule';
import MomentumModule from '../src/components/MomentumModule';
import CommoditiesModule from '../src/components/CommoditiesModule';
import MorningEdgeModule from '../src/components/MorningEdgeModule';
import AnalyseModule from '../src/components/AnalyseModule';
import NewsModule from '../src/components/NewsModule';
import MacroModule from '../src/components/MacroModule';
import ChartAnalyzer from '../src/components/ChartAnalyzer';
import TrackRecordModule from '../src/components/TrackRecordModule';

var SECTIONS = [
  {
    id: 'A', label: 'Analyse', children: [
      { id:'A1', label:'Description titre' },
      { id:'A2', label:'Analyse Deep' },
      { id:'A3', label:'These investissement' },
    ],
  },
  {
    id: 'B', label: 'Actualite', children: [
      { id:'B1', label:'Depeches temps reel' },
      { id:'B2', label:'Communiques entreprise' },
      { id:'B3', label:'Banques centrales' },
    ],
  },
  {
    id: 'C', label: 'Macro', children: [
      { id:'C1', label:'Geopolitique' },
      { id:'C2', label:'Devises et PIB' },
      { id:'C3', label:'Matieres premieres' },
    ],
  },
  { id:'D', label:'Graphique',    children:[] },
  { id:'E', label:'Earnings',     children:[] },
  {
    id: 'F', label: 'Drift', children: [
      { id:'F1', label:'Calendrier eco' },
      { id:'F2', label:'Suivi drift' },
    ],
  },
  { id:'G', label:'Portfolio',    children:[] },
  { id:'H', label:'Edge',         children:[] },
  { id:'I', label:'Track Record', children:[] },
];

var SIDEBAR_WIDTH = 220;
var TOPBAR_HEIGHT = 56;

var MARKETS = [
  { id:'TYO', label:'TYO', tz:'Asia/Tokyo',         open:9,  close:15, off:0  },
  { id:'HKG', label:'HKG', tz:'Asia/Hong_Kong',     open:9,  close:16, off:0  },
  { id:'SEO', label:'SEO', tz:'Asia/Seoul',          open:9,  close:15, off:30 },
  { id:'FRA', label:'FRA', tz:'Europe/Berlin',       open:9,  close:17, off:30 },
  { id:'LON', label:'LON', tz:'Europe/London',       open:8,  close:16, off:30 },
  { id:'NYC', label:'NYC', tz:'America/New_York',    open:9,  close:16, off:30 },
];

function getMarketStatus(tz, openH, openM, closeH, closeM) {
  var now = new Date();
  var formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour:'2-digit', minute:'2-digit', hour12:false,
    weekday:'short',
  });
  var parts = formatter.formatToParts(now);
  var weekday = '';
  var hour = 0;
  var minute = 0;
  parts.forEach(function(p) {
    if (p.type === 'weekday') weekday = p.value;
    if (p.type === 'hour')    hour    = parseInt(p.value, 10);
    if (p.type === 'minute')  minute  = parseInt(p.value, 10);
  });
  var isWeekend = weekday === 'Sat' || weekday === 'Sun';
  if (isWeekend) return 'closed';
  var nowMins   = hour * 60 + minute;
  var openMins  = openH * 60 + openM;
  var closeMins = closeH * 60 + closeM;
  var preMins   = openMins - 60;
  if (nowMins >= openMins && nowMins < closeMins) return 'open';
  if (nowMins >= preMins  && nowMins < openMins)  return 'pre';
  return 'closed';
}

function getMarketTime(tz) {
  var now = new Date();
  var formatter = new Intl.DateTimeFormat('fr-FR', {
    timeZone: tz,
    hour:'2-digit', minute:'2-digit', hour12:false,
  });
  return formatter.format(now);
}

function MarketClocks() {
  const [tick, setTick] = useState(0);

  useEffect(function() {
    var interval = setInterval(function() {
      setTick(function(t) { return t + 1; });
    }, 30000);
    return function() { clearInterval(interval); };
  }, []);

  return (
    <div style={{
      display:'flex', alignItems:'center', gap:'12px', overflowX:'auto',
    }}>
      {MARKETS.map(function(m) {
        var openM  = m.off > 0 ? m.open  : m.open;
        var closeM = m.off > 0 ? m.close : m.close;
        var status = getMarketStatus(m.tz, m.open, m.off, m.close, m.off);
        var time   = getMarketTime(m.tz);
        var dotColor = status === 'open' ? '#22c55e' : status === 'pre' ? '#f59e0b' : '#374151';
        var timeColor = status === 'open' ? '#c8eaff' : '#4a5568';

        return (
          <div key={m.id} style={{
            display:'flex', alignItems:'center', gap:'5px', flexShrink:0,
          }}>
            <div style={{
              width:'5px', height:'5px', borderRadius:'50%',
              background: dotColor, flexShrink:0,
            }} />
            <span style={{
              fontSize:'10px', fontWeight:600, color:'#4a5568',
              fontFamily:'monospace', letterSpacing:'0.5px',
            }}>
              {m.label}
            </span>
            <span style={{
              fontSize:'10px', fontWeight:500, color: timeColor,
              fontFamily:'monospace',
            }}>
              {time}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function PlaceholderModule(props) {
  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', height:'300px', gap:'12px',
    }}>
      <div style={{ fontSize:'13px', fontWeight:600, color:'#a8d8f0' }}>{props.label}</div>
      <div style={{ fontSize:'11px', color:'#6b7280' }}>Module en cours de migration</div>
    </div>
  );
}

function renderModule(active) {
  if (active === 'A1') return <AnalyseModule section="A1" />;
  if (active === 'A2') return <AnalyseModule section="A2" />;
  if (active === 'A3') return <AnalyseModule section="A3" />;
  if (active === 'B1') return <NewsModule section="B1" />;
  if (active === 'B2') return <NewsModule section="B2" />;
  if (active === 'B3') return <NewsModule section="B3" />;
  if (active === 'C1') return <MacroModule section="C1" />;
  if (active === 'C2') return <MacroModule section="C2" />;
  if (active === 'C3') return <CommoditiesModule />;
  if (active === 'D')  return <ChartAnalyzer />;
  if (active === 'E')  return <EarningsModule />;
  if (active === 'F1') return <PlaceholderModule label="Calendrier economique" />;
  if (active === 'F2') return <DriftModule />;
  if (active === 'G')  return <MomentumModule />;
  if (active === 'H')  return <MorningEdgeModule />;
  if (active === 'I')  return <TrackRecordModule />;
  return <PlaceholderModule label={active} />;
}

function SidebarItem(props) {
  var section    = props.section;
  var active     = props.active;
  var onSelect   = props.onSelect;
  var expanded   = props.expanded;
  var onToggle   = props.onToggle;

  var hasChildren    = section.children && section.children.length > 0;
  var isParentActive = active === section.id || (
    hasChildren && section.children.some(function(c) { return c.id === active; })
  );

  return (
    <div>
      <button
        onClick={function() {
          if (hasChildren) { onToggle(section.id); } else { onSelect(section.id); }
        }}
        style={{
          display:'flex', alignItems:'center', gap:'10px',
          width:'100%', padding:'9px 16px',
          background: isParentActive && !hasChildren ? 'rgba(168,216,240,0.10)' : 'none',
          border:'none', cursor:'pointer',
          borderLeft: isParentActive && !hasChildren ? '2px solid #a8d8f0' : '2px solid transparent',
          transition:'all 0.15s',
        }}
      >
        <span style={{
          fontSize:'12px', fontWeight: isParentActive ? 600 : 400,
          color: isParentActive ? '#c8eaff' : '#6b7280',
          fontFamily:'Inter, sans-serif', flex:1, textAlign:'left',
        }}>
          {section.label}
        </span>
        {hasChildren && (
          <span style={{
            fontSize:'9px', color:'#4a5568',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition:'transform 0.15s', display:'inline-block',
          }}>
            v
          </span>
        )}
      </button>

      {hasChildren && expanded && (
        <div>
          {section.children.map(function(child) {
            var childActive = active === child.id;
            return (
              <button
                key={child.id}
                onClick={function() { onSelect(child.id); }}
                style={{
                  display:'flex', alignItems:'center',
                  width:'100%', padding:'6px 16px 6px 28px',
                  background: childActive ? 'rgba(168,216,240,0.07)' : 'none',
                  border:'none', cursor:'pointer',
                  borderLeft: childActive ? '2px solid #a8d8f0' : '2px solid transparent',
                }}
              >
                <span style={{
                  fontSize:'11px', fontWeight: childActive ? 600 : 400,
                  color: childActive ? '#a8d8f0' : '#4a5568',
                  fontFamily:'Inter, sans-serif',
                }}>
                  {child.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [active, setActive]       = useState('E');
  const [expanded, setExpanded]   = useState({ A:false, B:false, C:false, F:false });
  const [sidebarOpen, setSidebar] = useState(false);
  const [isMobile, setIsMobile]   = useState(false);

  useEffect(function() {
    function handleResize() {
      var mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setSidebar(!mobile);
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    return function() { window.removeEventListener('resize', handleResize); };
  }, []);

  function handleToggle(id) {
    setExpanded(function(prev) {
      var next = Object.assign({}, prev);
      next[id] = !prev[id];
      return next;
    });
  }

  function handleSelect(id) {
    setActive(id);
    var parentId = id.length === 2 ? id[0] : null;
    if (parentId && expanded[parentId] === false) {
      setExpanded(function(prev) {
        var next = Object.assign({}, prev);
        next[parentId] = true;
        return next;
      });
    }
    if (isMobile) { setSidebar(false); }
  }

  var now     = new Date();
  var dateStr = now.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  var dateDisplay = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  var sidebarWidth = sidebarOpen ? SIDEBAR_WIDTH : 0;
  var marginLeft   = isMobile ? 0 : (sidebarOpen ? SIDEBAR_WIDTH : 0);

  return (
    <div style={{
      minHeight:'100vh',
      background:'#c8cbc5',
      display:'flex',
      fontFamily:'Inter, -apple-system, sans-serif',
    }}>

      {/* OVERLAY MOBILE */}
      {isMobile && sidebarOpen && (
        <div
          onClick={function() { setSidebar(false); }}
          style={{
            position:'fixed', inset:0,
            background:'rgba(0,0,0,0.5)',
            zIndex:90,
          }}
        />
      )}

      {/* SIDEBAR */}
      {sidebarOpen && (
        <div style={{
          width: SIDEBAR_WIDTH + 'px',
          minWidth: SIDEBAR_WIDTH + 'px',
          height:'100vh',
          position:'fixed',
          top:0, left:0,
          background:'#0b0f1a',
          borderRight:'1px solid #1a2332',
          display:'flex',
          flexDirection:'column',
          zIndex:100,
          overflowY:'auto',
          overflowX:'hidden',
        }}>

          {/* HEADER SIDEBAR */}
          <div style={{
            height: TOPBAR_HEIGHT + 'px',
            minHeight: TOPBAR_HEIGHT + 'px',
            display:'flex',
            alignItems:'center',
            justifyContent:'space-between',
            padding:'0 12px 0 16px',
            borderBottom:'1px solid #1a2332',
            flexShrink:0,
          }}>
            <div>
              <div style={{
                fontSize:'15px', fontWeight:800, color:'#c8eaff',
                fontFamily:'Inter, sans-serif', letterSpacing:'-0.4px',
              }}>
                Bloombi
              </div>
              <div style={{ fontSize:'10px', color:'#4a5568', marginTop:'1px' }}>
                Terminal financier
              </div>
            </div>
            <button
              onClick={function() { setSidebar(false); }}
              style={{
                background:'none', border:'none', cursor:'pointer',
                padding:'6px', display:'flex', flexDirection:'column',
                gap:'4px', alignItems:'center',
              }}
            >
              <div style={{ width:'16px', height:'1.5px', background:'#4a5568', borderRadius:'1px' }} />
              <div style={{ width:'16px', height:'1.5px', background:'#4a5568', borderRadius:'1px' }} />
              <div style={{ width:'16px', height:'1.5px', background:'#4a5568', borderRadius:'1px' }} />
            </button>
          </div>

          {/* NAV */}
          <nav style={{ flex:1, paddingTop:'8px', paddingBottom:'16px' }}>
            {SECTIONS.map(function(section) {
              return (
                <SidebarItem
                  key={section.id}
                  section={section}
                  active={active}
                  onSelect={handleSelect}
                  expanded={expanded[section.id] || false}
                  onToggle={handleToggle}
                />
              );
            })}
          </nav>

          {/* PIED SIDEBAR */}
          <div style={{
            padding:'12px 16px',
            borderTop:'1px solid #1a2332',
            flexShrink:0,
          }}>
            <div style={{ fontSize:'10px', color:'#2d3748' }}>Bloombi v2.0</div>
          </div>
        </div>
      )}

      {/* MAIN */}
      <div style={{
        marginLeft: marginLeft + 'px',
        flex:1,
        display:'flex',
        flexDirection:'column',
        minHeight:'100vh',
        transition:'margin-left 0.2s ease',
      }}>

        {/* TOPBAR */}
        <div style={{
          height: TOPBAR_HEIGHT + 'px',
          background:'#0b0f1a',
          borderBottom:'1px solid #1a2332',
          display:'flex',
          alignItems:'center',
          gap:'16px',
          padding:'0 16px 0 12px',
          position:'sticky',
          top:0,
          zIndex:50,
        }}>

          {/* HAMBURGER */}
          <button
            onClick={function() { setSidebar(function(p) { return !p; }); }}
            style={{
              background:'none', border:'none', cursor:'pointer',
              padding:'6px', display:'flex', flexDirection:'column',
              gap:'4px', alignItems:'center', flexShrink:0,
            }}
          >
            <div style={{ width:'16px', height:'1.5px', background:'#6b7280', borderRadius:'1px' }} />
            <div style={{ width:'16px', height:'1.5px', background:'#6b7280', borderRadius:'1px' }} />
            <div style={{ width:'16px', height:'1.5px', background:'#6b7280', borderRadius:'1px' }} />
          </button>

          {/* DATE */}
          <div style={{
            fontSize:'11px', fontWeight:500, color:'#6b7280',
            whiteSpace:'nowrap', flexShrink:0,
          }}>
            {dateDisplay}
          </div>

          {/* SEPARATEUR */}
          <div style={{ width:'1px', height:'20px', background:'#1a2332', flexShrink:0 }} />

          {/* HORLOGES */}
          <div style={{ flex:1, overflow:'hidden' }}>
            <MarketClocks />
          </div>

          {/* CAPITAL */}
          <div style={{ textAlign:'right', flexShrink:0 }}>
            <div style={{ fontSize:'12px', fontWeight:700, color:'#22c55e' }}>300 EUR</div>
            <div style={{ fontSize:'9px', color:'#4a5568' }}>Capital</div>
          </div>
        </div>

        {/* CONTENT */}
        <div style={{
          flex:1,
          padding:'24px',
          background:'#c8cbc5',
        }}>
          {renderModule(active)}
        </div>

      </div>

    </div>
  );
}
