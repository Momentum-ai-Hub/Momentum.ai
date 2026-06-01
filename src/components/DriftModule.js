'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const FINNHUB_KEY = process.env.NEXT_PUBLIC_FINNHUB_KEY;

export default function DriftModule() {
  const [watchlist, setWatchlist] = useState([]);
  const [calendrier, setCalendrier] = useState([]);
  const [enriching, setEnriching] = useState(false);
  const [enrichStatus, setEnrichStatus] = useState(''); // message affiché sous le calendrier
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

  // ─── STEP 1 : Finnhub scan rapide ────────────────────────────────────────────
  async function scanCalendrier() {
    setScanning(true);
    setEnrichStatus('');
    try {
      const today = new Date();
      const future = new Date();
      future.setDate(future.getDate() + 30);
      const from = today.toISOString().split('T')[0];
      const to = future.toISOString().split('T')[0];

      const res = await fetch(
        `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${FINNHUB_KEY}`
      );
      const data = await res.json();

      const list = data?.earningsCalendar ?? [];
      const filtered = list
        .filter(e => e.symbol && e.date)
        .slice(0, 50);

      setCalendrier(filtered);
      setView('calendrier');
      setScanning(false);

      // ─── STEP 2 : Enrichissement Claude web search en arrière-plan ───────────
      if (filtered.length > 0) {
        enrichirCalendrier(filtered, from, to);
      }
    } catch (e) {
      alert('Erreur scan calendrier');
      setScanning(false);
    }
  }

  // ─── STEP 2 : Claude web search pour enrichir timing + EPS manquants ────────
  async function enrichirCalendrier(baseList, from, to) {
    setEnriching(true);
    setEnrichStatus('⚡ Enrichissement en cours...');
    try {
      // On envoie les tickers sans timing ou sans EPS à Claude pour enrichissement
      const aEnrichir = baseList
        .filter(e => !e.hour || e.epsEstimate === null || e.epsEstimate === undefined)
        .slice(0, 20) // max 20 pour ne pas exploser les tokens
        .map(e => ({ symbol: e.symbol, date: e.date, hour: e.hour || null, epsEstimate: e.epsEstimate ?? null }));

      if (aEnrichir.length === 0) {
        setEnrichStatus('');
        setEnriching(false);
        return;
      }

      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: `Tu es un assistant qui enrichit un calendrier earnings.
Retourne UNIQUEMENT un tableau JSON valide, sans backticks, sans texte autour.
Chaque objet a exactement ces champs :
{ "symbol": "TICKER", "hour": "BMO ou AMC ou null", "epsEstimate": number ou null, "revenueEstimate": number ou null }
Si tu ne trouves pas l'info, mets null. Ne fais pas de suppositions sur les chiffres.`,
          messages: [{
            role: 'user',
            content: `Enrichis ces publications earnings entre le ${from} et le ${to}.\nDonne le timing (BMO = avant ouverture / AMC = après clôture) et l'EPS consensus si disponible.\nListe : ${JSON.stringify(aEnrichir)}`
          }],
          useWebSearch: true
        }),
      });

      const data = await response.json();
      const text = data.content?.[0]?.text ?? '[]';
      const clean = text.replace(/```json|```/g, '').trim();
      const enriched = JSON.parse(clean);

      // Merger les données enrichies dans la liste Finnhub
      setCalendrier(prev => prev.map(item => {
        const match = enriched.find(e => e.symbol === item.symbol);
        if (!match) return item;
        return {
          ...item,
          hour: item.hour || match.hour || null,
          epsEstimate: item.epsEstimate ?? match.epsEstimate ?? null,
          revenueEstimate: match.revenueEstimate ?? null,
        };
      }));

      const enrichCount = enriched.filter(e => e.hour || e.epsEstimate).length;
      setEnrichStatus(`✓ ${enrichCount} titres enrichis (timing + EPS)`);
    } catch (e) {
      setEnrichStatus('⚠ Enrichissement indisponible');
    }
    setEnriching(false);
  }

  // ─── Analyse drift via Claude ─────────────────────────────────────────────────
  async function analyserDrift(ticker, earningsDate) {
    try {
      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: `Tu es un analyste drift pre-earnings. Retourne UNIQUEMENT un JSON valide sans backticks ni markdown :
{"drift_score": 0-10, "signal": "FORT ou MODERE ou FAIBLE ou NEUTRE", "secteur": "secteur", "base_rate": number, "analyse": "narrative 2-3 lignes"}`,
          messages: [{ role: 'user', content: `Analyse drift pre-earnings pour ${ticker} avec publication le ${earningsDate}` }]
        }),
      });
      const data = await response.json();
      const text = data.content?.[0]?.text ?? '{}';
      const clean = text.replace(/```json|```/g, '').trim();
      return JSON.parse(clean);
    } catch (e) {
      return { drift_score: 5, signal: 'MODERE', secteur: 'Inconnu', base_rate: 50, analyse: 'Analyse indisponible' };
    }
  }

  async function ajouterWatchlist(item) {
    setLoading(true);
    try {
      const analyse = await analyserDrift(item.symbol, item.date);
      await supabase.from('drift_watchlist').upsert({
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
      await loadWatchlist();
      setView('watchlist');
    } catch (e) {
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
  const hourColor = { 'BMO': '#3fb950', 'AMC': '#f0b429' };

  return (
    <div style={{ padding: '16px', fontFamily: 'monospace', color: '#e6edf3' }}>

      {/* HEADER */}
      <h2 style={{ color: '#f0b429', fontSize: '18px', marginBottom: '4px' }}>📈 Pre-Earnings Drift</h2>
      <p style={{ color: '#8b949e', fontSize: '12px', marginBottom: '16px' }}>
        ~60% des titres qui vont beater dérivent haussièrement 2-4 semaines avant publication
      </p>

      {/* REGLES */}
      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
        <p style={{ color: '#f0b429', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>Règles drift</p>
        {[
          { color: '#8b949e', text: 'J-30 à J-25 → Identifier si base rate > 65%' },
          { color: '#3fb950', text: 'J-20 à J-15 → ENTRER — 40% capital (120€)' },
          { color: '#e3b341', text: 'J-0 Option A → Vendre veille résultats (sécuriser)' },
          { color: '#e3b341', text: 'J-0 Option B → Garder si signal earnings fort' },
          { color: '#f85149', text: 'STOP si titre >+15% avant résultats → sortir' },
          { color: '#e3b341', text: 'Stop loss drift : -7% | Trailing stop à +5% → break-even' },
        ].map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '4px' }}>
            <span style={{ color: r.color, fontSize: '11px' }}>●</span>
            <span style={{ color: '#c9d1d9', fontSize: '11px' }}>{r.text}</span>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button onClick={() => setView('watchlist')}
          style={{ flex: 1, padding: '8px', background: view === 'watchlist' ? '#f0b429' : '#21262d', color: view === 'watchlist' ? '#000' : '#e6edf3', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
          Watchlist ({watchlist.length})
        </button>
        <button onClick={scanCalendrier} disabled={scanning}
          style={{ flex: 1, padding: '8px', background: view === 'calendrier' ? '#f0b429' : '#21262d', color: view === 'calendrier' ? '#000' : '#e6edf3', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
          {scanning ? 'Scan...' : 'Calendrier 30J'}
        </button>
      </div>

      {/* WATCHLIST */}
      {view === 'watchlist' && (
        <div>
          {watchlist.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#8b949e', padding: '24px' }}>
              <p style={{ fontSize: '12px' }}>Aucun titre en watchlist</p>
              <p style={{ fontSize: '11px', marginTop: '4px' }}>Clique sur "Calendrier 30J" pour scanner</p>
            </div>
          ) : (
            watchlist.map(item => (
              <div key={item.id} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '12px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div>
                    <span style={{ fontWeight: 'bold', fontSize: '15px' }}>{item.ticker}</span>
                    <span style={{ color: '#8b949e', fontSize: '11px', marginLeft: '8px' }}>{item.company_name}</span>
                  </div>
                  <span style={{ background: signalColor[item.signal] || '#484f58', color: '#000', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                    {item.signal}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#8b949e', marginBottom: '6px' }}>
                  <span>📅 {item.earnings_date}</span>
                  <span>🎯 {item.drift_score}/10</span>
                  <span>📊 {item.base_rate}%</span>
                  <span>{item.secteur}</span>
                </div>
                <p style={{ fontSize: '11px', color: '#c9d1d9', marginBottom: '8px', lineHeight: '1.5' }}>{item.analyse_narrative}</p>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span style={{ background: statutColor[item.statut], color: '#000', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>{item.statut}</span>
                  {item.statut === 'WATCHING' && (
                    <button onClick={() => updateStatut(item.id, 'ENTERED')}
                      style={{ padding: '2px 8px', background: '#3fb950', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>
                      ENTRER
                    </button>
                  )}
                  {item.statut === 'ENTERED' && (
                    <button onClick={() => updateStatut(item.id, 'EXITED')}
                      style={{ padding: '2px 8px', background: '#f85149', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>
                      SORTIR
                    </button>
                  )}
                  <button onClick={() => supprimerTitre(item.id)}
                    style={{ padding: '2px 8px', background: '#21262d', color: '#8b949e', border: '1px solid #30363d', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}>
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* CALENDRIER */}
      {view === 'calendrier' && (
        <div>
          {/* Statut enrichissement */}
          {enrichStatus !== '' && (
            <p style={{ fontSize: '11px', color: enriching ? '#58a6ff' : '#3fb950', marginBottom: '10px' }}>
              {enrichStatus}
            </p>
          )}

          {calendrier.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#8b949e', padding: '24px', fontSize: '12px' }}>
              Aucune publication trouvée
            </div>
          ) : (
            <div>
              <p style={{ color: '#8b949e', fontSize: '11px', marginBottom: '12px' }}>
                {calendrier.length} publications — clique + pour analyser et ajouter à la watchlist
              </p>
              {calendrier.map((item, i) => (
                <div key={i} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '6px', padding: '10px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{item.symbol}</span>
                    <span style={{ color: '#8b949e', fontSize: '11px', marginLeft: '8px' }}>{item.date}</span>
                    {/* Timing BMO/AMC — badge coloré si disponible */}
                    {item.hour && (
                      <span style={{ background: hourColor[item.hour] || '#484f58', color: '#000', fontSize: '10px', fontWeight: 'bold', padding: '1px 6px', borderRadius: '4px', marginLeft: '6px' }}>
                        {item.hour}
                      </span>
                    )}
                    {/* EPS estimate */}
                    {item.epsEstimate != null && (
                      <span style={{ color: '#8b949e', fontSize: '11px', marginLeft: '8px' }}>
                        EPS est: ${item.epsEstimate}
                      </span>
                    )}
                    {/* Revenue estimate si enrichi */}
                    {item.revenueEstimate != null && (
                      <span style={{ color: '#8b949e', fontSize: '11px', marginLeft: '8px' }}>
                        Rev: ${(item.revenueEstimate / 1e6).toFixed(0)}M
                      </span>
                    )}
                  </div>
                  <button onClick={() => ajouterWatchlist(item)} disabled={loading}
                    style={{ padding: '4px 12px', background: '#f0b429', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', flexShrink: 0, marginLeft: '8px' }}>
                    {loading ? '...' : '+'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
