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

function fmt(n, d) {
  var decimals = d !== undefined ? d : 2;
  return n !== null && n !== undefined ? Number(n).toFixed(decimals) : "—";
}

// Rayon d'un cercle proportionnel au sqrt du nombre de tickers
function circleRadius(nbTickers, baseMin, baseMax) {
  var mn = baseMin || 22;
  var mx = baseMax || 52;
  return Math.min(mx, Math.max(mn, mn + Math.sqrt(nbTickers) * 4));
}

// Score agrégé d'une liste de clusters (moyenne des probabilités)
function aggregateScore(clusters) {
  if (!clusters || clusters.length === 0) return { probability: 0.5, direction: "neutre", signalCount: 0 };
  var sum = 0;
  var signals = 0;
  for (var i = 0; i < clusters.length; i++) {
    sum += clusters[i].probability;
    signals += clusters[i].signalCount || 0;
  }
  var prob = sum / clusters.length;
  var dir  = prob >= 0.60 ? "haussier" : prob <= 0.42 ? "baissier" : "neutre";
  return { probability: prob, direction: dir, signalCount: signals };
}

// ─────────────────────────────────────────────────────────────────
// SCORE BADGE (cercle SVG, réutilisé depuis v2)
// ─────────────────────────────────────────────────────────────────

function ScoreBadge(props) {
  var probability = props.probability;
  var direction   = props.direction;
  var size        = props.size || "md";
  var color       = signalColor(direction, probability);
  var pct         = Math.round(probability * 100);
  var isFort      = (direction === "haussier" && probability >= 0.70) ||
                    (direction === "baissier"  && probability <= 0.30);
  var dim    = size === "sm" ? 46 : size === "lg" ? 70 : 56;
  var radius = dim / 2 - 5;
  var circ   = 2 * Math.PI * radius;
  var offset = circ * (1 - probability);
  var fsz    = size === "sm" ? 10 : size === "lg" ? 15 : 12;

  return (
    <div style={{ position: "relative", width: dim, height: dim, flexShrink: 0 }}>
      {isFort && (
        <div style={{
          position: "absolute", top: -6, right: -6, zIndex: 2,
          fontSize: 8, background: color, color: "#000",
          borderRadius: 4, padding: "1px 4px", fontWeight: 900,
        }}>🔥</div>
      )}
      <svg width={dim} height={dim} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={dim/2} cy={dim/2} r={radius} fill="none" stroke="#1C2940" strokeWidth={size === "sm" ? 3 : 4} />
        <circle cx={dim/2} cy={dim/2} r={radius} fill="none" stroke={color}
          strokeWidth={size === "sm" ? 3 : 4}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(.4,0,.2,1)" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: fsz, fontWeight: 800, color: color, lineHeight: 1 }}>{pct}%</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// LEADER PILL
// ─────────────────────────────────────────────────────────────────

function LeaderPill(props) {
  var leader = props.leader;
  var color  = leader.changePct === null ? "#546E7A"
    : leader.changePct > 0.003  ? "#00CC66"
    : leader.changePct < -0.003 ? "#FF2244"
    : "#78909C";
  return (
    <div style={{
      background: "#0B1120", border: "1px solid " + color + "22",
      borderRadius: 8, padding: "8px 12px", flexShrink: 0, minWidth: 100,
    }}>
      <div style={{ fontSize: 7, letterSpacing: 2, color: "#3D5166", fontWeight: 700, marginBottom: 3 }}>
        {leader.region} · {leader.sector}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#B0BEC5", marginBottom: 3 }}>{leader.name}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: color }}>{pctFmt(leader.changePct)}</div>
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
      display: "flex", gap: 8, flexWrap: "wrap", padding: "12px 16px",
      background: "#060C18", border: "1px solid #111B2D",
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
// MINI CIRCLE — sous-couche (section)
// ─────────────────────────────────────────────────────────────────

function MiniCircle(props) {
  var section    = props.section;
  var cluster    = props.cluster;
  var onSelect   = props.onSelect;
  var isSelected = props.isSelected;

  var nb    = section.tickers ? section.tickers.length : 0;
  var r     = circleRadius(nb, 20, 44);
  var dim   = r * 2;
  var prob  = cluster ? cluster.probability : 0.5;
  var dir   = cluster ? cluster.direction   : "neutre";
  var color = signalColor(dir, prob);
  var isFort = (dir === "haussier" && prob >= 0.70) || (dir === "baissier" && prob <= 0.30);
  var isNeutre = dir === "neutre";

  var bgOpacity = isNeutre ? "08" : "18";
  var borderOpacity = isNeutre ? "22" : (isSelected ? "88" : "44");

  return (
    <div
      onClick={function() { onSelect(section, cluster); }}
      title={section.title || section.id}
      style={{
        width: dim, height: dim, borderRadius: "50%",
        background: color + bgOpacity,
        border: "1.5px solid " + color + borderOpacity,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        cursor: "pointer", flexShrink: 0,
        boxShadow: isSelected ? "0 0 10px " + color + "55" : "none",
        transition: "all 0.18s",
        opacity: isNeutre && !isSelected ? 0.5 : 1,
        position: "relative",
      }}
    >
      {isFort && (
        <div style={{
          position: "absolute", top: -4, right: -4,
          fontSize: 7, background: color, color: "#000",
          borderRadius: 3, padding: "0px 2px", fontWeight: 900, zIndex: 2,
        }}>🔥</div>
      )}
      <div style={{ fontSize: 7, fontWeight: 800, color: color, lineHeight: 1, textAlign: "center" }}>
        {Math.round(prob * 100)}%
      </div>
      <div style={{ fontSize: 6, color: color, opacity: 0.7, lineHeight: 1, marginTop: 1 }}>
        {nb}tk
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// BIG CIRCLE — couche principale (layer ou panel)
// contient des MiniCircles
// ─────────────────────────────────────────────────────────────────

function BigCircle(props) {
  var layer      = props.layer;
  var sections   = props.sections;
  var scoreMap   = props.scoreMap;
  var onSelect   = props.onSelect;
  var selectedId = props.selectedId;
  var isPanel    = props.isPanel || false;

  // Score agrégé du layer
  var layerClusters = sections.map(function(s) { return scoreMap[s.id] || null; }).filter(Boolean);
  var agg = aggregateScore(layerClusters);
  var color = signalColor(agg.direction, agg.probability);
  var isNeutre = agg.direction === "neutre";

  var totalTk = sections.reduce(function(acc, s) {
    return acc + (s.tickers ? s.tickers.length : 0);
  }, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      {/* Label au-dessus */}
      <div style={{
        fontSize: isPanel ? 7 : 8, fontWeight: 800, letterSpacing: isPanel ? 0 : 2,
        color: layer.cc || color, textAlign: "center",
        fontFamily: "monospace", maxWidth: 90, lineHeight: 1.2,
      }}>
        {isPanel ? layer.badge : (layer.num + " · " + layer.name)}
      </div>

      {/* Grand cercle */}
      <div style={{
        border: "2px solid " + color + (isNeutre ? "33" : "55"),
        borderRadius: "50%", padding: 8,
        background: color + (isNeutre ? "06" : "10"),
        boxShadow: isNeutre ? "none" : "0 0 18px " + color + "22",
        display: "flex", flexWrap: "wrap",
        alignItems: "center", justifyContent: "center",
        gap: 4,
        minWidth: 80, minHeight: 80,
        maxWidth: 200,
      }}>
        {sections.map(function(sec, idx) {
          var cluster = scoreMap[sec.id] || null;
          return (
            <MiniCircle
              key={sec.id || idx}
              section={sec}
              cluster={cluster}
              onSelect={onSelect}
              isSelected={selectedId === sec.id}
            />
          );
        })}
      </div>

      {/* Score global + nb tickers */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: color }}>
          {agg.direction === "haussier" ? "▲ " : agg.direction === "baissier" ? "▼ " : "◆ "}
          {Math.round(agg.probability * 100)}%
        </div>
        <div style={{ fontSize: 7, color: "#3D5166" }}>{totalTk} tickers</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// CONNECTOR
// ─────────────────────────────────────────────────────────────────

function Connector(props) {
  var text = props.text;
  return (
    <div style={{
      textAlign: "center", fontFamily: "monospace", fontSize: 8,
      color: "#1C2940", padding: "2px 0", letterSpacing: "0.06em", fontStyle: "italic",
    }}>
      ↓  {text}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// DETAIL PANEL — section sélectionnée
// ─────────────────────────────────────────────────────────────────

function DetailPanel(props) {
  var section = props.section;
  var cluster = props.cluster;
  var onClose = props.onClose;

  if (!section) return null;

  var prob  = cluster ? cluster.probability : 0.5;
  var dir   = cluster ? cluster.direction   : "neutre";
  var color = signalColor(dir, prob);

  var directSignals = cluster ? (cluster.signals || []).filter(function(s) { return s.source !== "causal"; }) : [];
  var causalSignals = cluster ? (cluster.signals || []).filter(function(s) { return s.source === "causal"; }) : [];

  return (
    <div style={{
      background: "#060C18", border: "1px solid " + color + "44",
      borderRadius: 16, padding: 18, marginBottom: 16,
      animation: "slideDown 0.22s ease",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <ScoreBadge probability={prob} direction={dir} size="lg" />
          <div>
            <div style={{ fontSize: 8, letterSpacing: 2, color: color, marginBottom: 4, fontWeight: 800 }}>
              {section.id} · {dir.toUpperCase()}
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#E8EEF4" }}>
              {section.title || section.id}
            </div>
            {section.note && (
              <div style={{ fontSize: 9, color: "#3D5166", marginTop: 3, fontStyle: "italic" }}>
                {section.note}
              </div>
            )}
          </div>
        </div>
        <button onClick={onClose} style={{
          background: "transparent", border: "1px solid #1C2940",
          color: "#546E7A", borderRadius: 8, padding: "6px 12px",
          cursor: "pointer", fontSize: 12, fontFamily: "inherit",
        }}>✕</button>
      </div>

      {/* Tickers */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 8, letterSpacing: 2, color: "#3D5166", fontWeight: 700, marginBottom: 6 }}>
          TICKERS À SURVEILLER
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(section.tickers || []).slice(0, 8).map(function(t) {
            return (
              <a key={t}
                href={"https://finance.yahoo.com/quote/" + t}
                target="_blank" rel="noopener noreferrer"
                style={{
                  background: "#0D1321", border: "1px solid " + color + "33",
                  borderRadius: 6, padding: "4px 10px",
                  fontSize: 11, fontWeight: 700, color: color, textDecoration: "none",
                }}
              >{t}</a>
            );
          })}
          {(section.tickers || []).length > 8 && (
            <span style={{ fontSize: 9, color: "#3D5166", alignSelf: "center" }}>
              +{section.tickers.length - 8} autres
            </span>
          )}
        </div>
      </div>

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

      {/* Leaders overnight actifs */}
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
                  display: "grid", gridTemplateColumns: "1fr 55px 55px 55px",
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

      {cluster && cluster.signalCount === 0 && (
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
        ⚠ Pearson lag-1 · 252 sessions · Vérifier : already priced in · volume · Kelly avant toute position.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// CLUSTER MAP — layout 3 colonnes avec panneaux latéraux
// ─────────────────────────────────────────────────────────────────

function ClusterMap(props) {
  var couchesData = props.couchesData;
  var scoreMap    = props.scoreMap;
  var onSelect    = props.onSelect;
  var selectedId  = props.selectedId;

  var layers  = couchesData.layers;
  var panels  = couchesData.panels;

  // Index panels par id et par connectedAfter
  var panelById = {};
  var panelsByLayer = {};
  panels.forEach(function(p) {
    panelById[p.id] = p;
    if (p.connectedAfter) {
      if (!panelsByLayer[p.connectedAfter]) panelsByLayer[p.connectedAfter] = [];
      panelsByLayer[p.connectedAfter].push(p);
    }
  });

  var macroPanel = panelById["macro"];

  // Sections d'un panel (aplatit subs + lists)
  function getSections(panel) {
    var sections = [];
    if (panel.lists) panel.lists.forEach(function(l) { sections.push(l); });
    if (panel.subs) panel.subs.forEach(function(sub) {
      sub.lists.forEach(function(l) { sections.push(l); });
    });
    return sections;
  }

  // Sections d'un layer
  function getLayerSections(layer) {
    return layer.lists || [];
  }

  // id d'une section (= clé dans scoreMap = CLUSTERS[].id)
  function secId(sec) {
    return sec.id || sec.list_title;
  }

  // Wrapper pour scoreMap lookup
  function getScore(sec) {
    return scoreMap[secId(sec)] || null;
  }

  // Couleur d'un panel basée sur son badge
  var PANEL_COLORS = {
    power:    "#f87171",
    thermal:  "#38bdf8",
    security: "#a3e635",
    edge:     "#fb923c",
    macro:    "#94a3b8",
  };

  function panelColor(p) {
    return p.cc || PANEL_COLORS[p.id] || "#546E7A";
  }

  // Rendu d'un BigCircle pour un panel
  function renderPanel(p, side) {
    var sections = getSections(p);
    var scoredSections = sections.map(function(s) { return Object.assign({}, s, { id: secId(s) }); });
    return (
      <div key={p.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ fontSize: 6, letterSpacing: 1, color: panelColor(p), textAlign: "center",
          fontFamily: "monospace", marginBottom: 2, opacity: 0.7 }}>
          {side === "left" ? "◄" : "►"}
        </div>
        <BigCircle
          layer={{ num: p.badge, name: p.name, badge: p.badge, cc: panelColor(p) }}
          sections={scoredSections}
          scoreMap={scoreMap}
          onSelect={onSelect}
          selectedId={selectedId}
          isPanel={true}
        />
      </div>
    );
  }

  // Détermine si un panel va à gauche ou droite
  // Power/Thermal → gauche (comme l'image de référence)
  // Security → droite après L9
  // Edge → droite après L11
  var LEFT_PANELS  = ["power", "thermal"];
  var RIGHT_PANELS = ["security", "edge"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* MACRO — tout en haut, centré (L0) */}
      {macroPanel && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 7, letterSpacing: 3, color: "#94a3b8", textAlign: "center",
            fontFamily: "monospace", marginBottom: 4, fontWeight: 700 }}>
            MACRO · WATCHLISTS — non relié
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            {renderPanel(macroPanel, "center")}
          </div>
          <Connector text="parallel — non causal" />
        </div>
      )}

      {/* L1 → L12 avec panneaux latéraux */}
      {layers.map(function(layer) {
        var layerSections = getLayerSections(layer);
        var panelsHere    = panelsByLayer[layer.id] || [];
        var leftPanels    = panelsHere.filter(function(p) { return LEFT_PANELS.indexOf(p.id) !== -1; });
        var rightPanels   = panelsHere.filter(function(p) { return RIGHT_PANELS.indexOf(p.id) !== -1; });

        return (
          <div key={layer.id}>
            {/* Ligne 3 colonnes : gauche | tronc | droite */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              gap: 8, alignItems: "center",
              minHeight: 120,
            }}>
              {/* Colonne gauche — panneaux Power/Thermal */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                {leftPanels.map(function(p) { return renderPanel(p, "left"); })}
              </div>

              {/* Tronc central — layer */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <BigCircle
                  layer={layer}
                  sections={layerSections}
                  scoreMap={scoreMap}
                  onSelect={onSelect}
                  selectedId={selectedId}
                  isPanel={false}
                />
              </div>

              {/* Colonne droite — panneaux Security/Edge */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
                {rightPanels.map(function(p) { return renderPanel(p, "right"); })}
              </div>
            </div>

            {/* Connecteur vers la couche suivante */}
            {layer.connBelow && <Connector text={layer.connBelow} />}
          </div>
        );
      })}
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

  // Charger la structure L1-L12 depuis Supabase (une seule fois)
  useEffect(function() {
    getCouchesData()
      .then(function(d) { setCouchesData(d); })
      .catch(function(e) { console.error("getCouchesData:", e); });
  }, []);

  const fetchApiData = useCallback(function(force) {
    setLoading(true);
    setError(null);
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

  // Auto-refresh 9h30 ET
  useEffect(function() {
    var interval = setInterval(function() {
      var now    = new Date();
      var etHour = now.getUTCHours() - 4;
      var etMin  = now.getUTCMinutes();
      if (etHour === 9 && etMin === 30) fetchApiData(true);
    }, 60000);
    return function() { clearInterval(interval); };
  }, [fetchApiData]);

  // Construire scoreMap : clusterId → scored cluster
  var scoreMap = {};
  if (apiData && apiData.clusters) {
    apiData.clusters.forEach(function(c) {
      scoreMap[c.clusterId] = c;
    });
  }

  // Tous les clusters pour la summary bar
  var allClusters = apiData ? (apiData.clusters || []) : [];

  function handleSelect(section, cluster) {
    if (selectedSec && selectedSec.id === section.id) {
      setSelectedSec(null);
      setSelectedClus(null);
    } else {
      setSelectedSec(section);
      setSelectedClus(cluster);
    }
  }

  var selectedId = selectedSec ? selectedSec.id : null;

  return (
    <div style={{
      background: "#04080F", color: "#B8C5D6",
      fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace",
      padding: "16px 12px", borderRadius: 16,
      border: "1px solid #0D1828", minHeight: 400,
    }}>
      <style>{
        "@keyframes fadeSlide{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}" +
        "@keyframes slideDown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}" +
        "@keyframes spin{to{transform:rotate(360deg)}}" +
        "@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}"
      }</style>

      {/* HEADER */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid #0D1828",
      }}>
        <div>
          <div style={{ fontSize: 8, letterSpacing: 4, color: "#00B4FF", fontWeight: 800, marginBottom: 3 }}>
            MORNING EDGE
          </div>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: "#E8EEF4", margin: "0 0 2px" }}>
            Cluster Map L1→L12
          </h2>
          <p style={{ fontSize: 8, color: "#3D5166", margin: 0, letterSpacing: 1 }}>
            Structure AI Supply Chain · Bayesian Scoring · Pearson lag-1
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
          {apiData && (
            <div style={{
              fontSize: 8, color: "#546E7A",
              background: "#0B1120", border: "1px solid #111B2D",
              borderRadius: 6, padding: "3px 8px",
            }}>
              <span style={{ color: "#00CC66", animation: "pulse 2s infinite" }}>●</span>
              {" "}{apiData.meta && apiData.meta.leadersAvailable}/{apiData.meta && apiData.meta.totalLeaders} leaders
            </div>
          )}
          <button
            onClick={function() { fetchApiData(true); }}
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
              {allClusters.length || "79"} sections · propagation L12→L1
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
          <button onClick={function() { fetchApiData(true); }} style={{
            background: "transparent", color: "#FF5252",
            border: "1px solid #FF525244", borderRadius: 6,
            padding: "3px 10px", cursor: "pointer", fontSize: 9, fontFamily: "inherit",
          }}>Réessayer</button>
        </div>
      )}

      {/* CONTENT */}
      {!loading && (
        <div>
          {/* Leaders overnight */}
          {apiData && apiData.leaders && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 7, letterSpacing: 2, color: "#3D5166", fontWeight: 700, marginBottom: 7 }}>
                {"MARCHÉS LEADERS — " + new Date(apiData.computedAt).toLocaleString("fr-FR")}
              </div>
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6 }}>
                {apiData.leaders.map(function(l) {
                  return <LeaderPill key={l.symbol} leader={l} />;
                })}
              </div>
            </div>
          )}

          {/* Résumé signaux */}
          {allClusters.length > 0 && <SignalSummaryBar clusters={allClusters} />}

          {/* Panel détail section sélectionnée */}
          {selectedSec && (
            <DetailPanel
              section={selectedSec}
              cluster={selectedClus}
              onClose={function() { setSelectedSec(null); setSelectedClus(null); }}
            />
          )}

          {/* CLUSTER MAP */}
          {couchesData ? (
            <ClusterMap
              couchesData={couchesData}
              scoreMap={scoreMap}
              onSelect={handleSelect}
              selectedId={selectedId}
            />
          ) : (
            <div style={{ fontSize: 10, color: "#3D5166", textAlign: "center", padding: "20px 0" }}>
              ⏳ Chargement de la structure L1-L12…
            </div>
          )}

          {/* Légende */}
          <div style={{
            display: "flex", gap: 10, flexWrap: "wrap",
            marginTop: 16, paddingTop: 12, borderTop: "1px solid #0D1828",
          }}>
            {[
              { color: "#00FF88", label: "Signal fort haussier (>70%)" },
              { color: "#00CC66", label: "Haussier probable" },
              { color: "#FF2244", label: "Baissier" },
              { color: "#3D5166", label: "Neutre" },
              { color: "#00B4FF", label: "Tap cercle = détail" },
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
            ⚠ Pearson lag-1 · 252 sessions · Structure L1-L12 source Supabase.
            Cache serveur 4h. Vérifier always priced in + guidance avant position.
          </div>
        </div>
      )}
    </div>
  );
}
