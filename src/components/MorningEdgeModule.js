"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { getCouchesData } from "../lib/api";

// ─────────────────────────────────────────────────────────────────
// LAYOUT CONSTANTS (canvas interne de la carte, largeur de référence 1200px)
//   EXTERIOR (7.5%)  PANEL_W (17%)  [gap]  TRUNK_W (51%)  [gap]  PANEL_W (17%)  EXTERIOR (7.5%)
//   7.5 + 17 + 51 + 17 + 7.5 = 100  → le tronc est centré, marge = EXTERIOR + PANEL_W
// ─────────────────────────────────────────────────────────────────

var PANEL_W   = "17%";
var EXTERIOR  = "7.5%";
var TRUNK_W   = "51%";
var TRUNK_ML  = "24.5%"; // EXTERIOR + PANEL_W
var TRUNK_MR  = "24.5%";

// Largeur de référence du canvas (px) — sert de base au zoom / fit-to-screen
var CONTENT_W = 1200;
var ZOOM_MIN  = 0.25;
var ZOOM_MAX  = 1;
var ZOOM_STEP = 0.1;

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
// SECTION RECTANGLE
// width: 100% dans son container flex, pas de troncature sur le nom
// ─────────────────────────────────────────────────────────────────

function SectionRect(props) {
  var section    = props.section;
  var cluster    = props.cluster;
  var onSelect   = props.onSelect;
  var isSelected = props.isSelected;

  var nb       = section.tickers ? section.tickers.length : 0;
  var prob     = cluster ? cluster.probability : 0.5;
  var dir      = cluster ? cluster.direction   : "neutre";
  var color    = signalColor(dir, prob);
  var isNeutre = dir === "neutre";

  return (
    <div
      onClick={function() { onSelect(section, cluster); }}
      style={{
        width: "100%",
        minHeight: 80,
        borderRadius: 10,
        background: isNeutre ? "#0D1321" : color + "18",
        border: "2px solid " + (isSelected ? color : color + (isNeutre ? "33" : "55")),
        padding: "10px 12px",
        cursor: "pointer",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        boxShadow: isSelected ? "0 0 12px " + color + "44" : "none",
        transition: "all 0.15s",
        boxSizing: "border-box",
      }}
    >
      <div style={{
        fontSize: 11, fontWeight: 700, color: "#D0DCE8",
        lineHeight: 1.3, marginBottom: 6,
        wordBreak: "break-word",
        whiteSpace: "normal",
      }}>
        {section.title || section.id}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: color }}>
          {Math.round(prob * 100)}%
        </span>
        <span style={{ fontSize: 9, color: "#3D5166" }}>{nb}tk</span>
      </div>
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
// LAYER BLOCK
// oneColumn=true  → 1 section par ligne (panneaux latéraux Power/Thermal/Security/Edge)
// oneColumn=false → 3 sections par ligne (tronc L1-L12, et panneau Macro)
// ─────────────────────────────────────────────────────────────────

function LayerBlock(props) {
  var layer      = props.layer;
  var sections   = props.sections;
  var scoreMap   = props.scoreMap;
  var onSelect   = props.onSelect;
  var selectedId = props.selectedId;
  var isPanel    = props.isPanel || false;
  var oneColumn  = props.oneColumn || false;

  var layerClusters = sections.map(function(s) {
    return scoreMap[s.id] || null;
  }).filter(Boolean);
  var agg      = aggregateScore(layerClusters);
  var color    = isPanel ? (props.panelColor || "#94a3b8") : (layer.cc || "#58a6ff");
  var bg       = isPanel ? (props.panelBg    || "#08090d") : (layer.bg || "#060e1a");
  var totalTk  = sections.reduce(function(a, s) { return a + (s.tickers ? s.tickers.length : 0); }, 0);
  var aggColor = signalColor(agg.direction, agg.probability);

  var sectionBasis = oneColumn ? "1 1 100%" : "1 1 calc(33% - 8px)";
  var sectionMaxW  = oneColumn ? "100%" : "calc(33% - 8px)";

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
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 14px",
        borderBottom: "1px solid " + color + "22",
        background: color + "11",
        flexWrap: "wrap",
      }}>
        <span style={{
          fontFamily: "monospace", fontSize: 9, fontWeight: 800,
          letterSpacing: "0.12em", padding: "2px 7px",
          borderRadius: 4, border: "1px solid " + color + "66",
          color: color, flexShrink: 0,
        }}>
          {isPanel ? (layer.badge || layer.num) : layer.num}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#E8EEF4", flex: 1, minWidth: 80 }}>
          {layer.name}
        </span>
        <span style={{ fontSize: 10, color: "#8899aa", whiteSpace: "nowrap", flexShrink: 0 }}>
          {totalTk} tk
        </span>
        <span style={{
          fontSize: 12, fontWeight: 800, color: aggColor,
          whiteSpace: "nowrap", flexShrink: 0, minWidth: 38, textAlign: "right",
        }}>
          {Math.round(agg.probability * 100)}%
        </span>
      </div>

      {/* Sections */}
      <div style={{
        padding: "10px 12px",
        display: "flex", flexWrap: "wrap", gap: 8,
      }}>
        {sections.map(function(sec, idx) {
          var cluster = scoreMap[sec.id] || null;
          return (
            <div key={sec.id || idx} style={{
              flex: sectionBasis,
              minWidth: 0,
              maxWidth: sectionMaxW,
            }}>
              <SectionRect
                section={sec}
                cluster={cluster}
                onSelect={onSelect}
                isSelected={selectedId === sec.id}
              />
            </div>
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
      {"↓  " + props.text}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// DETAIL PANEL
// ─────────────────────────────────────────────────────────────────

function DetailPanel(props) {
  var section  = props.section;
  var cluster  = props.cluster;
  var onClose  = props.onClose;

  if (!section) return null;

  var prob  = cluster ? cluster.probability : 0.5;
  var dir   = cluster ? cluster.direction   : "neutre";
  var color = signalColor(dir, prob);

  var tickers       = section.tickers || [];
  var directSignals = cluster ? (cluster.signals || []).filter(function(s) { return s.source !== "causal"; }) : [];
  var causalSignals = cluster ? (cluster.signals || []).filter(function(s) { return s.source === "causal"; }) : [];

  return (
    <div style={{
      background: "#060C18",
      border: "2px solid " + color + "44",
      borderRadius: 14, padding: 16, marginBottom: 14,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 8, letterSpacing: 2, color: color, marginBottom: 4, fontWeight: 800, fontFamily: "monospace" }}>
            {section.id + " · " + dir.toUpperCase() + " · " + Math.round(prob * 100) + "%"}
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

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 9, letterSpacing: 2, color: "#3D5166", fontWeight: 700, marginBottom: 8, fontFamily: "monospace" }}>
          {"TICKERS (" + tickers.length + ")"}
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
                <span style={{ color: "#00B4FF", fontWeight: 700 }}>{"↗"}</span>
                {" Reçu de "}
                <span style={{ color: "#B0BEC5", fontWeight: 700 }}>{s.leader}</span>
              </div>
            );
          })}
        </div>
      )}

      {directSignals.length > 0 && (
        <div>
          <div style={{ fontSize: 9, letterSpacing: 2, color: "#3D5166", fontWeight: 700, marginBottom: 8, fontFamily: "monospace" }}>
            LEADERS OVERNIGHT ACTIFS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {directSignals.map(function(s, i) {
              var sc = s.changePct > 0 ? "#00CC66" : "#FF2244";
              var qc = s.quality === "fort" ? "#00FF88" : s.quality === "modéré" ? "#FFD700" : "#FF6D00";
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
                    <div style={{ fontSize: 8, color: "#3D5166" }}>{"r=" + Number(s.corr).toFixed(2)}</div>
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
// LEADERS PANEL
// ─────────────────────────────────────────────────────────────────

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
          {l.region + " · " + l.sector}
        </span>
      </div>
      <span style={{ fontSize: 13, fontWeight: 800, color: color, fontFamily: "monospace" }}>
        {pctFmt(l.changePct)}
      </span>
    </div>
  );
}

function LeadersPanel(props) {
  var leaders = props.leaders || [];
  if (!leaders.length) return null;

  var available = leaders.filter(function(l) { return l.changePct !== null; });
  available.sort(function(a, b) { return b.changePct - a.changePct; });

  var top10    = available.slice(0, 10);
  var bottom10 = available.slice(-10).reverse();

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
      <div style={{
        background: "#060C18", border: "1px solid #00CC6633",
        borderRadius: 12, overflow: "hidden",
      }}>
        <div style={{ padding: "8px 12px", background: "#00CC6611", borderBottom: "1px solid #00CC6622" }}>
          <span style={{ fontSize: 9, fontWeight: 800, color: "#00CC66", letterSpacing: 2, fontFamily: "monospace" }}>
            {"▲ TOP 10 HAUSSIERS"}
          </span>
        </div>
        {top10.map(function(l) { return <LeaderRow key={l.symbol} leader={l} />; })}
      </div>
      <div style={{
        background: "#060C18", border: "1px solid #FF224433",
        borderRadius: 12, overflow: "hidden",
      }}>
        <div style={{ padding: "8px 12px", background: "#FF224411", borderBottom: "1px solid #FF224422" }}>
          <span style={{ fontSize: 9, fontWeight: 800, color: "#FF2244", letterSpacing: 2, fontFamily: "monospace" }}>
            {"▼ TOP 10 BAISSIERS"}
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

  var items = [
    { val: haussiers, label: "HAUSSIER", color: "#00CC66" },
    { val: baissiers, label: "BAISSIER", color: "#FF2244" },
    { val: neutres,   label: "NEUTRE",   color: "#546E7A" },
    { val: forts,     label: "FORTS",    color: "#FFD700" },
  ];

  return (
    <div style={{
      display: "flex", gap: 12, flexWrap: "wrap",
      padding: "12px 16px", background: "#060C18",
      border: "1px solid #111B2D", borderRadius: 10, marginBottom: 14,
    }}>
      {items.map(function(item) {
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
// SUPPLY CHAIN MAP
// Reçoit "zoom" en prop : indispensable pour corriger les mesures
// getBoundingClientRect() des ancres L5/L9/L11, qui sont rendues en
// pixels écran déjà mis à l'échelle par l'ancêtre transform:scale().
// On divise par zoom pour revenir aux coordonnées locales (non
// mises à l'échelle), seules valides comme valeur CSS "top".
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
  var zoom        = props.zoom || 1;

  var layers = couchesData.layers;
  var panels = couchesData.panels;

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
    return (
      <LayerBlock
        layer={layer}
        sections={layer.lists || []}
        scoreMap={scoreMap}
        onSelect={onSelect}
        selectedId={selectedId}
      />
    );
  }

  function renderPanelBlock(panel, panelId, oneColumn) {
    if (!panel) return null;
    var pc = PANEL_COLORS[panelId] || { cc: "#94a3b8", bg: "#08090d" };
    return (
      <LayerBlock
        layer={{ num: panel.badge, name: panel.name, badge: panel.badge, cc: pc.cc, bg: pc.bg }}
        sections={getSections(panel)}
        scoreMap={scoreMap}
        onSelect={onSelect}
        selectedId={selectedId}
        isPanel={true}
        oneColumn={oneColumn}
        panelColor={pc.cc}
        panelBg={pc.bg}
      />
    );
  }

  const [l5Top,  setL5Top]  = useState(0);
  const [l9Top,  setL9Top]  = useState(0);
  const [l11Top, setL11Top] = useState(0);
  const wrapRef = useRef(null);
  const l5Ref   = useRef(null);
  const l9Ref   = useRef(null);
  const l11Ref  = useRef(null);

  useEffect(function() {
    function measure() {
      if (!wrapRef.current) return;
      var z = zoom || 1;
      var wrapRect = wrapRef.current.getBoundingClientRect();
      if (l5Ref.current) {
        var r5 = l5Ref.current.getBoundingClientRect();
        setL5Top((r5.top - wrapRect.top) / z);
      }
      if (l9Ref.current) {
        var r9 = l9Ref.current.getBoundingClientRect();
        setL9Top((r9.top - wrapRect.top) / z);
      }
      if (l11Ref.current) {
        var r11 = l11Ref.current.getBoundingClientRect();
        setL11Top((r11.top - wrapRect.top) / z);
      }
    }
    measure();
    window.addEventListener("resize", measure);
    return function() { window.removeEventListener("resize", measure); };
  }, [layers, couchesData, zoom]);

  return (
    <div style={{ width: "100%" }}>
      {/* MACRO — pleine largeur, grille normale (3/ligne) */}
      {macroPanel && (
        <div style={{ marginBottom: 6 }}>
          <div style={{
            fontSize: 8, letterSpacing: 3, color: "#94a3b8", textAlign: "center",
            fontFamily: "monospace", marginBottom: 4, fontWeight: 700,
          }}>
            MACRO · WATCHLISTS — non relié au tronc
          </div>
          {renderPanelBlock(macroPanel, "macro", false)}
          <Connector text="parallel — non causal" />
        </div>
      )}

      {/* Wrapper relatif — panneaux absolu + tronc décalé */}
      <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>

        {/* POWER — absolu à gauche, aligné sur L5, grille 1/ligne */}
        {powerPanel && l5Top > 0 && (
          <div style={{
            position: "absolute", left: EXTERIOR, top: l5Top,
            width: PANEL_W,
          }}>
            <div style={{
              fontSize: 7, letterSpacing: 2, color: PANEL_COLORS.power.cc,
              fontFamily: "monospace", marginBottom: 3, fontWeight: 700, opacity: 0.8,
            }}>
              {"◄ POWER INFRASTRUCTURE"}
            </div>
            {renderPanelBlock(powerPanel, "power", true)}
          </div>
        )}

        {/* THERMAL — absolu à droite, aligné sur L5, grille 1/ligne */}
        {thermalPanel && l5Top > 0 && (
          <div style={{
            position: "absolute", right: EXTERIOR, top: l5Top,
            width: PANEL_W,
          }}>
            <div style={{
              fontSize: 7, letterSpacing: 2, color: PANEL_COLORS.thermal.cc,
              fontFamily: "monospace", marginBottom: 3, fontWeight: 700, opacity: 0.8,
            }}>
              {"THERMAL ►"}
            </div>
            {renderPanelBlock(thermalPanel, "thermal", true)}
          </div>
        )}

        {/* SECURITY — absolu à droite, aligné sur L9, grille 1/ligne */}
        {securityPanel && l9Top > 0 && (
          <div style={{
            position: "absolute", right: EXTERIOR, top: l9Top,
            width: PANEL_W,
          }}>
            <div style={{
              fontSize: 7, letterSpacing: 2, color: PANEL_COLORS.security.cc,
              fontFamily: "monospace", marginBottom: 3, fontWeight: 700, opacity: 0.8,
            }}>
              {"SECURITY ►"}
            </div>
            {renderPanelBlock(securityPanel, "security", true)}
          </div>
        )}

        {/* EDGE — absolu à droite, aligné sur L11, grille 1/ligne */}
        {edgePanel && l11Top > 0 && (
          <div style={{
            position: "absolute", right: EXTERIOR, top: l11Top,
            width: PANEL_W,
          }}>
            <div style={{
              fontSize: 7, letterSpacing: 2, color: PANEL_COLORS.edge.cc,
              fontFamily: "monospace", marginBottom: 3, fontWeight: 700, opacity: 0.8,
            }}>
              {"EDGE ►"}
            </div>
            {renderPanelBlock(edgePanel, "edge", true)}
          </div>
        )}

        {/* TRONC CENTRAL — 51% de large, centré (marge = 24.5% de chaque côté) */}
        <div style={{
          width: TRUNK_W,
          marginLeft: TRUNK_ML,
          marginRight: TRUNK_MR,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}>
          {layers.map(function(layer) {
            var isL5  = layer.id === "l5";
            var isL9  = layer.id === "l9";
            var isL11 = layer.id === "l11";
            return (
              <div key={layer.id}>
                {isL5  && <div ref={l5Ref}  style={{ height: 0 }} />}
                {isL9  && <div ref={l9Ref}  style={{ height: 0 }} />}
                {isL11 && <div ref={l11Ref} style={{ height: 0 }} />}
                {renderLayerBlock(layer)}
                {layer.connBelow && <Connector text={layer.connBelow} />}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────────

var ZOOM_BTN_STYLE = {
  background: "transparent", color: "#00B4FF", border: "none",
  cursor: "pointer", fontSize: 14, fontWeight: 800, width: 22, height: 22,
  fontFamily: "inherit", lineHeight: 1,
};

export default function MorningEdgeModule() {
  const [apiData,       setApiData]       = useState(null);
  const [couchesData,   setCouchesData]   = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [lastFetch,     setLastFetch]     = useState(null);
  const [selectedSec,   setSelectedSec]   = useState(null);
  const [selectedClus,  setSelectedClus]  = useState(null);

  // Zoom / vue d'ensemble
  const [zoom,          setZoom]          = useState(1);
  const [autoFit,       setAutoFit]       = useState(true);
  const [fitZoom,       setFitZoom]       = useState(1);
  const [contentHeight, setContentHeight] = useState(0);
  const outerScrollRef = useRef(null);
  const contentRef     = useRef(null);

  useEffect(function() {
    getCouchesData()
      .then(function(d) { setCouchesData(d); })
      .catch(function(e) { console.error("getCouchesData:", e); });
  }, []);

  const fetchApiData = useCallback(function(force) {
    setLoading(true); setError(null);
    var url = "/api/morning-edge";
    var opts = force ? { cache: "no-store" } : {};
    fetch(url, opts)
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

  // Mesure de la largeur disponible (fit) et de la hauteur réelle du contenu
  useEffect(function() {
    function measureFitAndHeight() {
      if (outerScrollRef.current) {
        var w = outerScrollRef.current.clientWidth;
        var f = w / CONTENT_W;
        if (f > ZOOM_MAX) f = ZOOM_MAX;
        if (f < ZOOM_MIN) f = ZOOM_MIN;
        setFitZoom(f);
      }
      if (contentRef.current) {
        setContentHeight(contentRef.current.scrollHeight);
      }
    }
    measureFitAndHeight();
    var t1 = setTimeout(measureFitAndHeight, 300);
    var t2 = setTimeout(measureFitAndHeight, 1000);
    window.addEventListener("resize", measureFitAndHeight);
    return function() {
      window.removeEventListener("resize", measureFitAndHeight);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [couchesData, apiData]);

  // Si autoFit est actif, le zoom suit automatiquement le fit calculé
  useEffect(function() {
    if (autoFit) setZoom(fitZoom);
  }, [fitZoom, autoFit]);

  function handleZoomOut() {
    setAutoFit(false);
    setZoom(function(z) {
      var nz = z - ZOOM_STEP;
      return nz < ZOOM_MIN ? ZOOM_MIN : nz;
    });
  }
  function handleZoomIn() {
    setAutoFit(false);
    setZoom(function(z) {
      var nz = z + ZOOM_STEP;
      return nz > ZOOM_MAX ? ZOOM_MAX : nz;
    });
  }
  function handleFitView() {
    setAutoFit(true);
    setZoom(fitZoom);
  }
  function handleReset100() {
    setAutoFit(false);
    setZoom(1);
  }

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

  var metaLeadersAvail = apiData && apiData.meta ? apiData.meta.leadersAvailable : 0;
  var metaLeadersTotal = apiData && apiData.meta ? apiData.meta.totalLeaders     : 0;
  var lastFetchTime    = lastFetch
    ? lastFetch.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : "";

  var sizerHeight = contentHeight ? Math.round(contentHeight * zoom) : 400;
  var sizerWidth  = Math.round(CONTENT_W * zoom);

  return (
    <div style={{
      background: "#04080F", color: "#B8C5D6",
      fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace",
      padding: "16px 14px", borderRadius: 16,
      border: "1px solid #0D1828",
    }}>
      <style>
        {"@keyframes spin{to{transform:rotate(360deg)}}" +
         "@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}"}
      </style>

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
            {"L1\u2192L12 · Bayesian Scoring · Structure Supabase"}
          </p>
        </div>        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
          {apiData && (
            <div style={{
              fontSize: 9, color: "#546E7A",
              background: "#0B1120", border: "1px solid #111B2D",
              borderRadius: 6, padding: "3px 8px",
            }}>
              <span style={{ color: "#00CC66", animation: "pulse 2s infinite" }}>{"●"}</span>
              {" " + metaLeadersAvail + "/" + metaLeadersTotal + " leaders actifs"}
            </div>
          )}
          <button
            onClick={function() { fetchApiData(true); }}
            disabled={loading}
            style={{
              background: "#0B1120", color: "#00B4FF",
              border: "1px solid #00B4FF33", borderRadius: 6,
              padding: "5px 12px", cursor: "pointer",
              fontSize: 10, fontFamily: "inherit", fontWeight: 700, letterSpacing: 1,
            }}>
            {loading ? "⟳" : "↺"}{" MAJ"}
          </button>
          {lastFetch && (
            <div style={{ fontSize: 8, color: "#2A3A4A" }}>
              {lastFetchTime}
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
          {apiData && apiData.leaders && (
            <LeadersPanel leaders={apiData.leaders} />
          )}

          {allClusters.length > 0 && <SignalSummaryBar clusters={allClusters} />}

          {selectedSec && (
            <DetailPanel
              section={selectedSec}
              cluster={selectedClus}
              scoreMap={scoreMap}
              onClose={function() { setSelectedSec(null); setSelectedClus(null); }}
            />
          )}

          {/* Barre de zoom — reste dans le flux normal, largeur contrainte */}
          {couchesData && (
            <div style={{
              display: "flex", justifyContent: "flex-end", alignItems: "center",
              gap: 8, marginBottom: 8, flexWrap: "wrap",
            }}>
              <button onClick={handleFitView} style={{
                background: autoFit ? "#00B4FF22" : "#0B1120",
                color: "#00B4FF", border: "1px solid #00B4FF33",
                borderRadius: 6, padding: "5px 10px", cursor: "pointer",
                fontSize: 10, fontFamily: "inherit", fontWeight: 700,
              }}>{"⊡ Vue d'ensemble"}</button>

              <div style={{
                display: "flex", alignItems: "center", gap: 2,
                background: "#0B1120", border: "1px solid #111B2D",
                borderRadius: 6, padding: "1px 4px",
              }}>
                <button onClick={handleZoomOut} style={ZOOM_BTN_STYLE}>{"−"}</button>
                <span style={{ fontSize: 10, color: "#78909C", minWidth: 36, textAlign: "center" }}>
                  {Math.round(zoom * 100) + "%"}
                </span>
                <button onClick={handleZoomIn} style={ZOOM_BTN_STYLE}>{"+"}</button>
              </div>

              <button onClick={handleReset100} style={{
                background: "#0B1120", color: "#78909C", border: "1px solid #111B2D",
                borderRadius: 6, padding: "5px 10px", cursor: "pointer",
                fontSize: 10, fontFamily: "inherit", fontWeight: 700,
              }}>100%</button>
            </div>
          )}

          {/* Cluster Map — full-bleed viewport, zoom + scroll libre
              Technique full-bleed : position relative + left/right 50% + margin -50vw
              casse la contrainte de largeur du conteneur parent (page.js) quel
              que soit son niveau d'imbrication, car 100vw est relatif au viewport
              et pas au parent. */}
          {couchesData ? (
            <div
              ref={outerScrollRef}
              style={{
                position: "relative",
                left: "50%",
                right: "50%",
                marginLeft: "-50vw",
                marginRight: "-50vw",
                width: "100vw",
                overflow: "auto",
                WebkitOverflowScrolling: "touch",
                background: "#04080F",
                boxSizing: "border-box",
                padding: "0 14px 14px",
              }}
            >
              <div style={{
                width: sizerWidth + "px",
                height: sizerHeight + "px",
                position: "relative",
              }}>
                <div ref={contentRef} style={{
                  width: CONTENT_W + "px",
                  transform: "scale(" + zoom + ")",
                  transformOrigin: "top left",
                  position: "absolute",
                  top: 0,
                  left: 0,
                }}>
                  <SupplyChainMap
                    couchesData={couchesData}
                    scoreMap={scoreMap}
                    onSelect={handleSelect}
                    selectedId={selectedSec ? selectedSec.id : null}
                    zoom={zoom}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 11, color: "#3D5166", textAlign: "center", padding: "20px 0" }}>
              {"⏳ Chargement structure L1-L12…"}
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
