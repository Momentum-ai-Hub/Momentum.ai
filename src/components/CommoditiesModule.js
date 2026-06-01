'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCommodityChange } from '../lib/api';

// ─── CONFIG COMMODITÉS ────────────────────────────────────────────────────────
// linkedListId : ID de la liste dans le module 3 (Watchlist)
// Quand tu crées une nouvelle liste dans le module 3, assigne-lui cet ID
// et la navigation fonctionne automatiquement.
const COMMODITIES = [
  {
    symbol: 'XAU/USD',
    label: '🥇 Or',
    desc: 'Prix or vs J-1 → impact FNV, Gold Reserve',
    linkedListId: 'gold-miners',
    actions_hausse: ['FNV', 'Gold Reserve', 'Antimony Resources'],
    actions_baisse: [],
  },
  {
    symbol: 'USOIL',
    label: '🛢️ Pétrole WTI/Brent',
    desc: 'Prix WTI vs J-1 → impact TotalEnergies, Eni, Repsol...',
    linkedListId: 'petrole-gaz',
    actions_hausse: ['TotalEnergies', 'Eni', 'Repsol', 'Equinor', 'OMV', 'MOL', 'Vallourec', 'TechnipFMC'],
    actions_baisse: [],
  },
  {
    symbol: 'NATGAS',
    label: '🔥 Gaz naturel',
    desc: 'Prix gaz naturel → impact Enagas, SNAM...',
    linkedListId: 'gaz-naturel',
    actions_hausse: ['Enagas', 'SNAM', 'Naturgy', 'Air Products', 'Air Liquide', 'Linde'],
    actions_baisse: [],
  },
  {
    symbol: 'LIT',
    label: '🔋 Lithium carbonate',
    desc: 'Prix lithium carbonate (semaine) → impact ALB, SQM, LAC',
    linkedListId: 'lithium-batteries',
    actions_hausse: ['Albemarle', 'SQM', 'Lithium Americas', 'Ganfeng', 'Samsung SDI'],
    actions_baisse: ['Tesla (coûts batteries)'],
  },
  {
    symbol: 'COPPER',
    label: '🔶 Cuivre LME',
    desc: 'Prix cuivre LME → impact FCX, GLEN, RIO, Prysmian',
    linkedListId: 'mines-metaux',
    actions_hausse: ['Freeport McMoRan', 'Glencore', 'Rio Tinto', 'BHP', 'Prysmian', 'Schneider', 'ABB'],
    actions_baisse: [],
  },
  {
    symbol: 'URA',
    label: '☢️ Uranium spot',
    desc: 'Prix uranium spot → impact CCJ, Energy Fuels',
    linkedListId: 'nucleaire-uranium',
    actions_hausse: ['Cameco', 'Energy Fuels', 'Centrus', 'CEZ', 'Oklo'],
    actions_baisse: [],
  },
  {
    symbol: 'MP',
    label: '🌍 Terres rares',
    desc: 'Prix terres rares + politique USA/Chine',
    linkedListId: 'terres-rares',
    actions_hausse: ['MP Materials', 'Lynas', 'Ucore', 'Brazilian RE', 'Critical Metals'],
    actions_baisse: ['Semis (coûts matières)'],
  },
  {
    symbol: 'SOX',
    label: '💻 SOX Index',
    desc: 'SOX Index → impact ensemble cluster semiconducteurs',
    linkedListId: 'semiconducteurs',
    actions_hausse: ['NVIDIA', 'AMD', 'ASML', 'TSMC', 'Micron', 'Lam Research', 'Applied Materials'],
    actions_baisse: [],
  },
  {
    symbol: 'BTC/USD',
    label: '₿ Bitcoin',
    desc: 'Prix Bitcoin → impact HUT 8',
    linkedListId: 'crypto-mining',
    actions_hausse: ['HUT 8'],
    actions_baisse: [],
  },
];

// ─── LOGIQUE DE SIGNAL SUR 3 NIVEAUX ─────────────────────────────────────────
// Retourne le signal le plus fort parmi 1j / 3j / 5j
// Priorité : 5j > 3j > 1j (signal le plus fort affiché)
function getSignal(change1d, change3d, change5d) {
  const neutral = { color: '#484f58', label: '—', trigger: false, dir: null, level: null };

  if (change1d === null && change3d === null && change5d === null) return neutral;

  // Évalue chaque fenêtre
  const eval1d = evalWindow(change1d, '1J');
  const eval3d = evalWindow(change3d, '3J');
  const eval5d = evalWindow(change5d, '5J');

  // Retourne le signal le plus fort (5j prioritaire, puis 3j, puis 1j)
  if (eval5d.trigger)  return eval5d;
  if (eval3d.trigger)  return eval3d;
  if (eval5d.dir)      return eval5d;   // haussier/baissier non-déclenché sur 5j
  if (eval3d.dir)      return eval3d;
  if (eval1d.dir)      return eval1d;
  return neutral;
}

function evalWindow(change, windowLabel) {
  if (change === null) return { color: '#484f58', label: '—', trigger: false, dir: null };

  // Seuils par fenêtre
  const thresholds = {
    '1J': { strong: 2,  weak: 1  },
    '3J': { strong: 3,  weak: 2  },
    '5J': { strong: 5,  weak: 3  },
  };
  const t = thresholds[windowLabel] || thresholds['5J'];

  if (change >= t.strong)
    return { color: '#3fb950', label: `▲ SIGNAL +${t.strong}% (${windowLabel})`, trigger: true,  dir: 'hausse', level: windowLabel, pct: change };
  if (change >= t.weak)
    return { color: '#8bc34a', label: `▲ Haussier (${windowLabel})`,              trigger: false, dir: 'hausse', level: windowLabel, pct: change };
  if (change <= -t.strong)
    return { color: '#f85149', label: `▼ SIGNAL -${t.strong}% (${windowLabel})`, trigger: true,  dir: 'baisse', level: windowLabel, pct: change };
  if (change <= -t.weak)
    return { color: '#ff9800', label: `▼ Baissier (${windowLabel})`,              trigger: false, dir: 'baisse', level: windowLabel, pct: change };

  return { color: '#8b949e', label: `→ Neutre (${windowLabel})`, trigger: false, dir: null, pct: change };
}

// ─── COMPOSANT ────────────────────────────────────────────────────────────────
export default function CommoditiesModule() {
  const router = useRouter();
  const [data, setData]       = useState({});   // { symbol: { d1, d3, d5 } }
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLast] = useState('');

  // Charge les 3 fenêtres en parallèle pour toutes les commodités
  async function loadAll() {
    setLoading(true);
    const results = {};
    await Promise.all(
      COMMODITIES.map(async (c) => {
        const [d1, d3, d5] = await Promise.all([
          getCommodityChange(c.symbol, 2).catch(() => null),   // 2 points = variation 1J
          getCommodityChange(c.symbol, 4).catch(() => null),   // 4 points = variation 3J
          getCommodityChange(c.symbol, 6).catch(() => null),   // 6 points = variation 5J
        ]);
        results[c.symbol] = { d1, d3, d5 };
      })
    );
    setData(results);
    setLast(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
    setLoading(false);
  }

  // Navigation vers la liste du module 3 liée à cette commodité
  function goToList(linkedListId) {
    if (!linkedListId) return;
    router.push(`/watchlist/${linkedListId}`);
  }

  const signalsActifs = COMMODITIES.filter(c => {
    const d = data[c.symbol];
    if (!d) return false;
    return getSignal(d.d1, d.d3, d.d5).trigger;
  }).length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '22px' }}>🌐</span>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#e6edf3', fontFamily: 'Syne, sans-serif' }}>
            Matières Premières
          </h2>
        </div>
        {lastUpdate && (
          <span style={{ fontSize: '10px', color: '#484f58' }}>Maj {lastUpdate}</span>
        )}
      </div>

      {/* Règle anticipation — 3 niveaux */}
      <div style={{ background: 'rgba(240,180,41,0.07)', border: '1px solid rgba(240,180,41,0.2)', borderRadius: '10px', padding: '14px', marginBottom: '16px', fontSize: '11px', color: '#8b949e', lineHeight: '1.8' }}>
        <div style={{ color: '#f0b429', fontWeight: 700, marginBottom: '6px' }}>★ Règle anticipation</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <span><span style={{ color: '#ffd700', fontWeight: 600 }}>⚡ Niveau 1</span> — +2% sur 1J → signal précoce, faible conviction</span>
          <span><span style={{ color: '#ff9800', fontWeight: 600 }}>⚡ Niveau 2</span> — +3% sur 3J → signal modéré, surveiller drift</span>
          <span><span style={{ color: '#3fb950', fontWeight: 600 }}>⚡ Niveau 3</span> — +5% sur 5J → signal fort → chercher entrée pre-earnings ou swing si publication dans 30J</span>
        </div>
      </div>

      {/* Légende niveaux */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {[
          { color: '#ffd700', label: 'Niveau 1 · 1J' },
          { color: '#ff9800', label: 'Niveau 2 · 3J' },
          { color: '#3fb950', label: 'Niveau 3 · 5J' },
        ].map(({ color, label }) => (
          <span key={label} style={{ fontSize: '10px', color, background: 'rgba(255,255,255,0.04)', padding: '3px 8px', borderRadius: '4px', border: `1px solid ${color}44` }}>
            {label}
          </span>
        ))}
      </div>

      {/* Signals actifs */}
      {signalsActifs > 0 && (
        <div style={{ background: 'rgba(63,185,80,0.1)', border: '1px solid rgba(63,185,80,0.3)', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '12px', color: '#3fb950', fontWeight: 700 }}>
          ⚡ {signalsActifs} signal{signalsActifs > 1 ? 's' : ''} actif{signalsActifs > 1 ? 's' : ''} détecté{signalsActifs > 1 ? 's' : ''}
        </div>
      )}

      {/* Bouton */}
      <button
        onClick={loadAll}
        disabled={loading}
        style={{ background: '#161b22', color: '#e6edf3', border: '1px solid #21262d', borderRadius: '8px', padding: '12px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', width: '100%', marginBottom: '20px' }}
      >
        {loading ? '⏳ Chargement...' : '🔄 Checklist quotidienne (2 min)'}
      </button>

      {/* Liste MP */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {COMMODITIES.map(c => {
          const d      = data[c.symbol];
          const sig    = d ? getSignal(d.d1, d.d3, d.d5) : { color: '#484f58', label: '—', trigger: false, dir: null };
          const pct    = sig.pct;
          const hasPct = pct !== undefined && pct !== null;

          return (
            <div
              key={c.symbol}
              style={{ background: '#0d1117', border: `1px solid ${sig.trigger ? sig.color + '55' : '#21262d'}`, borderRadius: '10px', padding: '14px 16px' }}
            >
              {/* Ligne principale */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#e6edf3' }}>{c.label}</div>
                  <div style={{ fontSize: '10px', color: '#484f58', marginTop: '2px' }}>{c.desc}</div>
                </div>

                {/* Signal + variation */}
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                  {hasPct && (
                    <div style={{ fontSize: '15px', fontWeight: 700, color: sig.color }}>
                      {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                    </div>
                  )}
                  <div style={{ fontSize: '10px', fontWeight: 600, color: sig.color }}>{sig.label}</div>
                </div>
              </div>

              {/* Bouton liste liée — toujours visible si données chargées */}
              {d && c.linkedListId && (
                <div style={{ marginTop: '10px' }}>
                  <button
                    onClick={() => goToList(c.linkedListId)}
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #21262d', borderRadius: '6px', padding: '5px 10px', fontSize: '10px', color: '#8b949e', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                  >
                    📋 Voir liste
                    <span style={{ color: '#484f58' }}>→ /watchlist/{c.linkedListId}</span>
                  </button>
                </div>
              )}

              {/* Actions corrélées — uniquement si signal déclenché */}
              {sig.trigger && sig.dir === 'hausse' && c.actions_hausse.length > 0 && (
                <div style={{ borderTop: '1px solid #161b22', paddingTop: '10px', marginTop: '10px' }}>
                  <div style={{ fontSize: '10px', color: '#3fb950', fontWeight: 600, marginBottom: '6px' }}>▲ Surveiller :</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {c.actions_hausse.map(a => (
                      <span key={a} style={{ fontSize: '11px', color: '#8b949e', background: '#161b22', padding: '3px 8px', borderRadius: '4px' }}>{a}</span>
                    ))}
                  </div>
                </div>
              )}
              {sig.trigger && sig.dir === 'baisse' && c.actions_baisse.length > 0 && (
                <div style={{ borderTop: '1px solid #161b22', paddingTop: '10px', marginTop: '10px' }}>
                  <div style={{ fontSize: '10px', color: '#f85149', fontWeight: 600, marginBottom: '6px' }}>▼ Éviter :</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {c.actions_baisse.map(a => (
                      <span key={a} style={{ fontSize: '11px', color: '#8b949e', background: '#161b22', padding: '3px 8px', borderRadius: '4px' }}>{a}</span>
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
