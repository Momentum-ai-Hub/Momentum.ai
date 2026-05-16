"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

const fmt = (n, decimals = 2) =>
  n !== null && n !== undefined ? Number(n).toFixed(decimals) : "—";

const pctColor = (v) => {
  if (v === null || v === undefined) return "#546E7A";
  if (v > 0.003) return "#00E676";
  if (v < -0.003) return "#FF1744";
  return "#78909C";
};

const dirMeta = (direction) => ({
  haussier: { color: "#00E676", icon: "▲", bg: "rgba(0,230,118,0.06)" },
  baissier: { color: "#FF1744", icon: "▼", bg: "rgba(255,23,68,0.06)" },
  neutre:   { color: "#78909C", icon: "◆", bg: "rgba(120,144,156,0.04)" },
}[direction] || { color: "#78909C", icon: "◆", bg: "transparent" });

const qualityDot = (q) => ({
  fort:    { color: "#00E676", label: "Fort" },
  "modéré":{ color: "#FFD600", label: "Modéré" },
  faible:  { color: "#FF6D00", label: "Faible" },
}[q] || { color: "#546E7A", label: "—" });

// ─────────────────────────────────────────────────────────────────
// SOUS-COMPOSANTS
// ─────────────────────────────────────────────────────────────────

function ProbabilityArc({ probability, color }) {
  const radius = 28;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - probability);
  const pct = Math.round(probability * 100);

  return (
    <div style={{ position: "relative", width: 72, height: 72 }}>
      <svg width="72" height="72" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="36" cy="36" r={radius} fill="none" stroke="#1C2333" strokeWidth="4" />
        <circle
          cx="36" cy="36" r={radius}
          fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(.4,0,.2,1)" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: 16, fontWeight: 700, color, lineHeight: 1 }}>{pct}%</span>
      </div>
    </div>
  );
}

function ConfidenceStars({ n }) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1, 2, 3].map((i) => (
        <span key={i} style={{ fontSize: 10, color: i <= n ? "#FFD600" : "#1C2333" }}>★</span>
      ))}
    </div>
  );
}

function LeaderPill({ leader }) {
  const color = pctColor(leader.changePct);
  const pct = leader.changePct !== null
    ? `${leader.changePct > 0 ? "+" : ""}${fmt(leader.changePct * 100)}%`
    : "—";

  return (
    <div style={{
      background: "#0D1321",
      border: `1px solid ${color}22`,
      borderRadius: 8,
      padding: "8px 12px",
      display: "flex",
      flexDirection: "column",
      gap: 3,
      minWidth: 105,
      flexShrink: 0,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 8, color: "#3D5166", letterSpacing: 2, fontWeight: 700 }}>
          {leader.region}
        </span>
        <span style={{
          fontSize: 7, color, fontWeight: 700,
          background: `${color}18`, borderRadius: 3, padding: "1px 4px",
        }}>
          {leader.sector}
        </span>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#B0BEC5" }}>{leader.name}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color }}>{pct}</div>
    </div>
  );
}

function ClusterCard({ cluster, index }) {
  const [expanded, setExpanded] = useState(false);
  const { color, icon } = dirMeta(cluster.direction);
  const pct = Math.round(cluster.probability * 100);
  const convictionWidth = Math.abs(pct - 50) * 2;

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        background: "#0B1120",
        border: `1px solid ${expanded ? color + "44" : "#151F30"}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 12,
        padding: "18px 20px",
        cursor: "pointer",
        transition: "border-color 0.2s",
        animationDelay: `${index * 80}ms`,
        animation: "fadeSlide 0.5s ease both",
      }}
    >
      {/* TOP ROW */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20 }}>{cluster.emoji}</span>
          <div>
            <div style={{ fontSize: 9, letterSpacing: 2, fontWeight: 700, color, marginBottom: 3 }}>
              {icon} {cluster.direction.toUpperCase()}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#E8EEF4" }}>{cluster.label}</div>
            <div style={{ fontSize: 9, color: "#3D5166", marginTop: 2, letterSpacing: 1 }}>
              {cluster.tickers.slice(0, 5).join(" · ")}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ textAlign: "right" }}>
            <ConfidenceStars n={cluster.confidence} />
            <div style={{ fontSize: 9, color: "#3D5166", marginTop: 3 }}>
              {cluster.signalCount} signal{cluster.signalCount > 1 ? "s" : ""}
            </div>
          </div>
          <ProbabilityArc probability={cluster.probability} color={color} />
        </div>
      </div>

      {/* BARRE DE CONVICTION */}
      <div style={{ marginBottom: expanded && cluster.signals.length > 0 ? 16 : 0 }}>
        <div style={{ height: 4, background: "#0D1321", borderRadius: 4, overflow: "hidden", position: "relative" }}>
          <div style={{ position: "absolute", left: "50%", top: 0, width: 1, height: "100%", background: "#1C2333" }} />
          <div style={{
            position: "absolute", height: "100%",
            background: `linear-gradient(90deg, ${color}88, ${color})`,
            borderRadius: 4,
            transition: "width 0.8s cubic-bezier(.4,0,.2,1)",
            ...(cluster.direction === "haussier"
              ? { left: "50%", width: `${convictionWidth}%` }
              : cluster.direction === "baissier"
              ? { right: 0, width: `${convictionWidth}%` }
              : { left: "47%", width: "6%" }),
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
          <span style={{ fontSize: 7, color: "#FF1744", letterSpacing: 1 }}>BAISSIER</span>
          <span style={{ fontSize: 7, color: "#3D5166", letterSpacing: 1 }}>NEUTRE</span>
          <span style={{ fontSize: 7, color: "#00E676", letterSpacing: 1 }}>HAUSSIER</span>
        </div>
      </div>

      {/* SIGNAUX DÉTAILLÉS */}
      {expanded && cluster.signals.length > 0 && (
        <div style={{ borderTop: "1px solid #151F30", paddingTop: 14, display: "flex", flexDirection: "column", gap: 7 }}>
          <div style={{ fontSize: 8, letterSpacing: 2, color: "#3D5166", fontWeight: 700, marginBottom: 4 }}>
            SIGNAUX ACTIFS
          </div>
          {cluster.signals.map((s, i) => {
            const sColor = pctColor(s.changePct);
            const dot = qualityDot(s.quality);
            return (
              <div key={i} style={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto auto",
                gap: 10,
                alignItems: "center",
                padding: "7px 10px",
                background: "#0D1321",
                borderRadius: 6,
              }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#B0BEC5" }}>{s.leader}</span>
                  <span style={{ fontSize: 8, color: "#3D5166", marginLeft: 5 }}>({s.region})</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: sColor }}>
                  {s.changePct > 0 ? "+" : ""}{fmt(s.changePct * 100)}%
                </span>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: dot.color, fontWeight: 700 }}>● {dot.label}</div>
                  <div style={{ fontSize: 8, color: "#3D5166" }}>corr. {fmt(s.corr * 100, 0)}%</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 9, color: "#78909C" }}>hit {fmt(s.hitRate * 100, 0)}%</div>
                  <div style={{ fontSize: 8, color: "#3D5166" }}>n={s.n}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {cluster.signals.length > 0 && (
        <div style={{ textAlign: "center", marginTop: 10, fontSize: 8, color: "#3D5166", letterSpacing: 1 }}>
          {expanded ? "▲ RÉDUIRE" : "▼ VOIR LES SIGNAUX"}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────────

export default function MorningEdgeModule() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [lastFetch, setLastFetch] = useState(null);

  const fetchData = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/morning-edge", {
        cache: force ? "no-store" : "default",
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Erreur API");
      setData(json);
      setLastFetch(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh à 9h30 ET (ouverture US)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const etHour = now.getUTCHours() - 4;
      const etMin  = now.getUTCMinutes();
      if (etHour === 9 && etMin === 30) fetchData(true);
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div style={styles.wrapper}>
      <style>{`
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
      `}</style>

      {/* HEADER */}
      <div style={styles.header}>
        <div>
          <div style={styles.moduleTag}>MORNING EDGE</div>
          <h2 style={styles.title}>Session Signal Scanner</h2>
          <p style={styles.subtitle}>
            Corrélations lead-lag 252j · Mise à jour Bayésienne · Filtrage du bruit
          </p>
        </div>
        <div style={styles.headerActions}>
          {data && (
            <div style={styles.metaBadge}>
              <span style={{ color: "#00E676", animation: "pulse 2s infinite" }}>●</span>
              {" "}{data.meta?.leadersAvailable}/{data.meta?.totalLeaders} leaders actifs
            </div>
          )}
          <button onClick={() => fetchData(true)} disabled={loading} style={styles.refreshBtn}>
            {loading ? "⟳" : "↺"} Actualiser
          </button>
          {lastFetch && (
            <div style={styles.timestamp}>
              {lastFetch.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
        </div>
      </div>

      {/* LOADING */}
      {loading && (
        <div style={styles.loadingState}>
          <div style={styles.spinner} />
          <div>
            <div style={styles.loadingTitle}>Calcul des corrélations…</div>
            <div style={styles.loadingSubtitle}>
              Analyse 252 sessions · {data ? "mise à jour" : "premier chargement"}
            </div>
          </div>
        </div>
      )}

      {/* ERROR */}
      {error && !loading && (
        <div style={styles.errorBox}>
          ⚠ {error}
          <button onClick={() => fetchData(true)} style={styles.retryBtn}>Réessayer</button>
        </div>
      )}

      {/* CONTENT */}
      {data && !loading && (
        <>
          {/* Leaders */}
          <div style={styles.section}>
            <div style={styles.sectionLabel}>
              MARCHÉS LEADERS — calculé le {new Date(data.computedAt).toLocaleString("fr-FR")}
            </div>
            <div style={styles.leadersScroll}>
              {data.leaders?.map((l) => <LeaderPill key={l.symbol} leader={l} />)}
            </div>
          </div>

          {/* Clusters */}
          <div style={styles.section}>
            <div style={styles.sectionLabel}>
              SECTEURS US — Trié par conviction · Cliquer pour voir les signaux
            </div>
            <div style={styles.clustersGrid}>
              {data.clusters?.map((c, i) => (
                <ClusterCard key={c.clusterId} cluster={c} index={i} />
              ))}
            </div>
          </div>

          {/* Disclaimer */}
          <div style={styles.disclaimer}>
            ⚠ Corrélations historiques 252 sessions. Corrélation ≠ causalité. Toujours vérifier :
            already priced in · volume · contexte macro · Kelly avant toute prise de position.
            Cache serveur 4h — cliquer Actualiser pour forcer le recalcul.
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────

const styles = {
  wrapper: {
    background: "#080E1C",
    color: "#B8C5D6",
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    padding: 28,
    borderRadius: 16,
    border: "1px solid #111B2D",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
    paddingBottom: 20,
    borderBottom: "1px solid #111B2D",
  },
  moduleTag: {
    fontSize: 9, letterSpacing: 4, color: "#00B0FF", fontWeight: 700, marginBottom: 6,
  },
  title: {
    fontSize: 20, fontWeight: 700, color: "#E8EEF4", margin: "0 0 4px 0",
  },
  subtitle: {
    fontSize: 10, color: "#3D5166", margin: 0, letterSpacing: 1,
  },
  headerActions: {
    display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8,
  },
  metaBadge: {
    fontSize: 9, color: "#546E7A", letterSpacing: 1,
    background: "#0D1321", border: "1px solid #151F30",
    borderRadius: 6, padding: "4px 10px",
  },
  refreshBtn: {
    background: "#0D1321", color: "#00B0FF", border: "1px solid #00B0FF33",
    borderRadius: 8, padding: "8px 16px", cursor: "pointer",
    fontSize: 11, fontFamily: "inherit", fontWeight: 700, letterSpacing: 1,
  },
  timestamp: { fontSize: 9, color: "#3D5166", letterSpacing: 1 },
  loadingState: { display: "flex", alignItems: "center", gap: 20, padding: "40px 0" },
  spinner: {
    width: 28, height: 28,
    border: "2px solid #111B2D", borderTop: "2px solid #00B0FF",
    borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0,
  },
  loadingTitle:    { fontSize: 13, fontWeight: 700, color: "#546E7A", marginBottom: 4 },
  loadingSubtitle: { fontSize: 10, color: "#3D5166", letterSpacing: 1 },
  errorBox: {
    background: "#1A0A0A", border: "1px solid #FF174433",
    borderRadius: 8, padding: "16px 20px", color: "#FF5252", fontSize: 11,
    display: "flex", justifyContent: "space-between", alignItems: "center",
  },
  retryBtn: {
    background: "transparent", color: "#FF5252", border: "1px solid #FF525244",
    borderRadius: 6, padding: "4px 12px", cursor: "pointer",
    fontSize: 10, fontFamily: "inherit",
  },
  section:      { marginBottom: 24 },
  sectionLabel: {
    fontSize: 8, letterSpacing: 2, color: "#3D5166",
    fontWeight: 700, marginBottom: 12, textTransform: "uppercase",
  },
  leadersScroll: { display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8 },
  clustersGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap: 12,
  },
  disclaimer: {
    fontSize: 9, color: "#2A3A4A", letterSpacing: 1,
    borderTop: "1px solid #111B2D", paddingTop: 16, lineHeight: 2,
  },
};
