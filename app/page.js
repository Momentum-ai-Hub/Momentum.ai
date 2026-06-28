'use client';
import { useState } from 'react';
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
    id: 'A',
    label: 'Analyse',
    icon: 'A',
    children: [
      { id:'A1', label:'Description titre' },
      { id:'A2', label:'Analyse Deep' },
      { id:'A3', label:'These investissement' },
    ],
  },
  {
    id: 'B',
    label: 'Actualite',
    icon: 'B',
    children: [
      { id:'B1', label:'Depeches temps reel' },
      { id:'B2', label:'Communiques entreprise' },
      { id:'B3', label:'Banques centrales' },
    ],
  },
  {
    id: 'C',
    label: 'Macro',
    icon: 'C',
    children: [
      { id:'C1', label:'Geopolitique' },
      { id:'C2', label:'Devises et PIB' },
      { id:'C3', label:'Matieres premieres' },
    ],
  },
  { id:'D', label:'Graphique',    icon:'D', children:[] },
  { id:'E', label:'Earnings',     icon:'E', children:[] },
  {
    id: 'F',
    label: 'Drift',
    icon: 'F',
    children: [
      { id:'F1', label:'Calendrier eco' },
      { id:'F2', label:'Suivi drift' },
    ],
  },
  { id:'G', label:'Portfolio',    icon:'G', children:[] },
  { id:'H', label:'Edge',         icon:'H', children:[] },
  { id:'I', label:'Track Record', icon:'I', children:[] },
];

function PlaceholderModule(props) {
  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', height:'300px', gap:'12px',
    }}>
      <div style={{ fontSize:'13px', fontWeight:600, color:'#a8d8f0' }}>{props.label}</div>
      <div style={{ fontSize:'11px', color:'#4a5568' }}>Module en cours de migration</div>
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
  var section  = props.section;
  var active   = props.active;
  var onSelect = props.onSelect;
  var expanded = props.expanded;
  var onToggle = props.onToggle;

  var hasChildren    = section.children && section.children.length > 0;
  var isParentActive = active === section.id || (
    hasChildren && section.children.some(function(c) { return c.id === active; })
  );

  return (
    <div>
      <button
        onClick={function() {
          if (hasChildren) {
            onToggle(section.id);
          } else {
            onSelect(section.id);
          }
        }}
        style={{
          display:'flex', alignItems:'center', gap:'10px',
          width:'100%', padding:'8px 16px',
          background: isParentActive && !hasChildren ? 'rgba(168,216,240,0.08)' : 'none',
          border:'none', cursor:'pointer',
          borderLeft: isParentActive && !hasChildren ? '2px solid #a8d8f0' : '2px solid transparent',
          transition:'all 0.15s',
        }}
      >
        <span style={{
          fontSize:'10px', fontWeight:700,
          color: isParentActive ? '#a8d8f0' : '#2d3748',
          minWidth:'14px', fontFamily:'monospace',
        }}>
          {section.icon}
        </span>
        <span style={{
          fontSize:'12px', fontWeight: isParentActive ? 600 : 400,
          color: isParentActive ? '#c8eaff' : '#4a5568',
          fontFamily:'Inter, sans-serif', flex:1, textAlign:'left',
        }}>
          {section.label}
        </span>
        {hasChildren && (
          <span style={{
            fontSize:'9px', color:'#2d3748',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition:'transform 0.15s',
            display:'inline-block',
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
                  width:'100%', padding:'6px 16px 6px 38px',
                  background: childActive ? 'rgba(168,216,240,0.06)' : 'none',
                  border:'none', cursor:'pointer',
                  borderLeft: childActive ? '2px solid #a8d8f0' : '2px solid transparent',
                }}
              >
                <span style={{
                  fontSize:'10px', fontFamily:'monospace',
                  color:'#2d3748', marginRight:'8px',
                }}>
                  {child.id}
                </span>
                <span style={{
                  fontSize:'11px', fontWeight: childActive ? 600 : 400,
                  color: childActive ? '#a8d8f0' : '#2d3748',
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
  const [active, setActive]     = useState('E');
  const [expanded, setExpanded] = useState({ A:false, B:false, C:false, F:false });

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
  }

  var now     = new Date();
  var timeStr = now.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
  var dateStr = now.toLocaleDateString('fr-FR', { day:'2-digit', month:'short' });

  return (
    <div style={{
      minHeight:'100vh',
      background:'#0b0f1a',
      display:'flex',
      fontFamily:'Inter, -apple-system, sans-serif',
    }}>

      {/* SIDEBAR */}
      <div style={{
        width:'220px',
        minWidth:'220px',
        height:'100vh',
        position:'fixed',
        top:0, left:0,
        background:'#0b0f1a',
        borderRight:'1px solid #1a2332',
        display:'flex',
        flexDirection:'column',
        zIndex:100,
        overflowY:'auto',
      }}>

        {/* LOGO */}
        <div style={{
          padding:'20px 16px 16px',
          borderBottom:'1px solid #1a2332',
          flexShrink:0,
        }}>
          <div style={{
            fontSize:'16px', fontWeight:800, color:'#c8eaff',
            fontFamily:'Inter, sans-serif', letterSpacing:'-0.5px',
          }}>
            Bloombi
          </div>
          <div style={{ fontSize:'10px', color:'#2d3748', marginTop:'2px' }}>
            Terminal financier
          </div>
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
          <div style={{ fontSize:'10px', color:'#2d3748', lineHeight:'1.6' }}>
            {dateStr} {timeStr}
          </div>
          <div style={{ fontSize:'10px', color:'#2d3748', marginTop:'2px' }}>
            Bloombi v2.0
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{
        marginLeft:'220px',
        flex:1,
        display:'flex',
        flexDirection:'column',
        minHeight:'100vh',
      }}>

        {/* TOPBAR */}
        <div style={{
          height:'48px',
          background:'#0b0f1a',
          borderBottom:'1px solid #1a2332',
          display:'flex',
          alignItems:'center',
          justifyContent:'space-between',
          padding:'0 24px',
          position:'sticky',
          top:0,
          zIndex:50,
        }}>
          <div style={{ fontSize:'13px', fontWeight:600, color:'#a8d8f0' }}>
            {active}
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:'12px', fontWeight:700, color:'#22c55e' }}>300 EUR</div>
            <div style={{ fontSize:'9px', color:'#2d3748' }}>Capital</div>
          </div>
        </div>

        {/* CONTENT */}
        <div style={{
          flex:1,
          padding:'24px',
          maxWidth:'900px',
          width:'100%',
        }}>
          {renderModule(active)}
        </div>

      </div>

    </div>
  );
}