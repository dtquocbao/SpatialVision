# SpatialVision

Computational oncology portfolio project for spatial transcriptomics analysis of colorectal cancer using the scverse ecosystem.

**Author:** Bao Dang

## Overview

SpatialVision analyzes 10x Visium spatial transcriptomics data to map colorectal cancer tissue architecture and identify spatially coherent immune-exclusion programs. The pipeline uses `SpatialData` as the unified data container, with `scanpy` / `squidpy` for spatial analysis, `cell2location` for deconvolution, `liana` for ligand–receptor inference, and `gseapy` / `decoupler` for pathway enrichment.

**Current status:** SV01–SV05 complete. SV06 (SHAP predictive validation) is next.

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
│   └── SV05_cell_cell_communication.ipynb
├── data/
│   ├── raw/                           # Zenodo + GEO downloads (gitignored)
│   └── processed/                     # Large .h5ad gitignored; small CSVs tracked
├── models/cell2location/              # Trained Cell2Location model weights
├── reports/figures/SV01–SV05/
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
| **SV06** Predictive Modeling | Planned | SHAP validation of exclusion programs |

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

| Stage | Description |
|-------|-------------|
| Reference model | Learn cell-type gene signatures from scRNA-seq |
| Spatial model | Deconvolve Visium spots into abundance estimates |
| Niche concordance | Validate SV02 niches against cell-type fractions |
| CAF–TGF-β check | Correlate stromal fraction with TGFB1 expression |

**Outputs:** `SV04_adata_deconvolved.h5ad`, `SV04_cell_type_signatures.csv`, `models/cell2location/*`, `reports/figures/SV04/*.png`

**Key findings:**
- Niche–cell-type concordance: CAF_rich_stroma → stroma; immune_aggregate_TLS → T cells; normal_mucosa → epithelium
- Stromal fraction correlates with TGFB1 (r ≈ 0.33) — third independent confirmation of stroma-derived TGF-β
- CAF–T cell co-localization peaks in CAF_rich / immune_rich stroma (signal originates in stroma, not only at the margin)

---

### SV05 — Cell–Cell Communication (LIANA+)

**File:** `notebooks/SV05_cell_cell_communication.ipynb`

Spatially-informed bivariate ligand–receptor analysis with NMF communication programs.

| Section | Description |
|---------|-------------|
| Spatial connectivity | Radial kernel graph for LIANA+ |
| Bivariate LR scoring | Spatially-weighted ligand–receptor interactions |
| Niche localization | Interaction activity per spatial niche |
| NMF factorization | Coordinated communication programs |
| SHAP targets | Compile genes for SV06 validation |

**Outputs:** `SV05_shap_validation_targets.csv` (68 genes), `reports/figures/SV05/*.png`

**Key findings — four-layer exclusion model:**
1. **CAF_rich_stroma:** TGFB1 / POSTN origin of TGF-β and matrix remodeling
2. **stromal_invasive_margin:** COL1A1 / FN1 physical collagen barrier
3. **active_invasive_margin:** CXCL9/10/11 chemokine recruitment of T cells to the boundary
4. **immune_rich_stroma:** CXCL12→CXCR4 T cell trapping in stroma

Note: IDO1 is not a canonical surface LR pair, so it is absent from LIANA resources by design (not a method failure).

---

## Data Policy

Large downloaded and generated files are excluded via `.gitignore` so the repo stays pushable to GitHub. Local data is recreated by running notebooks in order (SV01 → SV05).

**Tracked small artifacts:**
- `SV01_qc_metrics.csv`
- `SV03_boundary_exclusion_signature.csv`
- `SV04_cell_type_signatures.csv`
- `SV05_shap_validation_targets.csv` *(pending commit)*
- Cell2Location model weights under `models/cell2location/`
