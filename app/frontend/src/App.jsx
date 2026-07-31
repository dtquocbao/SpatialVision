import { useState, useEffect, useRef } from "react"

const API = import.meta.env.VITE_API_URL || "http://localhost:8000"

// ── Color maps ─────────────────────────────────────────────────────────────
const NICHE_COLORS = {
  tumor_core:              "#FF69B4",
  tumor_margin_interface:  "#9ACD32",
  active_invasive_margin:  "#FFA500",
  stromal_invasive_margin: "#8B4513",
  CAF_rich_stroma:         "#4169E1",
  immune_rich_stroma:      "#DC143C",
  immune_aggregate_TLS:    "#228B22",
  normal_mucosa:           "#9370DB",
}

const NICHE_LABELS = {
  tumor_core:              "Tumor Core",
  tumor_margin_interface:  "Tumor-Margin Interface",
  active_invasive_margin:  "Active Invasive Margin",
  stromal_invasive_margin: "Stromal Invasive Margin",
  CAF_rich_stroma:         "CAF-rich Stroma",
  immune_rich_stroma:      "Immune-rich Stroma",
  immune_aggregate_TLS:    "Immune Aggregate / TLS",
  normal_mucosa:           "Normal Mucosa",
}

const CMS_COLORS = {
  CMS1: "#228B22",
  CMS2: "#4169E1",
  CMS3: "#FFA500",
  CMS4: "#DC143C",
}

// ── Utilities ──────────────────────────────────────────────────────────────
function useApi(url) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  useEffect(() => {
    if (!url) return
    setLoading(true)
    fetch(`${API}${url}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [url])
  return { data, loading, error }
}

// ── Canvas spatial plot ────────────────────────────────────────────────────
function SpatialCanvas({ spots, colorBy, width = 420, height = 400 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!spots || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    ctx.clearRect(0, 0, width, height)

    const xs = spots.map(s => s.x)
    const ys = spots.map(s => s.y)
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    const pad = 20
    const scaleX = (width - pad * 2) / (maxX - minX || 1)
    const scaleY = (height - pad * 2) / (maxY - minY || 1)
    const scale = Math.min(scaleX, scaleY)

    // Prob color scale: blue → white → red
    const probColor = (p) => {
      if (p < 0) return "#888888"
      const r = Math.round(p * 220)
      const b = Math.round((1 - p) * 220)
      return `rgb(${r},60,${b})`
    }

    const spotR = Math.max(1.5, Math.min(3, 200 / Math.sqrt(spots.length)))

    for (const s of spots) {
      const px = (s.x - minX) * scale + pad
      const py = height - ((s.y - minY) * scale + pad)
      let color = "#CCCCCC"
      if (colorBy === "niche") {
        color = NICHE_COLORS[s.niche] || "#CCCCCC"
      } else if (colorBy === "prob") {
        color = probColor(s.infiltrated_prob ?? -1)
      } else if (colorBy === "cms") {
        const cms = s.cms || "unknown"
        color = CMS_COLORS[cms] || "#CCCCCC"
      }
      ctx.beginPath()
      ctx.arc(px, py, spotR, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
    }
  }, [spots, colorBy, width, height])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ borderRadius: 8, background: "#0f1117" }}
    />
  )
}

// ── SHAP Bar Chart ─────────────────────────────────────────────────────────
function ShapBarChart({ genes }) {
  if (!genes || genes.length === 0) return <div className="empty">No SHAP data</div>

  const top20 = genes.slice(0, 20)
  const maxVal = top20[0]?.mean_abs_shap || 1

  return (
    <div style={{ overflowY: "auto", maxHeight: 480 }}>
      {top20.map((g, i) => (
        <div key={g.gene} style={{
          display: "flex", alignItems: "center",
          marginBottom: 6, gap: 8,
        }}>
          <div style={{
            width: 28, textAlign: "right",
            fontSize: 11, color: "#888", flexShrink: 0,
          }}>
            {g.rank}
          </div>
          <div style={{
            width: 90, fontSize: 12, fontWeight: g.is_priority ? 700 : 400,
            color: g.is_priority ? "#FFA500" : "#E0E0E0",
            flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden",
            textOverflow: "ellipsis",
          }}>
            {g.gene}
          </div>
          <div style={{ flex: 1, height: 18, background: "#1e2130", borderRadius: 3, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${(g.mean_abs_shap / maxVal) * 100}%`,
              background: g.is_priority
                ? "linear-gradient(90deg, #FFA500, #FF6B00)"
                : "linear-gradient(90deg, #2E86AB, #1B5E78)",
              borderRadius: 3,
              transition: "width 0.3s",
            }} />
          </div>
          <div style={{ width: 56, fontSize: 11, color: "#888", textAlign: "right", flexShrink: 0 }}>
            {g.mean_abs_shap.toFixed(4)}
          </div>
        </div>
      ))}
      <div style={{ marginTop: 12, fontSize: 11, color: "#888" }}>
        <span style={{ color: "#FFA500", fontWeight: 700 }}>■</span> LIANA priority gene&nbsp;&nbsp;
        <span style={{ color: "#2E86AB" }}>■</span> Unbiased discovery
      </div>
    </div>
  )
}

// ── LIANA Heatmap ──────────────────────────────────────────────────────────
function LianaHeatmap({ data }) {
  if (!data) return <div className="empty">No LIANA data</div>
  const { niches, interactions } = data
  const allScores = interactions.flatMap(i => i.scores)
  const maxScore = Math.max(...allScores)
  const minScore = Math.min(...allScores)

  const heatColor = (val) => {
    const t = (val - minScore) / (maxScore - minScore + 0.001)
    const r = Math.round(255 * t)
    const g = Math.round(50 * (1 - t))
    const b = Math.round(30 * (1 - t))
    return `rgb(${r},${g},${b})`
  }

  const shortNiche = n => n.replace("_invasive_margin", "_margin")
                           .replace("stromal_", "str_")
                           .replace("immune_", "imm_")
                           .replace("tumor_", "tm_")
                           .replace("normal_mucosa", "normal")
                           .replace("CAF_rich_stroma", "CAF_str")

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%" }}>
        <thead>
          <tr>
            <th style={{ padding: "4px 6px", textAlign: "left", color: "#888", minWidth: 120 }}>
              Interaction
            </th>
            {niches.map(n => (
              <th key={n} style={{
                padding: "4px 3px", color: "#888",
                writingMode: "vertical-rl", transform: "rotate(180deg)",
                height: 70, textAlign: "left", fontSize: 10,
              }}>
                {shortNiche(n)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {interactions.map(interaction => (
            <tr key={interaction.name}>
              <td style={{
                padding: "3px 6px", color: "#E0E0E0",
                fontFamily: "monospace", fontSize: 11,
              }}>
                {interaction.name}
              </td>
              {interaction.scores.map((score, j) => (
                <td key={j} style={{
                  background: heatColor(score),
                  padding: "3px",
                  textAlign: "center",
                  fontSize: 10,
                  color: score > (maxScore * 0.6) ? "#000" : "#fff",
                }}>
                  {score.toFixed(2)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 8, fontSize: 10, color: "#888" }}>
        Values = mean local cosine similarity (LIANA+ bivariate, spatially-weighted).
        Red = high interaction activity.
      </div>
    </div>
  )
}

// ── Niche Legend ───────────────────────────────────────────────────────────
function NicheLegend() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
      {Object.entries(NICHE_LABELS).map(([key, label]) => (
        <div key={key} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
          <div style={{
            width: 10, height: 10, borderRadius: 2,
            background: NICHE_COLORS[key], flexShrink: 0,
          }} />
          <span style={{ color: "#CCC" }}>{label}</span>
        </div>
      ))}
    </div>
  )
}

// ── Section card ───────────────────────────────────────────────────────────
function Card({ title, children, style = {} }) {
  return (
    <div style={{
      background: "#1a1d2e",
      border: "1px solid #2a2d40",
      borderRadius: 10,
      padding: "16px 20px",
      ...style
    }}>
      {title && (
        <div style={{
          fontSize: 13, fontWeight: 700, color: "#7B9FD4",
          marginBottom: 12, letterSpacing: 0.5, textTransform: "uppercase",
        }}>
          {title}
        </div>
      )}
      {children}
    </div>
  )
}

// ── Badge ──────────────────────────────────────────────────────────────────
function Badge({ label, value, color = "#2E86AB" }) {
  return (
    <div style={{
      display: "inline-flex", flexDirection: "column",
      alignItems: "center", padding: "8px 16px",
      background: "#0f1117", borderRadius: 8,
      border: `1px solid ${color}33`,
    }}>
      <span style={{ fontSize: 20, fontWeight: 800, color }}>{value}</span>
      <span style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{label}</span>
    </div>
  )
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab]       = useState("spatial")
  const [selectedSample, setSelectedSample] = useState(null)
  const [colorBy, setColorBy]           = useState("niche")
  const [spatialData, setSpatialData]   = useState(null)
  const [spatialLoading, setSpatialLoading] = useState(false)

  const { data: overview }  = useApi("/api/patients")
  const { data: shapData }  = useApi("/api/shap")
  const { data: lianaData } = useApi("/api/liana")
  const { data: summary }   = useApi("/api/summary")

  // Load spatial data when sample changes
  useEffect(() => {
    if (!selectedSample) return
    setSpatialLoading(true)
    fetch(`${API}/api/spatial/${selectedSample}`)
      .then(r => r.json())
      .then(d => { setSpatialData(d); setSpatialLoading(false) })
      .catch(() => setSpatialLoading(false))
  }, [selectedSample])

  // Auto-select first sample
  useEffect(() => {
    if (overview?.samples?.length && !selectedSample) {
      setSelectedSample(overview.samples[0])
    }
  }, [overview])

  const tabs = [
    { id: "spatial", label: "🗺 Spatial Explorer" },
    { id: "shap",    label: "🤖 SHAP Features" },
    { id: "liana",   label: "🔗 Cell-Cell Communication" },
    { id: "about",   label: "📋 About" },
  ]

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0f1117",
      color: "#E0E0E0",
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
    }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{
        background: "linear-gradient(135deg, #1B5E78 0%, #1a1d2e 100%)",
        borderBottom: "1px solid #2a2d40",
        padding: "16px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#7BD4F4", letterSpacing: -0.5 }}>
            SpatialVision
          </div>
          <div style={{ fontSize: 12, color: "#9AA8B8", marginTop: 2 }}>
            Spatial Transcriptomics of CRC Immune Exclusion
          </div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Badge label="AUC" value={overview?.model_metrics?.AUC || "—"} color="#2E86AB" />
          <Badge label="Patients" value="7" color="#E87722" />
          <Badge label="Spots" value="19,432" color="#228B22" />
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", gap: 0,
        borderBottom: "1px solid #2a2d40",
        background: "#13151f",
        padding: "0 32px",
      }}>
        {tabs.map(t => (
          <button key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              background: "none", border: "none",
              padding: "12px 20px", cursor: "pointer",
              fontSize: 13, fontWeight: activeTab === t.id ? 700 : 400,
              color: activeTab === t.id ? "#7BD4F4" : "#888",
              borderBottom: activeTab === t.id ? "2px solid #7BD4F4" : "2px solid transparent",
              transition: "all 0.2s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div style={{ padding: "24px 32px", maxWidth: 1400, margin: "0 auto" }}>

        {/* ── Spatial Explorer ─────────────────────────────────────────── */}
        {activeTab === "spatial" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

            {/* Controls */}
            <Card title="Sample Selection" style={{ gridColumn: "1 / -1" }}>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <div>
                  <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>
                    Sample
                  </label>
                  <select
                    value={selectedSample || ""}
                    onChange={e => setSelectedSample(e.target.value)}
                    style={{
                      background: "#0f1117", border: "1px solid #2a2d40",
                      color: "#E0E0E0", padding: "6px 12px", borderRadius: 6,
                      fontSize: 13, cursor: "pointer",
                    }}
                  >
                    {(overview?.samples || []).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>
                    Color by
                  </label>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[
                      { id: "niche", label: "Niche" },
                      { id: "prob",  label: "Infiltration Probability" },
                      { id: "cms",   label: "CMS Subtype" },
                    ].map(opt => (
                      <button key={opt.id}
                        onClick={() => setColorBy(opt.id)}
                        style={{
                          background: colorBy === opt.id ? "#1B5E78" : "#1a1d2e",
                          border: `1px solid ${colorBy === opt.id ? "#7BD4F4" : "#2a2d40"}`,
                          color: colorBy === opt.id ? "#7BD4F4" : "#888",
                          padding: "6px 12px", borderRadius: 6,
                          cursor: "pointer", fontSize: 12,
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {spatialData && (
                  <div style={{ marginLeft: "auto", fontSize: 12, color: "#888" }}>
                    Patient {spatialData.patient_id} &nbsp;·&nbsp;
                    {spatialData.cms} &nbsp;·&nbsp;
                    {spatialData.n_spots.toLocaleString()} spots
                  </div>
                )}
              </div>
            </Card>

            {/* Spatial Map */}
            <Card title="Spatial Map">
              {spatialLoading ? (
                <div style={{ height: 400, display: "flex", alignItems: "center",
                              justifyContent: "center", color: "#888" }}>
                  Loading spots...
                </div>
              ) : spatialData ? (
                <>
                  <SpatialCanvas spots={spatialData.spots} colorBy={colorBy} />
                  {colorBy === "niche" && <NicheLegend />}
                  {colorBy === "prob" && (
                    <div style={{ marginTop: 8, fontSize: 11, color: "#888" }}>
                      <span style={{ color: "#DC143C" }}>■</span> Infiltrated &nbsp;
                      <span style={{ color: "#888" }}>■</span> No prediction &nbsp;
                      <span style={{ color: "#4169E1" }}>■</span> Excluded
                    </div>
                  )}
                </>
              ) : (
                <div style={{ height: 400, display: "flex", alignItems: "center",
                              justifyContent: "center", color: "#888" }}>
                  Select a sample to view spatial map
                </div>
              )}
            </Card>

            {/* Niche Distribution */}
            <Card title="Niche Distribution (All Samples)">
              {overview?.niche_distribution ? (
                <div>
                  {Object.entries(overview.niche_distribution)
                    .sort((a, b) => b[1] - a[1])
                    .map(([niche, count]) => {
                      const total = Object.values(overview.niche_distribution)
                                          .reduce((a, b) => a + b, 0)
                      const pct = ((count / total) * 100).toFixed(1)
                      return (
                        <div key={niche} style={{
                          display: "flex", alignItems: "center",
                          marginBottom: 8, gap: 8,
                        }}>
                          <div style={{
                            width: 10, height: 10, borderRadius: 2,
                            background: NICHE_COLORS[niche], flexShrink: 0,
                          }} />
                          <div style={{ width: 160, fontSize: 12, color: "#CCC", flexShrink: 0 }}>
                            {NICHE_LABELS[niche] || niche}
                          </div>
                          <div style={{ flex: 1, height: 16, background: "#0f1117", borderRadius: 3 }}>
                            <div style={{
                              height: "100%",
                              width: `${pct}%`,
                              background: NICHE_COLORS[niche],
                              borderRadius: 3,
                              opacity: 0.8,
                            }} />
                          </div>
                          <div style={{ width: 60, fontSize: 11, color: "#888", textAlign: "right" }}>
                            {count.toLocaleString()} ({pct}%)
                          </div>
                        </div>
                      )
                    })}
                </div>
              ) : (
                <div style={{ color: "#888" }}>Loading...</div>
              )}
            </Card>
          </div>
        )}

        {/* ── SHAP Features ─────────────────────────────────────────────── */}
        {activeTab === "shap" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

            <Card title="Top 20 SHAP Features" style={{ gridColumn: 1 }}>
              <div style={{ marginBottom: 12, fontSize: 12, color: "#888" }}>
                Mean |SHAP value| from XGBoost classifier predicting immune phenotype
                (excluded vs infiltrated). Orange bars = LIANA priority genes.
              </div>
              <ShapBarChart genes={shapData?.top50} />
            </Card>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <Card title="Model Performance">
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <Badge label="Test AUC" value={shapData?.model_metrics?.AUC || "—"} color="#2E86AB" />
                  <Badge label="F1 (weighted)" value={shapData?.model_metrics?.F1_weighted || "—"} color="#E87722" />
                  <Badge label="Test patients" value="S4 + S7" color="#228B22" />
                </div>
                <div style={{ marginTop: 12, fontSize: 12, color: "#888", lineHeight: 1.6 }}>
                  XGBoost trained on 3,014 unbiased HVGs with donor-aware split.
                  AUC 0.925 confirms the model learned biologically meaningful signal.
                  Severe class imbalance (156:1) reflects the MSS CRC biology,
                  6 of 7 patients are excluded phenotype.
                </div>
              </Card>

              <Card title="SHAP Priority Gene Recovery">
                <div style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>
                  LIANA priority genes (from SV05) recovered in SHAP top 50 without pre-selection:
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {shapData?.priority_genes?.map(gene => {
                    const found = shapData?.top50?.find(g => g.gene === gene)
                    return (
                      <div key={gene} style={{
                        padding: "4px 10px", borderRadius: 4,
                        background: found ? "#228B2233" : "#DC143C22",
                        border: `1px solid ${found ? "#228B22" : "#DC143C"}`,
                        fontSize: 12,
                        color: found ? "#228B22" : "#DC143C",
                      }}>
                        {found ? "✓" : "✗"} {gene}
                        {found ? ` (rank ${found.rank})` : ""}
                      </div>
                    )
                  })}
                </div>
                <div style={{ marginTop: 12, fontSize: 12, color: "#888", lineHeight: 1.6 }}>
                  <strong style={{ color: "#E0E0E0" }}>Note:</strong> COL1A2 (rank 1) validates the ECM
                  physical barrier independently. It was not in the LIANA priority list but directly
                  confirms collagen deposition as the dominant exclusion discriminator.
                </div>
              </Card>

              <Card title="Key Finding">
                <div style={{ fontSize: 13, lineHeight: 1.7, color: "#CCC" }}>
                  SHAP and LIANA independently converge on ECM/collagen genes
                  (COL1A2, COL3A1, COL1A1, FN1) as central to immune exclusion,
                  two methodologically independent frameworks reaching the same conclusion
                  without pre-selection.
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ── LIANA ─────────────────────────────────────────────────────── */}
        {activeTab === "liana" && (
          <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 20 }}>

            <Card title="Ligand-Receptor Interaction Scores per Niche">
              <div style={{ marginBottom: 12, fontSize: 12, color: "#888" }}>
                Mean local cosine similarity (LIANA+ bivariate, spatially-weighted Gaussian kernel,
                bandwidth=200px). Higher scores indicate stronger spatial co-expression of
                ligand and receptor in that niche.
              </div>
              <LianaHeatmap data={lianaData?.niche_heatmap} />
            </Card>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <Card title="Four-Layer Exclusion Model">
                {[
                  {
                    layer: "Layer 1",
                    niche: "CAF_rich_stroma",
                    color: "#4169E1",
                    signals: "TGFB1→TGFBR1, POSTN→ITGB3",
                    desc: "TGF-β and matrix remodeling origin",
                  },
                  {
                    layer: "Layer 2",
                    niche: "stromal_invasive_margin",
                    color: "#8B4513",
                    signals: "COL1A1→ITGB1, FN1→ITGB1",
                    desc: "Physical collagen barrier construction",
                  },
                  {
                    layer: "Layer 3",
                    niche: "active_invasive_margin",
                    color: "#FFA500",
                    signals: "CXCL10→CXCR3, CCL5→CCR5",
                    desc: "T cell chemokine recruitment",
                  },
                  {
                    layer: "Layer 4",
                    niche: "immune_rich_stroma",
                    color: "#DC143C",
                    signals: "CXCL12→CXCR4",
                    desc: "CXCL12-mediated T cell trapping",
                  },
                ].map(({ layer, niche, color, signals, desc }) => (
                  <div key={layer} style={{
                    marginBottom: 12, padding: "10px 12px",
                    background: "#0f1117", borderRadius: 8,
                    borderLeft: `3px solid ${color}`,
                  }}>
                    <div style={{ fontSize: 11, color, fontWeight: 700, marginBottom: 2 }}>
                      {layer} — {NICHE_LABELS[niche] || niche}
                    </div>
                    <div style={{ fontSize: 12, color: "#CCC", marginBottom: 3, fontFamily: "monospace" }}>
                      {signals}
                    </div>
                    <div style={{ fontSize: 11, color: "#888" }}>{desc}</div>
                  </div>
                ))}
              </Card>

              <Card title="Method">
                <div style={{ fontSize: 12, color: "#888", lineHeight: 1.7 }}>
                  <strong style={{ color: "#CCC" }}>LIANA+</strong> (Dimitrov et al. 2024,
                  Nature Cell Biology) - spatially-weighted cosine similarity with
                  Gaussian radial kernel (bandwidth=200px, cutoff=0.1).
                  19,432 spots, 100 permutations for p-values, consensus resource.
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ── About ─────────────────────────────────────────────────────── */}
        {activeTab === "about" && summary && (
          <div style={{ maxWidth: 900 }}>
            <Card title="SpatialVision — Project Overview">
              <div style={{ fontSize: 14, lineHeight: 1.8, color: "#CCC", marginBottom: 20 }}>
                {summary.subtitle}. Dataset: {summary.dataset}.
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
                {summary.key_findings.map(f => (
                  <div key={f.title} style={{
                    padding: 16, background: "#0f1117",
                    borderRadius: 8, border: "1px solid #2a2d40",
                  }}>
                    <div style={{ fontSize: 22, marginBottom: 8 }}>{f.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#7BD4F4", marginBottom: 8 }}>
                      {f.title}
                    </div>
                    <div style={{ fontSize: 12, color: "#888", lineHeight: 1.6 }}>{f.text}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#7B9FD4", marginBottom: 12 }}>
                  NOTEBOOK PIPELINE
                </div>
                <div style={{ display: "flex", gap: 0, flexWrap: "wrap" }}>
                  {summary.notebooks.map((nb, i) => (
                    <div key={nb.id} style={{ display: "flex", alignItems: "center" }}>
                      <div style={{
                        padding: "6px 14px", background: "#1a1d2e",
                        border: "1px solid #2a2d40", borderRadius: 6,
                        fontSize: 12,
                      }}>
                        <span style={{ color: "#7BD4F4", fontWeight: 700 }}>{nb.id}</span>
                        <span style={{ color: "#888", marginLeft: 6 }}>{nb.title}</span>
                      </div>
                      {i < summary.notebooks.length - 1 && (
                        <div style={{ color: "#2a2d40", margin: "0 4px", fontSize: 18 }}>→</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ fontSize: 12, color: "#888", lineHeight: 1.7 }}>
                <strong style={{ color: "#CCC" }}>Dataset:</strong> {summary.dataset}<br />
                <strong style={{ color: "#CCC" }}>Reference:</strong> {summary.reference}<br />
                <strong style={{ color: "#CCC" }}>Methods:</strong> scanpy, squidpy, Cell2Location,
                LIANA+, decoupleR, XGBoost, SHAP<br />
                <strong style={{ color: "#CCC" }}>Author:</strong> Bao Dang —
                Computational Biology Portfolio, Texas A&M / BCM GSBS 2027
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
