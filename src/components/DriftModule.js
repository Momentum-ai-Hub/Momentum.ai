'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const FMP_KEY = process.env.NEXT_PUBLIC_FMP_KEY;
const FINNHUB_KEY = process.env.NEXT_PUBLIC_FINNHUB_KEY;

export default function DriftModule() {
  const [watchlist, setWatchlist] = useState([]);
  const [calendrier, setCalendrier] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [view, setView] = useState('watchlist');

  useEffect(() => { loadWatchlist(); }, []);

  async function loadWatchlist() {
    const { data } = await supabase
      .from('drift_watchlist')
      .select('*')
      .order('earnings_date', { ascending: true });
    if (data) setWatchlist(data);
  }

  async function scanCalendrier() {
    setScanning(true);
    try {
      const today = new Date();
      const future = new Date();
      future.setDate(future.getDate() + 30);
      const from = today.toISOString().split('T')[0];
      const to = future.toISOString().split('T')[0];

      const res = await fetch(
        "https://financialmodelingprep.com/api/v3/earning_calendar?from=" + from + "&to=" + to + "&apikey=" + FMP_KEY
      );
      const data = await res.json();
      const filtered = (data || []).filter(e => e.symbol && e.date).slice(0, 50);
      setCalendrier(filtered);
      setView('calendrier');
    } catch(e) {
      alert('Erreur scan calendrier');
    }
    setScanning(false);
  }

  async function analyserDrift(ticker, earningsDate) {
    try {
      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: "Tu es un analyste drift pre-earnings. Applique les regles drift : base rate, secteur momentum, perf 30J, driver MP. Retourne UNIQUEMENT un JSON valide sans backticks : {drift_score: 0-10, signal: 'FORT/MODERE/FAIBLE/NEUTRE', secteur: 'secteur', base_rate: number, analyse: 'narrative 2-3 lignes'}",
          messages: [{ role: 'user', content: "Analyse drift pre-earnings pour " + ticker + " avec publication le " + earningsDate + ". Evalue le potentiel de drift haussierde J-20 a J-0." }]
        }),
      });
      const data = await response.json();
      const text = data.content?.[0]?.text ?? '{}';
      const clean = text.replace(/```json|```/g, '').trim();
      return JSON.parse(clean);
    } catch(e) {
      return { drift_score: 0, signal: 'NEUTRE', secteur: 'Inconnu', base_rate: 50, analyse: 'Analyse indisponible' };
    }
  }

  async function ajouterWatchlist(item) {
    setLoading(true);
    try {
      const analyse = await analyserDrift(item.symbol, item.date);

      const { error } = await supabase.from('drift_watchlist').upsert({
        ticker: item.symbol,
        company_name: item.name || item.symbol,
        earnings_date: item.date,
        secteur: analyse.secteur,
        base_rate: analyse.base_rate,
        drift_score: analyse.drift_score,
        signal: analyse.signal,
        analyse_narrative: analyse.analyse,
        statut: 'WATCHING',
      }, { onConflict: 'ticker' });

      if (!error) {
        await loadWatchlist();
        setView('watchlist');
      }
    } catch(e) {
      alert('Erreur ajout watchlist');
    }
    setLoading(false);
  }

  async function updateStatut(id, statut) {
    await supabase.from('drift_watchlist').update({ statut, last_updated: new Date().toISOString() }).eq('id', id);
    await loadWatchlist();
  }

  async function supprimerTitre(id) {
    await supabase.from('drift_watchlist').delete().eq('id', id);
    await loadWatchlist();
  }

  const signalColor = { 'FORT': '#3fb950', 'MODERE': '#58a6ff', 'FAIBLE': '#e3b341', 'NEUTRE': '#484f58' };
  const statutColor = { 'WATCHING': '#58a6ff', 'ENTERED': '#3fb950', 'EXITED': '#484f58' };

  return (
    <div style={{ padding: '16px', fontFamily: 'monospace', color: '#e6edf3' }}>
      <h2 style={{ color: '#f0b429', fontSize: '18px', marginBottom: '4px' }}>📈 Pre-Earnings Drift</h2>
      <p style={{ color: '#8b949e', fontSize: '12px', marginBottom: '16px' }}>
        ~60% des titres qui vont beater dérivent haussièrement J-20 à J-0
      </p>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button onClick={() => setView('watchlist')}
          style={{ flex: 1, padding: '8px', background: view === 'watchlist' ? '#f0b429' : '#21262d', color: view === 'watchlist' ? '#000' : '#e6edf3', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
          Watchlist ({watchlist.length})
        </button>
        <button onClick={() => setView('calendrier')}
          style={{ flex: 1, padding: '8px', background: view === 'calendrier' ? '#f0b429' : '#21262d', color: view === 'calendrier' ? '#000' : '#e6edf3', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
          Calendrier 30J
        </button>
      </div>

      {view === 'watchlist' && (
        <div>
          {watchlist.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#8b949e', padding: '32px' }}>
              <p>Aucun titre en watchlist</p>
              <button onClick={scanCalendrier} disabled={scanning}
                style={{ marginTop: '12px', padding: '10px 20px', background: '#f0b429', color: '#000', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                {scanning ? 'Scan...' : '🔍 Scanner le calendrier 30J'}
              </button>
            </div>
          ) : (
            <div>
              <button onClick={scanCalendrier} disabled={scanning}
                style={{ width: '100%', padding: '10px', background: '#21262d', color: '#f0b429', border: '1px solid #f0b429', borderRadius: '6px', cursor: 'pointer', marginBottom: '12px', fontSize: '12px' }}>
                {scanning ? 'Scan...' : '🔍 Scanner nouveaux titres'}
              </button>
              {watchlist.map(item => (
                <div key={item.id} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '12px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div>
                      <span style={{ fontWeight: 'bold', fontSize: '15px' }}>{item.ticker}</span>
                      <span style={{ color: '#8b949e', fontSize: '11px', marginLeft: '8px' }}>{item.company_name}</span>
                    </div>
                    <span style={{ background: signalColor[item.signal] || '#484f58', color: '#000', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                      {item.signal}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#8b949e', marginBottom: '8px' }}>
                    <span>📅 {item.earnings_date}</span>
                    <span>🎯 Score: {item.drift_score}/10</span>
                    <span>📊 Base rate: {item.base_rate}%</span>
                  </div>
                  <p style={{ fontSize: '11px', color: '#c9d1d9', marginBottom: '8px', lineHeight: '1.4' }}>{item.analyse_narrative}</p>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <span style={{ background: statutColor[item.statut], color: '#000', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>{item.statut}</span>
                    {item.statut === 'WATCHING' && (
                      <button onClick={() => updateStatut(item.id, 'ENTERED')}
                        style={{ padding: '2px 8px', background: '#3fb950', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}>
                        ENTRER
                      </button>
                    )}
                    {item.statut === 'ENTERED' && (
                      <button onClick={() => updateStatut(item.id, 'EXITED')}
                        style={{ padding: '2px 8px', background: '#f85149', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}>
                        SORTIR
                      </button>
                    )}
                    <button onClick={() => supprimerTitre(item.id)}
                      style={{ padding: '2px 8px', background: '#21262d', color: '#8b949e', border: '1px solid #30363d', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}>
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'calendrier' && (
        <div>
          <p style={{ color: '#8b949e', fontSize: '11px', marginBottom: '12px' }}>
            {calendrier.length} publications trouvées — clique + pour analyser et ajouter
          </p>
          {calendrier.map((item, i) => (
            <div key={i} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '6px', padding: '10px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{item.symbol}</span>
                <span style={{ color: '#8b949e', fontSize: '11px', marginLeft: '8px' }}>{item.date}</span>
                {item.epsEstimated && <span style={{ color: '#8b949e', fontSize: '11px', marginLeft: '8px' }}>EPS est: ${item.epsEstimated}</span>}
              </div>
              <button onClick={() => ajouterWatchlist(item)} disabled={loading}
                style={{ padding: '4px 10px', background: '#f0b429', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                {loading ? '...' : '+'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
