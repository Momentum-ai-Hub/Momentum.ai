"use client";

import { useState, useEffect, useCallback } from "react";
import { getCouchesData } from "../lib/api";

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

function aggregateScore(clusters) {
  if (!clusters || clusters.length === 0) return { probability: 0.5, direction: "neutre", signalCount: 0 };
  var sum = 0;
  for (var i = 0; i < clusters.length; i++) sum += clusters[i].probability;
  var prob = sum / clusters.length;
  return {
    probability: prob,
    direction: prob >= 0.60 ? "haussier" : prob <= 0.42 ? "baissier" : "neutre",
    signalCount: clusters.reduce(function(a, c) { return a + (c.signalCount || 0); }, 0),
  };
}

// ─────────────────────────────────────────────────────────────────
// SECTION RECTANGLE — petit rectangle dans un layer
// largeur proportionnelle au sqrt(nbTickers)
// ─────────────────────────────────────────────────────────────────

function SectionRect(props) {
  var section   = props.section;
  var cluster   = props.cluster;
  var onSelect  = props.onSelect;
  var isSelected = props.isSelected;

  var nb    = section.tickers ? section.tickers.length : 0;
  var prob  = cluster ? cluster.probability : 0.5;
  var dir   = cluster ? cluster.direction   : "neutre";
  var color = signalColor(dir, prob);
  var isNeutre = dir === "neutre";

  // Largeur proportionnelle : base 70px + sqrt(nb)*8
  var w = Math.round(70 + Math.sqrt(nb) * 10);

  return (
    <div
      onClick={function() { onSelect(section, cluster); }}
      style={{
        width: w, minHeight: 68,
        borderRadius: 10,
        background: isNeutre ? "#0D1321" : color + "18",
        border: "2px solid " + (isSelected ? color : color + (isNeutre ? "33" : "55")),
        padding: "8px 10px",
        cursor: "pointer",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        boxShadow: isSelected ? "0 0 12px " + color + "44" : "none",
        transition: "all 0.15s",
        flexShrink: 0,
      }}
    >
      {/* Nom section */}
      <div style={{
        fontSize: 10, fontWeight: 700, color: "#D0DCE8",
        lineHeight: 1.3, marginBottom: 6,
        overflow: "hidden",
        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
      }}>
        {section.title || section.id}
      </div>
      {/* Score + nb tickers */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: color }}>
          {Math.round(prob * 100)}%
        </span>
        <span style={{ fontSize: 9, color: "#3D5166" }}>{nb}tk</span>
      </div>
      {/* Barre de score */}
      <div style={{ height: 3, borderRadius: 2, background: "#1C2940", marginTop: 5, overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 2,
          width: Math.round(prob * 100) + "%",
          background: color,
          transition: "width 0.6s ease",
        }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// LAYER BLOCK — grand rectangle avec sections à l'intérieur
// ─────────────────────────────────────────────────────────────────

function LayerBlock(props) {
  var layer      = props.layer;
  var sections   = props.sections;
  var scoreMap   = props.scoreMap;
  var onSelect   = props.onSelect;
  var selectedId = props.selectedId;
  var isPanel    = props.isPanel || false;

  var layerClusters = sections.map(function(s) {
    return scoreMap[s.id] || null;
  }).filter(Boolean);
  var agg   = aggregateScore(layerClusters);
  var color = isPanel ? (props.panelColor || "#94a3b8") : (layer.cc || "#58a6ff");
  var bg    = isPanel ? (props.panelBg || "#08090d") : (layer.bg || "#060e1a");
  var totalTk = sections.reduce(function(a, s) { return a + (s.tickers ? s.tickers.length : 0); }, 0);
  var aggColor = signalColor(agg.direction, agg.probability);

  return (
    <div style={{
      borderRadius: 12,
      border: "2px solid " + color + "55",
      background: bg,
      overflow: "hidden",
      width: "100%",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 14px",
        borderBottom: "1px solid " + color + "22",
        background: color + "11",
      }}>
        <span style={{
          fontFamily: "monospace", fontSize: 9, fontWeight: 800,
          letterSpacing: "0.12em", padding: "2px 7px",
          borderRadius: 4, border: "1px solid " + color + "66",
          color: color, flexShrink: 0,
        }}>
          {isPanel ? (layer.badge || layer.num) : layer.num}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#E8EEF4", flex: 1 }}>
          {layer.name}
        </span>
        <span style={{ fontSize: 9, color: "#3D5166", whiteSpace: "nowrap" }}>
          {totalTk} tickers
        </span>
        <span style={{
          fontSize: 11, fontWeight: 800, color: aggColor,
          minWidth: 36, textAlign: "right",
        }}>
          {Math.round(agg.probability * 100)}%
        </span>
      </div>

      {/* Sections — rangées de rectangles */}
      <div style={{
        padding: "10px 12px",
        display: "flex", flexWrap: "wrap", gap: 8,
      }}>
        {sections.map(function(sec, idx) {
          var cluster = scoreMap[sec.id] || null;
          return (
            <SectionRect
              key={sec.id || idx}
              section={sec}
              cluster={cluster}
              onSelect={onSelect}
              isSelected={selectedId === sec.id}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// CONNECTOR
// ─────────────────────────────────────────────────────────────────

function Connector(props) {
  return (
    <div style={{
      textAlign: "center", fontFamily: "monospace", fontSize: 9,
      color: "#1C2940", padding: "3px 0",
      letterSpacing: "0.06em", fontStyle: "italic",
    }}>
      ↓  {props.text}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// DETAIL PANEL — section sélectionnée, tous les tickers
// ─────────────────────────────────────────────────────────────────

function DetailPanel(props) {
  var section = props.section;
  var cluster = props.cluster;
  var onClose = props.onClose;
  var scoreMap = props.scoreMap;

  if (!section) return null;

  var prob  = cluster ? cluster.probability : 0.5;
  var dir   = cluster ? cluster.direction   : "neutre";
  var color = signalColor(dir, prob);

  // Tous les tickers, triés : haussiers > neutres > baissiers
  // Pour l'instant on n'a pas la perf individuelle par ticker dans scoreMap
  // On affiche tous les tickers avec la couleur du cluster global
  var tickers = section.tickers || [];

  var directSignals = cluster ? (cluster.signals || []).filter(function(s) { return s.source !== "causal"; }) : [];
  var causalSignals = cluster ? (cluster.signals || []).filter(function(s) { return s.source === "causal"; }) : [];

  return (
    <div style={{
      background: "#060C18",
      border: "2px solid " + color + "44",
      borderRadius: 14, padding: 16, marginBottom: 14,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 8, letterSpacing: 2, color: color, marginBottom: 4, fontWeight: 800, fontFamily: "monospace" }}>
            {section.id} · {dir.toUpperCase()} · {Math.round(prob * 100)}%
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#E8EEF4" }}>
            {section.title || section.id}
          </div>
          {section.note && (
            <div style={{ fontSize: 9, color: "#3D5166", marginTop: 3, fontStyle: "italic" }}>{section.note}</div>
          )}
        </div>
        <button onClick={onClose} style={{
          background: "transparent", border: "1px solid #1C2940",
          color: "#546E7A", borderRadius: 8, padding: "6px 12px",
          cursor: "pointer", fontSize: 13, fontFamily: "inherit",
        }}>✕</button>
      </div>

      {/* Tous les tickers */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 9, letterSpacing: 2, color: "#3D5166", fontWeight: 700, marginBottom: 8, fontFamily: "monospace" }}>
          TICKERS ({tickers.length})
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {tickers.map(function(t) {
            return (
              <a key={t}
                href={"https://finance.yahoo.com/quote/" + t}
                target="_blank" rel="noopener noreferrer"
                style={{
                  background: "#0D1321",
                  border: "1px solid " + color + "44",
                  borderRadius: 6, padding: "5px 11px",
                  fontSize: 12, fontWeight: 700,
                  color: color, textDecoration: "none",
                  fontFamily: "monospace",
                  transition: "all 0.12s",
                }}
              >{t}</a>
            );
          })}
        </div>
      </div>

      {/* Propagation causale */}
      {causalSignals.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: "#00B4FF88", fontWeight: 700, marginBottom: 6, fontFamily: "monospace" }}>
            PROPAGATION CAUSALE
          </div>
          {causalSignals.map(function(s, i) {
            return (
              <div key={i} style={{
                background: "#080E1C", border: "1px solid #00B4FF22",
                borderRadius: 8, padding: "7px 12px", marginBottom: 4,
                fontSize: 11, color: "#78909C",
              }}>
                <span style={{ color: "#00B4FF", fontWeight: 700 }}>↗</span>
                {" "}Reçu de{" "}
                <span style={{ color: "#B0BEC5", fontWeight: 700 }}>{s.leader}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Leaders actifs */}
      {directSignals.length > 0 && (
        <div>
          <div style={{ fontSize: 9, letterSpacing: 2, color: "#3D5166", fontWeight: 700, marginBottom: 8, fontFamily: "monospace" }}>
            LEADERS OVERNIGHT ACTIFS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {directSignals.map(function(s, i) {
              var sc  = s.changePct > 0 ? "#00CC66" : "#FF2244";
              var qc  = s.quality === "fort" ? "#00FF88" : s.quality === "modéré" ? "#FFD700" : "#FF6D00";
              return (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "1fr 60px 60px 55px",
                  gap: 8, alignItems: "center",
                  background: "#0D1321", borderRadius: 8, padding: "8px 12px",
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#B0BEC5" }}>
                    {s.leader}
                    <span style={{ fontSize: 8, color: "#3D5166", marginLeft: 5 }}>{s.region}</span>
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: sc, textAlign: "right" }}>
                    {pctFmt(s.changePct)}
                  </span>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 9, color: qc, fontWeight: 700 }}>{s.quality}</div>
                    <div style={{ fontSize: 8, color: "#3D5166" }}>r={Number(s.corr).toFixed(2)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 9, color: "#78909C" }}>
                      {s.hitRate !== null ? Math.round(s.hitRate * 100) + "%" : "—"}
                    </div>
                    <div style={{ fontSize: 8, color: "#3D5166" }}>hit</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {cluster && cluster.signalCount === 0 && (
        <div style={{ textAlign: "center", padding: "12px 0", fontSize: 12, color: "#3D5166" }}>
          Aucun signal overnight suffisant cette nuit.
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// LEADERS PANEL — top 10 haussiers + top 10 baissiers
// ─────────────────────────────────────────────────────────────────

function LeadersPanel(props) {
  var leaders = props.leaders || [];
  if (!leaders.length) return null;

  var available = leaders.filter(function(l) { return l.changePct !== null; });
  available.sort(function(a, b) { return b.changePct - a.changePct; });

  var top10    = available.slice(0, 10);
  var bottom10 = available.slice(-10).reverse();

  function LeaderRow(props) {
    var l     = props.leader;
    var color = l.changePct > 0.003 ? "#00CC66" : l.changePct < -0.003 ? "#FF2244" : "#546E7A";
    return (
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "6px 10px", borderBottom: "1px solid #0D1828",
      }}>
        <div>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#D0DCE8" }}>{l.name}</span>
          <span style={{ fontSize: 9, color: "#3D5166", marginLeft: 6, fontFamily: "monospace" }}>
            {l.region} · {l.sector}
          </span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 800, color: color, fontFamily: "monospace" }}>
          {pctFmt(l.changePct)}
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
      {/* Top 10 haussiers */}
      <div style={{
        background: "#060C18", border: "1px solid #00CC6633",
        borderRadius: 12, overflow: "hidden",
      }}>
        <div style={{ padding: "8px 12px", background: "#00CC6611", borderBottom: "1px solid #00CC6622" }}>
          <span style={{ fontSize: 9, fontWeight: 800, color: "#00CC66", letterSpacing: 2, fontFamily: "monospace" }}>
            ▲ TOP 10 HAUSSIERS
          </span>
        </div>
        {top10.map(function(l) { return <LeaderRow key={l.symbol} leader={l} />; })}
      </div>
      {/* Top 10 baissiers */}
      <div style={{
        background: "#060C18", border: "1px solid #FF224433",
        borderRadius: 12, overflow: "hidden",
      }}>
        <div style={{ padding: "8px 12px", background: "#FF224411", borderBottom: "1px solid #FF224422" }}>
          <span style={{ fontSize: 9, fontWeight: 800, color: "#FF2244", letterSpacing: 2, fontFamily: "monospace" }}>
            ▼ TOP 10 BAISSIERS
          </span>
        </div>
        {bottom10.map(function(l) { return <LeaderRow key={l.symbol} leader={l} />; })}
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
  var forts     = clusters.filter(function(c) {
    return (c.direction === "haussier" && c.probability >= 0.70) ||
           (c.direction === "baissier" && c.probability <= 0.30);
  }).length;
  var total = clusters.length || 1;

  return (
    <div style={{
      display: "flex", gap: 12, flexWrap: "wrap",
      padding: "12px 16px", background: "#060C18",
      border: "1px solid #111B2D", borderRadius: 10, marginBottom: 14,
    }}>
      {[
        { val: haussiers, label: "HAUSSIER", color: "#00CC66" },
        { val: baissiers, label: "BAISSIER", color: "#FF2244" },
        { val: neutres,   label: "NEUTRE",   color: "#546E7A" },
        { val: forts,     label: "🔥 FORTS", color: "#FFD700" },
      ].map(function(item) {
        return (
          <div key={item.label} style={{ flex: 1, minWidth: 55 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: item.color }}>{item.val}</div>
            <div style={{ fontSize: 8, color: "#3D5166", letterSpacing: 1, fontFamily: "monospace" }}>{item.label}</div>
          </div>
        );
      })}
      <div style={{ width: "100%", height: 5, background: "#111B2D", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ display: "flex", height: "100%" }}>
          <div style={{ width: (haussiers / total * 100) + "%", background: "#00CC66", transition: "width 0.8s" }} />
          <div style={{ width: (neutres   / total * 100) + "%", background: "#1C2940" }} />
          <div style={{ width: (baissiers / total * 100) + "%", background: "#FF2244", transition: "width 0.8s" }} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SUPPLY CHAIN MAP — layout 3 colonnes, image de référence
// ─────────────────────────────────────────────────────────────────

var PANEL_COLORS = {
  power:    { cc: "#f87171", bg: "#0f0303" },
  thermal:  { cc: "#38bdf8", bg: "#030b11" },
  security: { cc: "#a3e635", bg: "#050902" },
  edge:     { cc: "#fb923c", bg: "#0f0602" },
  macro:    { cc: "#94a3b8", bg: "#08090d" },
};

function SupplyChainMap(props) {
  var couchesData = props.couchesData;
  var scoreMap    = props.scoreMap;
  var onSelect    = props.onSelect;
  var selectedId  = props.selectedId;

  var layers = couchesData.layers;
  var panels = couchesData.panels;

  // Index panels
  var panelById = {};
  panels.forEach(function(p) { panelById[p.id] = p; });

  var macroPanel    = panelById["macro"];
  var powerPanel    = panelById["power"];
  var thermalPanel  = panelById["thermal"];
  var securityPanel = panelById["security"];
  var edgePanel     = panelById["edge"];

  function getSections(panel) {
    var sections = [];
    if (panel.lists) panel.lists.forEach(function(l) { sections.push(l); });
    if (panel.subs)  panel.subs.forEach(function(sub) {
      sub.lists.forEach(function(l) { sections.push(l); });
    });
    return sections;
  }

  function renderLayerBlock(layer) {
    var sections = layer.lists || [];
    return (
      <LayerBlock
        layer={layer}
        sections={sections}
        scoreMap={scoreMap}
        onSelect={onSelect}
        selectedId={selectedId}
      />
    );
  }

  function renderPanelBlock(panel) {
    if (!panel) return <div />;
    var pc = PANEL_COLORS[panel.id] || { cc: "#94a3b8", bg: "#08090d" };
    var sections = getSections(panel);
    return (
      <LayerBlock
        layer={{ num: panel.badge, name: panel.name, badge: panel.badge, cc: pc.cc, bg: pc.bg, bc: pc.cc }}
        sections={sections}
        scoreMap={scoreMap}
        onSelect={onSelect}
        selectedId={selectedId}
        isPanel={true}
        panelColor={pc.cc}
        panelBg={pc.bg}
      />
    );
  }

  // Lignes de la grille 3 colonnes :
  // [POWER_col | tronc_centre | THERMAL_col]
  // POWER occupe L5→L12 côté gauche
  // THERMAL au niveau L5, SECURITY au niveau L9, EDGE au niveau L11 côté droit

  // On construit le tronc comme liste de rows avec leur contexte panneau droit
  var SIDE_RIGHT = {
    l5: thermalPanel,
    l9: securityPanel,
    l11: edgePanel,
  };

  return (
    <div style={{ minWidth: 700 }}>
      {/* MACRO — centré, en haut */}
      {macroPanel && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 8, letterSpacing: 3, color: "#94a3b8", textAlign: "center",
            fontFamily: "monospace", marginBottom: 4, fontWeight: 700 }}>
            MACRO · WATCHLISTS — non relié au tronc
          </div>
          {renderPanelBlock(macroPanel)}
          <Connector text="parallel — non causal" />
        </div>
      )}

      {/* Grille 3 colonnes : LEFT (power) | CENTRE (L1-L12) | RIGHT (thermal/security/edge) */}
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 220px", gap: 10, alignItems: "start" }}>

        {/* Colonne gauche — POWER (affiché au niveau L5, couvre L5-L12) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {/* Espace pour L1→L4 (4 layers) : on mesure visuellement */}
          <div id="power-spacer" style={{ flexShrink: 0 }} />
          {powerPanel && (
            <div style={{ position: "sticky", top: 0 }}>
              {renderPanelBlock(powerPanel)}
            </div>
          )}
        </div>

        {/* Colonne centre — tronc L1→L12 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {layers.map(function(layer, idx) {
            return (
              <div key={layer.id}>
                {renderLayerBlock(layer)}
                {layer.connBelow && <Connector text={layer.connBelow} />}
              </div>
            );
          })}
        </div>

        {/* Colonne droite — THERMAL (L5), SECURITY (L9), EDGE (L11) */}
        <div id="right-col" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* On va aligner dynamiquement en JS, pour l'instant on empile dans l'ordre */}
          {thermalPanel  && renderPanelBlock(thermalPanel)}
          {securityPanel && renderPanelBlock(securityPanel)}
          {edgePanel     && renderPanelBlock(edgePanel)}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────────

export default function MorningEdgeModule() {
  const [apiData,      setApiData]      = useState(null);
  const [couchesData,  setCouchesData]  = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [lastFetch,    setLastFetch]    = useState(null);
  const [selectedSec,  setSelectedSec]  = useState(null);
  const [selectedClus, setSelectedClus] = useState(null);

  useEffect(function() {
    getCouchesData()
      .then(function(d) { setCouchesData(d); })
      .catch(function(e) { console.error("getCouchesData:", e); });
  }, []);

  const fetchApiData = useCallback(function(force) {
    setLoading(true); setError(null);
    fetch("/api/morning-edge", { cache: force ? "no-store" : "default" })
      .then(function(res) { return res.json(); })
      .then(function(json) {
        if (!json.success) throw new Error(json.error || "Erreur API");
        setApiData(json);
        setLastFetch(new Date());
      })
      .catch(function(e) { setError(e.message); })
      .finally(function() { setLoading(false); });
  }, []);

  useEffect(function() { fetchApiData(false); }, [fetchApiData]);

  var scoreMap = {};
  if (apiData && apiData.clusters) {
    apiData.clusters.forEach(function(c) { scoreMap[c.clusterId] = c; });
  }
  var allClusters = apiData ? (apiData.clusters || []) : [];

  function handleSelect(section, cluster) {
    if (selectedSec && selectedSec.id === section.id) {
      setSelectedSec(null); setSelectedClus(null);
    } else {
      setSelectedSec(section); setSelectedClus(cluster);
    }
  }

  return (
    <div style={{
      background: "#04080F", color: "#B8C5D6",
      fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace",
      padding: "16px 14px", borderRadius: 16,
      border: "1px solid #0D1828",
      overflowX: "auto",
    }}>
      <style>{
        "@keyframes spin{to{transform:rotate(360deg)}}" +
        "@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}"
      }</style>

      {/* HEADER */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid #0D1828",
      }}>
        <div>
          <div style={{ fontSize: 8, letterSpacing: 4, color: "#00B4FF", fontWeight: 800, marginBottom: 3, fontFamily: "monospace" }}>
            MORNING EDGE
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "#E8EEF4", margin: "0 0 2px" }}>
            AI Supply Chain Map
          </h2>
          <p style={{ fontSize: 10, color: "#3D5166", margin: 0 }}>
            L1→L12 · Bayesian Scoring · Structure Supabase
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
          {apiData && (
            <div style={{
              fontSize: 9, color: "#546E7A",
              background: "#0B1120", border: "1px solid #111B2D",
              borderRadius: 6, padding: "3px 8px",
            }}>
              <span style={{ color: "#00CC66", animation: "pulse 2s infinite" }}>●</span>
              {" "}{apiData.meta && apiData.meta.leadersAvailable}/{apiData.meta && apiData.meta.totalLeaders} leaders actifs
            </div>
          )}
          <button onClick={function() { fetchApiData(true); }} disabled={loading}
            style={{
              background: "#0B1120", color: "#00B4FF",
              border: "1px solid #00B4FF33", borderRadius: 6,
              padding: "5px 12px", cursor: "pointer",
              fontSize: 10, fontFamily: "inherit", fontWeight: 700, letterSpacing: 1,
            }}>
            {loading ? "⟳" : "↺"} MAJ
          </button>
          {lastFetch && (
            <div style={{ fontSize: 8, color: "#2A3A4A" }}>
              {lastFetch.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
        </div>
      </div>

      {/* LOADING */}
      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "28px 0" }}>
          <div style={{
            width: 22, height: 22,
            border: "2px solid #111B2D", borderTop: "2px solid #00B4FF",
            borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0,
          }} />
          <div style={{ fontSize: 13, color: "#546E7A" }}>Calcul des corrélations…</div>
        </div>
      )}

      {/* ERROR */}
      {error && !loading && (
        <div style={{
          background: "#1A0A0A", border: "1px solid #FF224433",
          borderRadius: 8, padding: "12px 16px",
          color: "#FF5252", fontSize: 12,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 12,
        }}>
          {"⚠ " + error}
          <button onClick={function() { fetchApiData(true); }} style={{
            background: "transparent", color: "#FF5252",
            border: "1px solid #FF524444", borderRadius: 6,
            padding: "3px 10px", cursor: "pointer", fontSize: 10, fontFamily: "inherit",
          }}>Réessayer</button>
        </div>
      )}

      {/* CONTENT */}
      {!loading && (
        <div>
          {/* Leaders top/bottom 10 */}
          {apiData && apiData.leaders && (
            <LeadersPanel leaders={apiData.leaders} />
          )}

          {/* Summary */}
          {allClusters.length > 0 && <SignalSummaryBar clusters={allClusters} />}

          {/* Détail section sélectionnée */}
          {selectedSec && (
            <DetailPanel
              section={selectedSec}
              cluster={selectedClus}
              scoreMap={scoreMap}
              onClose={function() { setSelectedSec(null); setSelectedClus(null); }}
            />
          )}

          {/* Cluster Map */}
          {couchesData ? (
            <SupplyChainMap
              couchesData={couchesData}
              scoreMap={scoreMap}
              onSelect={handleSelect}
              selectedId={selectedSec ? selectedSec.id : null}
            />
          ) : (
            <div style={{ fontSize: 11, color: "#3D5166", textAlign: "center", padding: "20px 0" }}>
              ⏳ Chargement structure L1-L12…
            </div>
          )}

          {/* Légende */}
          <div style={{
            display: "flex", gap: 16, flexWrap: "wrap",
            marginTop: 16, paddingTop: 12, borderTop: "1px solid #0D1828",
          }}>
            {[
              { color: "#00FF88", label: "Signal fort haussier (>70%)" },
              { color: "#00CC66", label: "Haussier probable" },
              { color: "#FF2244", label: "Baissier" },
              { color: "#3D5166", label: "Neutre / pas de signal" },
            ].map(function(l) {
              return (
                <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: l.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 9, color: "#3D5166" }}>{l.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
