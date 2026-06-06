"use client";

import { useState, useEffect, useCallback } from "react";
import { COUCHES, LIENS_CAUSAUX } from "./MomentumModule";

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

function signalColor(direction, prob) {
  if (direction === "haussier") return prob >= 0.70 ? "#00FF88" : "#00CC66";
  if (direction === "baissier") return prob <= 0.30 ? "#FF2244" : "#CC3344";
  return "#3D5166";
}

function pctFmt(v) {
  if (v === null || v === undefined) return "—";
  return (v > 0 ? "+" : "") + Number(v * 100).toFixed(2) + "%";
}

function fmt(n, d) {
  var decimals = d !== undefined ? d : 2;
  return n !== null && n !== undefined ? Number(n).toFixed(decimals) : "—";
}

// Aplatir COUCHES en tableau plat de listes enrichies
function getAllListes() {
  var result = [];
  COUCHES.forEach(function(couche) {
    couche.listes.forEach(function(liste) {
      result.push({
        id:          liste.id,
        nom:         liste.nom,
        isIA:        liste.isIA,
        tickers:     liste.tickers,
        coucheId:    couche.id,
        coucheLabel: couche.label,
        coucheColor: couche.color,
        coucheBg:    couche.bgColor,
      });
    });
  });
  return result;
}

// Trouver une liste par id dans COUCHES
function findListeById(id) {
  for (var i = 0; i < COUCHES.length; i++) {
    for (var j = 0; j < COUCHES[i].listes.length; j++) {
      if (COUCHES[i].listes[j].id === id) return COUCHES[i].listes[j];
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────
// SCORE BADGE
// ─────────────────────────────────────────────────────────────────

function ScoreBadge(props) {
  var probability = props.probability;
  var direction   = props.direction;
  var size        = props.size || "md";
  var color       = signalColor(direction, probability);
  var pct         = Math.round(probability * 100);
  var isFort      = (direction === "haussier" && probability >= 0.70) ||
                    (direction === "baissier"  && probability <= 0.30);
  var dim         = size === "sm" ? 46 : size === "lg" ? 70 : 56;
  var radius      = dim / 2 - 5;
  var circ        = 2 * Math.PI * radius;
  var offset      = circ * (1 - probability);
  var fsz         = size === "sm" ? 10 : size === "lg" ? 15 : 12;

  return (
    <div style={{ position: "relative", width: dim, height: dim, flexShrink: 0 }}>
      {isFort && (
        <div style={{
          position: "absolute", top: -6, right: -6, zIndex: 2,
          fontSize: 8, background: color, color: "#000",
          borderRadius: 4, padding: "1px 4px", fontWeight: 900,
        }}>
          🔥
        </div>
      )}
      <svg width={dim} height={dim} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={dim / 2} cy={dim / 2} r={radius}
          fill="none" stroke="#1C2940" strokeWidth={size === "sm" ? 3 : 4} />
        <circle cx={dim / 2} cy={dim / 2} r={radius}
          fill="none" stroke={color} strokeWidth={size === "sm" ? 3 : 4}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(.4,0,.2,1)" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: fsz, fontWeight: 800, color: color, lineHeight: 1 }}>
          {pct}%
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// LEADER PILL
// ─────────────────────────────────────────────────────────────────

function LeaderPill(props) {
  var leader = props.leader;
  var color =
    leader.changePct === null   ? "#546E7A"
    : leader.changePct > 0.003  ? "#00CC66"
    : leader.changePct < -0.003 ? "#FF2244"
    : "#78909C";

  return (
    <div style={{
      background: "#0B1120",
      border: "1px solid " + color + "22",
      borderRadius: 8, padding: "8px 12px",
      flexShrink: 0, minWidth: 100,
    }}>
      <div style={{ fontSize: 7, letterSpacing: 2, color: "#3D5166", fontWeight: 700, marginBottom: 3 }}>
        {leader.region} · {leader.sector}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#B0BEC5", marginBottom: 3 }}>
        {leader.name}
      </div>
      <div style={{ fontSize: 14, fontWeight: 800, color: color }}>
        {pctFmt(leader.changePct)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SIGNAL SUMMARY BAR
// ─────────────────────────────────────────────────────────────────

function SignalSummaryBar(props) {
  var clusters  = props.clusters;
  var haussiers = clusters.filter(function(c) { return c.direction === "haussier"; }).length;
  var baissiers = clusters.filter(function(c) { return c.direction === "baissier"; }).length;
  var neutres   = clusters.filter(function(c) { return c.direction === "neutre"; }).length;
  var total     = clusters.length || 1;
  var forts     = clusters.filter(function(c) {
    return (c.direction === "haussier" && c.probability >= 0.70) ||
           (c.direction === "baissier" && c.probability <= 0.30);
  }).length;

  return (
    <div style={{
      display: "flex", gap: 8, flexWrap: "wrap",
      padding: "12px 16px",
      background: "#060C18",
      border: "1px solid #111B2D",
      borderRadius: 10, marginBottom: 16,
    }}>
      <div style={{ flex: 1, minWidth: 55 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#00CC66" }}>{haussiers}</div>
        <div style={{ fontSize: 8, color: "#3D5166", letterSpacing: 1 }}>HAUSSIER</div>
      </div>
      <div style={{ flex: 1, minWidth: 55 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#FF2244" }}>{baissiers}</div>
        <div style={{ fontSize: 8, color: "#3D5166", letterSpacing: 1 }}>BAISSIER</div>
      </div>
      <div style={{ flex: 1, minWidth: 55 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#546E7A" }}>{neutres}</div>
        <div style={{ fontSize: 8, color: "#3D5166", letterSpacing: 1 }}>NEUTRE</div>
      </div>
      <div style={{ flex: 1, minWidth: 55 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#FFD700" }}>{forts}</div>
        <div style={{ fontSize: 8, color: "#3D5166", letterSpacing: 1 }}>🔥 FORTS</div>
      </div>
      <div style={{ width: "100%", height: 5, background: "#111B2D", borderRadius: 4, marginTop: 4, overflow: "hidden" }}>
        <div style={{ display: "flex", height: "100%" }}>
          <div style={{ width: (haussiers / total * 100) + "%", background: "#00CC66", transition: "width 0.8s ease" }} />
          <div style={{ width: (neutres   / total * 100) + "%", background: "#1C2940" }} />
          <div style={{ width: (baissiers / total * 100) + "%", background: "#FF2244", transition: "width 0.8s ease" }} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// CLUSTER NODE — carte dans la map causale
// ─────────────────────────────────────────────────────────────────

function ClusterNode(props) {
  var cluster    = props.cluster;
  var onSelect   = props.onSelect;
  var isSelected = props.isSelected;
  var color      = signalColor(cluster.direction, cluster.probability);
  var isNeutre   = cluster.direction === "neutre";
  var isFort     = (cluster.direction === "haussier" && cluster.probability >= 0.70) ||
                   (cluster.direction === "baissier"  && cluster.probability <= 0.30);

  return (
    <div
      onClick={function() { onSelect(cluster); }}
      style={{
        background:   isSelected ? color + "14" : "#080E1C",
        border:       "1px solid " + (isSelected ? color + "55" : isNeutre ? "#1C2940" : color + "44"),
        borderRadius: 10,
        padding:      "9px 12px",
        cursor:       "pointer",
        display:      "flex",
        alignItems:   "center",
        gap:          9,
        opacity:      isNeutre && !isSelected ? 0.55 : 1,
        flex:         "0 0 auto",
        width:        "calc(50% - 6px)",
        boxSizing:    "border-box",
        transition:   "all 0.18s",
      }}
    >
      <ScoreBadge probability={cluster.probability} direction={cluster.direction} size="sm" />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
          {isFort && (
            <span style={{
              fontSize: 7, background: color, color: "#000",
              borderRadius: 3, padding: "1px 4px", fontWeight: 900, flexShrink: 0,
            }}>FORT</span>
          )}
          {cluster.isIA && (
            <span style={{
              fontSize: 7, color: "#00B4FF",
              border: "1px solid #00B4FF44",
              borderRadius: 3, padding: "1px 4px", fontWeight: 700, flexShrink: 0,
            }}>IA</span>
          )}
        </div>
        <div style={{
          fontSize: 10, fontWeight: 700,
          color: isNeutre ? "#546E7A" : "#C8D8E8",
          lineHeight: 1.2, whiteSpace: "nowrap",
          overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {cluster.nom}
        </div>
        <div style={{ fontSize: 8, color: color, marginTop: 2, fontWeight: 700, opacity: isNeutre ? 0.5 : 1 }}>
          {cluster.direction === "haussier" ? "▲" : cluster.direction === "baissier" ? "▼" : "◆"}
          {" "}{cluster.signalCount} signal{cluster.signalCount > 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// LAYER ROW — une couche causale C0…C4
// ─────────────────────────────────────────────────────────────────

function LayerRow(props) {
  var couche     = props.couche;
  var clusters   = props.clusters;
  var onSelect   = props.onSelect;
  var selectedId = props.selectedId;

  var visible = clusters.filter(function(c) { return c.coucheId === couche.id; });
  if (visible.length === 0) return null;

  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{
        fontSize: 8, letterSpacing: 3, fontWeight: 800,
        color: couche.color, marginBottom: 8, paddingLeft: 4,
      }}>
        {couche.label}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingBottom: 4 }}>
        {visible.map(function(c) {
          return (
            <ClusterNode
              key={c.id}
              cluster={c}
              onSelect={onSelect}
              isSelected={selectedId === c.id}
            />
          );
        })}
      </div>
      {couche.id !== "C4" && (
        <div style={{ textAlign: "center", padding: "5px 0", color: "#1C2940", fontSize: 16, lineHeight: 1 }}>
          ↓
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// DETAIL PANEL — cluster sélectionné
// ─────────────────────────────────────────────────────────────────

function DetailPanel(props) {
  var cluster = props.cluster;
  var onClose = props.onClose;

  if (!cluster) return null;

  var color         = signalColor(cluster.direction, cluster.probability);
  var directSignals = (cluster.signals || []).filter(function(s) { return s.source !== "causal"; });
  var causalSignals = (cluster.signals || []).filter(function(s) { return s.source === "causal"; });

  // Liens causaux lus depuis LIENS_CAUSAUX (source de vérité MomentumModule)
  var causalParents = LIENS_CAUSAUX
    .filter(function(pair) { return pair[1] === cluster.id; })
    .map(function(pair) { return findListeById(pair[0]); })
    .filter(Boolean);

  var causalChildren = LIENS_CAUSAUX
    .filter(function(pair) { return pair[0] === cluster.id; })
    .map(function(pair) { return findListeById(pair[1]); })
    .filter(Boolean);

  return (
    <div style={{
      background: "#060C18",
      border: "1px solid " + color + "44",
      borderRadius: 16, padding: "18px",
      marginBottom: 16,
      animation: "slideDown 0.22s ease",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <ScoreBadge probability={cluster.probability} direction={cluster.direction} size="lg" />
          <div>
            <div style={{ fontSize: 8, letterSpacing: 2, color: color, marginBottom: 4, fontWeight: 800 }}>
              {cluster.coucheId} · {cluster.direction.toUpperCase()}
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#E8EEF4" }}>
              {cluster.nom}
            </div>
            {cluster.isIA && (
              <div style={{
                display: "inline-block", marginTop: 4,
                fontSize: 8, color: "#00B4FF",
                border: "1px solid #00B4FF44",
                borderRadius: 4, padding: "2px 6px",
                fontWeight: 700, letterSpacing: 1,
              }}>
                IA CHAIN
              </div>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "transparent", border: "1px solid #1C2940",
            color: "#546E7A", borderRadius: 8, padding: "6px 12px",
            cursor: "pointer", fontSize: 12, fontFamily: "inherit",
          }}
        >
          ✕
        </button>
      </div>

      {/* Top tickers */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 8, letterSpacing: 2, color: "#3D5166", fontWeight: 700, marginBottom: 6 }}>
          TICKERS À SURVEILLER
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(cluster.tickers || []).slice(0, 6).map(function(t) {
            return (
              <a
                key={t}
                href={"https://finance.yahoo.com/quote/" + t}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: "#0D1321",
                  border: "1px solid " + color + "33",
                  borderRadius: 6, padding: "4px 10px",
                  fontSize: 11, fontWeight: 700,
                  color: color, textDecoration: "none",
                }}
              >
                {t}
              </a>
            );
          })}
          {(cluster.tickers || []).length > 6 && (
            <span style={{ fontSize: 9, color: "#3D5166", alignSelf: "center" }}>
              +{cluster.tickers.length - 6} autres
            </span>
          )}
        </div>
      </div>

      {/* Liens causaux depuis LIENS_CAUSAUX */}
      {(causalParents.length > 0 || causalChildren.length > 0) && (
        <div style={{
          marginBottom: 14, background: "#080E1C",
          border: "1px solid #111B2D",
          borderRadius: 10, padding: "10px 14px",
        }}>
          {causalParents.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 8, letterSpacing: 2, color: "#484f58", fontWeight: 700, marginBottom: 5 }}>
                ALIMENTÉ PAR
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {causalParents.map(function(l) {
                  return (
                    <span key={l.id} style={{
                      fontSize: 9, fontWeight: 600, color: "#f0b429",
                      background: "rgba(240,180,41,0.1)",
                      border: "1px solid rgba(240,180,41,0.2)",
                      borderRadius: 6, padding: "3px 8px",
                    }}>
                      ↑ {l.nom}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          {causalChildren.length > 0 && (
            <div>
              <div style={{ fontSize: 8, letterSpacing: 2, color: "#484f58", fontWeight: 700, marginBottom: 5 }}>
                ALIMENTE
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {causalChildren.map(function(l) {
                  return (
                    <span key={l.id} style={{
                      fontSize: 9, fontWeight: 600, color: "#00B4FF",
                      background: "rgba(0,180,255,0.08)",
                      border: "1px solid rgba(0,180,255,0.2)",
                      borderRadius: 6, padding: "3px 8px",
                    }}>
                      ↓ {l.nom}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Signaux directs overnight */}
      {directSignals.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 8, letterSpacing: 2, color: "#3D5166", fontWeight: 700, marginBottom: 6 }}>
            LEADERS OVERNIGHT ACTIFS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {directSignals.map(function(s, i) {
              var sc = s.changePct > 0 ? "#00CC66" : "#FF2244";
              var qc = s.quality === "fort" ? "#00FF88" : s.quality === "modéré" ? "#FFD700" : "#FF6D00";
              return (
                <div key={i} style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 55px 55px 55px",
                  gap: 8, alignItems: "center",
                  background: "#0D1321", borderRadius: 8, padding: "8px 12px",
                }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#B0BEC5" }}>{s.leader}</span>
                    <span style={{ fontSize: 8, color: "#3D5166", marginLeft: 5 }}>{s.region}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: sc, textAlign: "right" }}>
                    {pctFmt(s.changePct)}
                  </span>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 8, color: qc, fontWeight: 700 }}>{s.quality}</div>
                    <div style={{ fontSize: 7, color: "#3D5166" }}>{"r=" + fmt(s.corr, 2)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 8, color: "#78909C" }}>
                      {s.hitRate !== null ? fmt(s.hitRate * 100, 0) + "%" : "—"}
                    </div>
                    <div style={{ fontSize: 7, color: "#3D5166" }}>hit rate</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Propagation causale reçue */}
      {causalSignals.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 8, letterSpacing: 2, color: "#00B4FF88", fontWeight: 700, marginBottom: 6 }}>
            PROPAGATION CAUSALE REÇUE
          </div>
          {causalSignals.map(function(s, i) {
            var pc = s.changePct > 0 ? "#00CC66" : s.changePct < 0 ? "#FF2244" : "#546E7A";
            return (
              <div key={i} style={{
                background: "#080E1C", border: "1px solid #00B4FF22",
                borderRadius: 8, padding: "8px 12px", marginBottom: 4,
                fontSize: 10, color: "#78909C",
              }}>
                <span style={{ color: "#00B4FF", fontWeight: 700 }}>↗</span>
                {" "}Signal transmis par{" "}
                <span style={{ color: "#B0BEC5", fontWeight: 700 }}>{s.leader}</span>
                <span style={{ color: pc, marginLeft: 8, fontWeight: 700 }}>
                  {s.changePct > 0 ? "haussier" : s.changePct < 0 ? "baissier" : "neutre"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {cluster.signalCount === 0 && (
        <div style={{ textAlign: "center", padding: "16px 0", fontSize: 11, color: "#3D5166" }}>
          Aucun signal overnight suffisant.
          <br />
          <span style={{ fontSize: 9 }}>Leaders corrélés n'ont pas bougé de plus de 0.3% cette nuit.</span>
        </div>
      )}

      <div style={{
        fontSize: 8, color: "#2A3A4A", marginTop: 12,
        borderTop: "1px solid #111B2D", paddingTop: 10, lineHeight: 1.8,
      }}>
        ⚠ Pearson lag-1 · 252 sessions · Liens causaux : LIENS_CAUSAUX (MomentumModule)
        · Vérifier : already priced in · volume · Kelly avant toute position.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────────

export default function MorningEdgeModule() {
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [selected, setSelected]   = useState(null);
  const [view, setView]           = useState("map");

  // Source de vérité : toutes les listes aplaties depuis COUCHES
  const allListes = getAllListes();

  const fetchData = useCallback(function(force) {
    setLoading(true);
    setError(null);
    fetch("/api/morning-edge", { cache: force ? "no-store" : "default" })
      .then(function(res) { return res.json(); })
      .then(function(json) {
        if (!json.success) throw new Error(json.error || "Erreur API");
        setData(json);
        setLastFetch(new Date());
      })
      .catch(function(e) { setError(e.message); })
      .finally(function() { setLoading(false); });
  }, []);

  useEffect(function() { fetchData(false); }, [fetchData]);

  // Auto-refresh à 9h30 ET
  useEffect(function() {
    var interval = setInterval(function() {
      var now    = new Date();
      var etHour = now.getUTCHours() - 4;
      var etMin  = now.getUTCMinutes();
      if (etHour === 9 && etMin === 30) fetchData(true);
    }, 60000);
    return function() { clearInterval(interval); };
  }, [fetchData]);

  // Fusionner les scores API avec la structure COUCHES
  // L'API indexe ses clusters par liste.id (clusterId = liste.id)
  function buildScoredListes(apiClusters) {
    var scoreMap = {};
    if (apiClusters && apiClusters.length > 0) {
      apiClusters.forEach(function(c) {
        scoreMap[c.clusterId] = c;
      });
    }
    return allListes.map(function(liste) {
      var score = scoreMap[liste.id];
      if (score) {
        return Object.assign({}, liste, {
          probability: score.probability,
          direction:   score.direction,
          confidence:  score.confidence,
          signalCount: score.signalCount,
          signals:     score.signals,
        });
      }
      return Object.assign({}, liste, {
        probability: 0.50,
        direction:   "neutre",
        confidence:  0,
        signalCount: 0,
        signals:     [],
      });
    });
  }

  var scoredListes = buildScoredListes(data ? data.clusters : []);

  function handleSelect(cluster) {
    setSelected(function(prev) {
      return prev && prev.id === cluster.id ? null : cluster;
    });
  }

  return (
    <div style={{
      background: "#04080F",
      color: "#B8C5D6",
      fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
      padding: "20px 16px",
      borderRadius: 16,
      border: "1px solid #0D1828",
      minHeight: 400,
    }}>
      <style>{
        "@keyframes fadeSlide { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }" +
        "@keyframes slideDown { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }" +
        "@keyframes spin { to { transform:rotate(360deg); } }" +
        "@keyframes pulse { 0%,100%{opacity:1;}50%{opacity:0.3;} }"
      }</style>

      {/* HEADER */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid #0D1828",
      }}>
        <div>
          <div style={{ fontSize: 8, letterSpacing: 4, color: "#00B4FF", fontWeight: 800, marginBottom: 4 }}>
            MORNING EDGE
          </div>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: "#E8EEF4", margin: "0 0 3px" }}>
            Causal Signal Map
          </h2>
          <p style={{ fontSize: 9, color: "#3D5166", margin: 0, letterSpacing: 1 }}>
            {allListes.length} listes · {LIENS_CAUSAUX.length} liens · Source: MomentumModule
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          {data && (
            <div style={{
              fontSize: 8, color: "#546E7A",
              background: "#0B1120", border: "1px solid #111B2D",
              borderRadius: 6, padding: "3px 8px",
            }}>
              <span style={{ color: "#00CC66", animation: "pulse 2s infinite" }}>●</span>
              {" "}{data.meta && data.meta.leadersAvailable}/{data.meta && data.meta.totalLeaders} leaders
            </div>
          )}
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={function() { setView(function(v) { return v === "map" ? "list" : "map"; }); }}
              style={{
                background: "#0B1120", color: "#00B4FF",
                border: "1px solid #00B4FF33", borderRadius: 6,
                padding: "5px 10px", cursor: "pointer",
                fontSize: 9, fontFamily: "inherit", fontWeight: 700, letterSpacing: 1,
              }}
            >
              {view === "map" ? "⊟ LISTE" : "⊞ MAP"}
            </button>
            <button
              onClick={function() { fetchData(true); }}
              disabled={loading}
              style={{
                background: "#0B1120", color: "#00B4FF",
                border: "1px solid #00B4FF33", borderRadius: 6,
                padding: "5px 10px", cursor: "pointer",
                fontSize: 9, fontFamily: "inherit", fontWeight: 700, letterSpacing: 1,
              }}
            >
              {loading ? "⟳" : "↺"} MAJ
            </button>
          </div>
          {lastFetch && (
            <div style={{ fontSize: 7, color: "#2A3A4A" }}>
              {lastFetch.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
        </div>
      </div>

      {/* LOADING */}
      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "32px 0" }}>
          <div style={{
            width: 24, height: 24,
            border: "2px solid #111B2D", borderTop: "2px solid #00B4FF",
            borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0,
          }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#546E7A", marginBottom: 4 }}>
              Calcul des corrélations…
            </div>
            <div style={{ fontSize: 9, color: "#2A3A4A" }}>
              {allListes.length} listes · {LIENS_CAUSAUX.length} liens causaux · propagation C0→C4
            </div>
          </div>
        </div>
      )}

      {/* ERROR */}
      {error && !loading && (
        <div style={{
          background: "#1A0A0A", border: "1px solid #FF224433",
          borderRadius: 8, padding: "14px 18px",
          color: "#FF5252", fontSize: 10,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 12,
        }}>
          {"⚠ " + error}
          <button
            onClick={function() { fetchData(true); }}
            style={{
              background: "transparent", color: "#FF5252",
              border: "1px solid #FF525244", borderRadius: 6,
              padding: "3px 10px", cursor: "pointer",
              fontSize: 9, fontFamily: "inherit",
            }}
          >
            Réessayer
          </button>
        </div>
      )}

      {/* CONTENT */}
      {!loading && (
        <div>
          {/* Leaders overnight */}
          {data && data.leaders && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 7, letterSpacing: 2, color: "#3D5166", fontWeight: 700, marginBottom: 8 }}>
                {"MARCHÉS LEADERS — " + new Date(data.computedAt).toLocaleString("fr-FR")}
              </div>
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6 }}>
                {data.leaders.map(function(l) {
                  return <LeaderPill key={l.symbol} leader={l} />;
                })}
              </div>
            </div>
          )}

          {/* Résumé signaux */}
          {scoredListes.length > 0 && (
            <SignalSummaryBar clusters={scoredListes} />
          )}

          {/* Panel détail */}
          {selected && (
            <DetailPanel
              cluster={selected}
              onClose={function() { setSelected(null); }}
            />
          )}

          {/* VUE MAP C0→C4 — itère sur COUCHES directement */}
          {view === "map" && (
            <div>
              <div style={{ fontSize: 7, letterSpacing: 2, color: "#3D5166", fontWeight: 700, marginBottom: 10 }}>
                MAP CAUSALE — Structure: MomentumModule · Cliquer un cluster pour le détail
              </div>
              {COUCHES.map(function(couche) {
                return (
                  <LayerRow
                    key={couche.id}
                    couche={couche}
                    clusters={scoredListes}
                    onSelect={handleSelect}
                    selectedId={selected ? selected.id : null}
                  />
                );
              })}
            </div>
          )}

          {/* VUE LISTE — triée par conviction décroissante */}
          {view === "list" && (
            <div>
              <div style={{ fontSize: 7, letterSpacing: 2, color: "#3D5166", fontWeight: 700, marginBottom: 10 }}>
                TOUTES LES LISTES — Triées par conviction décroissante
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {scoredListes
                  .slice()
                  .sort(function(a, b) {
                    return Math.abs(b.probability - 0.5) - Math.abs(a.probability - 0.5);
                  })
                  .map(function(c, i) {
                    var color    = signalColor(c.direction, c.probability);
                    var isNeutre = c.direction === "neutre";
                    return (
                      <div
                        key={c.id}
                        onClick={function() { handleSelect(c); }}
                        style={{
                          background:   "#0B1120",
                          border:       "1px solid " + (isNeutre ? "#111B2D" : color + "44"),
                          borderLeft:   "3px solid " + (isNeutre ? "#1C2940" : color),
                          borderRadius: 10,
                          padding:      "11px 14px",
                          cursor:       "pointer",
                          display:      "flex",
                          alignItems:   "center",
                          gap:          12,
                          opacity:      isNeutre ? 0.55 : 1,
                          animation:    "fadeSlide 0.4s ease both",
                          animationDelay: i * 25 + "ms",
                        }}
                      >
                        <ScoreBadge probability={c.probability} direction={c.direction} size="sm" />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 8, letterSpacing: 1, color: c.coucheColor, fontWeight: 700, marginBottom: 2 }}>
                            {c.coucheId + (c.isIA ? " · IA" : "")}
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#C8D8E8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {c.nom}
                          </div>
                          <div style={{ fontSize: 8, color: "#3D5166", marginTop: 2 }}>
                            {(c.tickers || []).slice(0, 4).join(" · ")}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: color }}>
                            {(c.direction === "haussier" ? "▲ " : c.direction === "baissier" ? "▼ " : "◆ ") + c.direction.toUpperCase()}
                          </div>
                          <div style={{ fontSize: 8, color: "#3D5166", marginTop: 2 }}>
                            {c.signalCount + " signal" + (c.signalCount > 1 ? "s" : "")}
                          </div>
                        </div>
                      </div>
                    );
                  })
                }
              </div>
            </div>
          )}

          {/* Légende */}
          <div style={{
            display: "flex", gap: 10, flexWrap: "wrap",
            marginTop: 16, paddingTop: 12,
            borderTop: "1px solid #0D1828",
          }}>
            {[
              { color: "#00FF88", label: "Signal fort haussier" },
              { color: "#00CC66", label: "Haussier probable" },
              { color: "#FF2244", label: "Baissier" },
              { color: "#3D5166", label: "Neutre" },
              { color: "#00B4FF", label: "IA Chain" },
            ].map(function(l) {
              return (
                <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: l.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 7, color: "#2A3A4A" }}>{l.label}</span>
                </div>
              );
            })}
          </div>

          <div style={{ fontSize: 8, color: "#1C2940", marginTop: 10, lineHeight: 1.8 }}>
            ⚠ Structure des listes et liens causaux : source unique MomentumModule.
            Corrélations historiques 252 sessions. Cache serveur 4h.
          </div>
        </div>
      )}
    </div>
  );
}
