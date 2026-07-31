---
title: SpatialVision
emoji: 🔬
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
pinned: false
short_description: CRC spatial transcriptomics — FastAPI + React app
tags:
  - spatial-transcriptomics
  - single-cell
  - oncology
  - fastapi
  - docker
---

# SpatialVision

Computational oncology portfolio project for spatial transcriptomics analysis of colorectal cancer using the scverse ecosystem.

**Author:** Bao Dang

## Overview

SpatialVision analyzes 10x Visium spatial transcriptomics data to map colorectal cancer tissue architecture and identify spatially coherent immune-exclusion programs. The pipeline uses `SpatialData` as the unified data container, with `scanpy` / `squidpy` for spatial analysis, `cell2location` for deconvolution, `liana` for ligand–receptor inference, `gseapy` / `decoupler` for pathway enrichment, and `xgboost` + `shap` for interpretable phenotype prediction.

**Current status:** SV01–SV06 complete. SV07 (interactive research platform) is in progress under `app/`.

## Dataset

**Valdeolivas et al. 2024** — *npj Precision Oncology*

- **Zenodo:** [doi:10.5281/zenodo.7760264](https://doi.org/10.5281/zenodo.7760264)
- **Samples:** 14 Visium sections (7 patients × 2 technical replicates)
- **Annotations:** Pathologist spot-level compartment labels (tumor, stroma, immune, etc.)
- **Metadata:** Patient ID, anatomical location, CMS subtype, immune phenotype
- **Deconvolution reference:** Lee et al. 2020 CRC scRNA-seq (GSE132465)

## Repository Structure

```
SpatialVision/
├── notebooks/
│   ├── SV01_data_loading_qc.ipynb
│   ├── SV02_spatial_architecture_niche_identification.ipynb
│   ├── SV03_spatially_variable_genes.ipynb
│   ├── SV04_cell_type_deconvolution.ipynb
│   ├── SV05_cell_cell_communication.ipynb
│   ├── SV06_interpretable_ml.ipynb
│   └── SV07_README.md                 # SV07 local / deploy instructions
├── app/
│   ├── SV07_backend_main.py           # FastAPI backend
│   └── SV07_frontend_App.jsx          # React app root
├── data/
│   ├── raw/                           # Zenodo + GEO downloads (gitignored)
│   └── processed/                     # Large .h5ad gitignored; small CSVs tracked
├── models/
│   ├── cell2location/                 # Trained Cell2Location weights
│   └── SV06_xgboost_model.pkl         # Trained XGBoost classifier
├── reports/figures/SV01–SV06/
├── requirements.txt
└── .gitignore
```

> **Note:** Raw Visium / scRNA-seq data and large AnnData files are **not stored in git**.
> Run notebook download/setup cells to recreate them locally.

## Setup

Requires **Python 3.12**.

```bash
conda create -n spatialvision python=3.12
conda activate spatialvision
pip install -r requirements.txt
```

### Key dependencies

| Package | Version | Role |
|---------|---------|------|
| spatialdata | 0.8.0 | Unified spatial omics container |
| spatialdata-io | 0.7.1 | Visium data loading |
| scanpy | 1.12.2 | QC, normalization, PCA, UMAP, clustering |
| squidpy | 1.8.3 | Spatial neighborhood graphs, Moran's I |
| scikit-misc | 0.5.2 | Seurat v3 HVG selection |
| leidenalg | 0.12.0 | Leiden clustering |
| gseapy | 1.3.0 | Hallmark pathway enrichment |
| decoupler | 2.1.6 | PROGENy pathway activity scoring |
| cell2location | 1.3.1 | Bayesian spot deconvolution |
| torch | 2.6.0 | Cell2Location backend |
| liana | 1.8.1 | Spatially-informed ligand–receptor analysis |
| pandas | 2.3.3 | Pinned `<3` for LIANA compatibility |
| xgboost | 2.1.6 | Immune phenotype classifier |
| shap | 0.46.1 | TreeSHAP feature attribution |

```bash
cd notebooks
jupyter lab
```

Select the `spatialvision` conda environment as the kernel.

## Pipeline

| Notebook | Status | Focus |
|----------|--------|-------|
| **SV01** Data Loading & QC | Done | Load Visium, QC, normalize, HVG, UMAP, Leiden |
| **SV02** Spatial Architecture & Niches | Done | Neighborhood enrichment, Moran's I, 8 spatial niches |
| **SV03** Spatially Variable Genes | Done | Niche DE, Hallmark GSEA, PROGENy, exclusion signature |
| **SV04** Cell Type Deconvolution | Done | Cell2Location with Lee et al. 2020 CRC reference |
| **SV05** Cell–Cell Communication | Done | LIANA+ bivariate LR analysis + NMF programs |
| **SV06** Interpretable ML | Done | XGBoost + SHAP validation of exclusion programs |
| **SV07** Interactive Platform | In progress | FastAPI + React in `app/`; Docker Space + GitHub Actions (`notebooks/SV07_README.md`) |

---

### SV01 — Data Loading & Quality Control

**File:** `notebooks/SV01_data_loading_qc.ipynb`

Validates technical quality and confirms biologically coherent spatial signal before niche analysis.

**Outputs:** `SV01_adata_filtered.h5ad`, `SV01_qc_metrics.csv`, `reports/figures/SV01/*.png`

**Key findings:**
- QC within expected Visium ranges (mean UMI ~11,000; mitochondrial fraction ~3.1%)
- UMAP driven by tissue biology, not patient identity
- Pathologist compartments align with transcriptomic clusters

---

### SV02 — Spatial Architecture & Niche Identification

**File:** `notebooks/SV02_spatial_architecture_niche_identification.ipynb`

Maps tumor–immune spatial organization and defines niches from neighborhood composition.

**Eight niches:** `tumor_core`, `tumor_margin_interface`, `active_invasive_margin`, `stromal_invasive_margin`, `CAF_rich_stroma`, `immune_rich_stroma`, `immune_aggregate_TLS`, `normal_mucosa`

**Outputs:** `SV02_adata_niches.h5ad`, `reports/figures/SV02/*.png`

**Key findings:**
- Tumor ↔ immune_aggregate strongly depleted (z ≈ −21) — quantitative immune exclusion
- Three-layer architecture: tumor core → invasive margin barrier → stromal/immune periphery
- EPCAM highly spatially organized; PDCD1LG2 not significant (favors CAF/TGF-β over PD-L1)

---

### SV03 — Spatially Variable Genes & Pathway Enrichment

**File:** `notebooks/SV03_spatially_variable_genes.ipynb`

Identifies molecular programs at exclusion boundaries using DE, GSEA, and PROGENy.

**Outputs:** `SV03_adata_svgs.h5ad`, `SV03_boundary_exclusion_signature.csv` (156 genes), `reports/figures/SV03/*.png`

**Key findings:**
- IDO1 is the top globally spatially variable gene (chemokine–IDO1 metabolic trap)
- Boundary niches are an **active immune conflict zone** (IFN response, antigen presentation, IDO1)
- PROGENy: TGF-β highest in `CAF_rich_stroma`, lowest in `tumor_core` (stroma-derived exclusion)

---

### SV04 — Cell Type Deconvolution (Cell2Location)

**File:** `notebooks/SV04_cell_type_deconvolution.ipynb`

Estimates per-spot cell-type fractions using a CRC scRNA-seq reference (Lee et al. 2020, GSE132465).

**Outputs:** `SV04_adata_deconvolved.h5ad`, `SV04_cell_type_signatures.csv`, `models/cell2location/*`, `reports/figures/SV04/*.png`

**Key findings:**
- Niche–cell-type concordance: CAF_rich_stroma → stroma; immune_aggregate_TLS → T cells; normal_mucosa → epithelium
- Stromal fraction correlates with TGFB1 (r ≈ 0.33) — third independent confirmation of stroma-derived TGF-β
- CAF–T cell co-localization peaks in CAF_rich / immune_rich stroma

---

### SV05 — Cell–Cell Communication (LIANA+)

**File:** `notebooks/SV05_cell_cell_communication.ipynb`

Spatially-informed bivariate ligand–receptor analysis with NMF communication programs.

**Outputs:** `SV05_shap_validation_targets.csv` (68 genes), `reports/figures/SV05/*.png`

**Key findings — four-layer exclusion model:**
1. **CAF_rich_stroma:** TGFB1 / POSTN origin of TGF-β and matrix remodeling
2. **stromal_invasive_margin:** COL1A1 / FN1 physical collagen barrier
3. **active_invasive_margin:** CXCL9/10/11 chemokine recruitment of T cells to the boundary
4. **immune_rich_stroma:** CXCL12→CXCR4 T cell trapping in stroma

---

### SV06 — Interpretable Machine Learning (XGBoost + SHAP)

**File:** `notebooks/SV06_interpretable_ml.ipynb`

Predicts immune phenotype (excluded vs infiltrated) from unbiased HVG features, then uses TreeSHAP to test whether LIANA priority genes are recovered independently.

| Stage | Description |
|-------|-------------|
| Feature matrix | HVG expression (no pre-selected exclusion genes) |
| Classifier | XGBoost with donor-held-out validation |
| Attribution | TreeSHAP exact Shapley values |
| Validation | Rank of SV05 priority genes among top SHAP features |

**Outputs:** `SV06_shap_values_top50.csv`, `SV06_xgboost_model.pkl`, `SV06_adata_ml.h5ad`, `reports/figures/SV06/*.png`

**Key findings:**
- Strong predictive performance: **AUC = 0.925** on held-out patients
- SHAP recovered **3/10** LIANA priority genes in the top 50: **COL1A1, COL3A1, FN1** (ECM barrier)
- Chemokine / TGFB1 priorities ranked lower — ECM physical barrier is the dominant SHAP-validated exclusion program
- Cross-framework agreement: LIANA (SV05) + SHAP (SV06) both highlight ECM components as central to exclusion in MSS CRC
- Top global SHAP features also include TLS / B-cell markers (e.g. CXCL13, IGH*), consistent with immune phenotype biology

---

### SV07 — Interactive Research Platform

**Code:** `app/SV07_backend_main.py`, `app/SV07_frontend_App.jsx`  
**Setup guide:** [`notebooks/SV07_README.md`](notebooks/SV07_README.md)

FastAPI serves pre-computed SV01–SV06 results as JSON; React visualizes patients, spatial niches, LIANA programs, and SHAP features.

```bash
cd app
uvicorn SV07_backend_main:app --reload --port 8000
# Frontend: scaffold under app/frontend/ then npm run dev → http://localhost:5173
```

---

## Data Policy

Large downloaded and generated files are excluded via `.gitignore` so the repo stays pushable to GitHub. Local data is recreated by running notebooks in order (SV01 → SV06).

**Tracked / pending small artifacts:**
- `SV01_qc_metrics.csv`
- `SV03_boundary_exclusion_signature.csv`
- `SV04_cell_type_signatures.csv`
- `SV05_shap_validation_targets.csv`
- `SV06_shap_values_top50.csv` *(pending commit)*
- Cell2Location weights under `models/cell2location/`
- `models/SV06_xgboost_model.pkl` *(pending commit)*
