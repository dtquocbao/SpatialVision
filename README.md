# SpatialVision

Computational oncology portfolio project for spatial transcriptomics analysis of colorectal cancer using the scverse ecosystem.

**Author:** Bao Dang

## Overview

SpatialVision analyzes 10x Visium spatial transcriptomics data to map colorectal cancer tissue architecture and identify spatially coherent immune-exclusion programs. The pipeline uses `SpatialData` as the unified data container, with `scanpy` for single-cell-style analysis, `squidpy` for spatial statistics, and `gseapy` / `decoupler` for pathway enrichment.

**Current status:** SV01–SV03 complete. SV04 (cell-type deconvolution) is next.

## Dataset

**Valdeolivas et al. 2024** — *npj Precision Oncology*

- **Zenodo:** [doi:10.5281/zenodo.7760264](https://doi.org/10.5281/zenodo.7760264)
- **Samples:** 14 Visium sections (7 patients × 2 technical replicates)
- **Annotations:** Pathologist spot-level compartment labels (tumor, stroma, immune, etc.)
- **Metadata:** Patient ID, anatomical location, CMS subtype, immune phenotype

## Repository Structure

```
SpatialVision/
├── notebooks/
│   ├── SV01_data_loading_qc.ipynb
│   ├── SV02_spatial_architecture_niche_identification.ipynb
│   └── SV03_spatially_variable_genes.ipynb
├── data/
│   ├── raw/valdeolivas_2024/          # Downloaded from Zenodo (gitignored)
│   └── processed/                     # Large .h5ad outputs gitignored;
│                                      # small CSVs tracked
├── reports/
│   └── figures/SV01|SV02|SV03/        # QC, niche, and SVG figures
├── requirements.txt
└── .gitignore
```

> **Note:** Raw Visium data (~1.5 GB) and processed AnnData files are **not stored in git**.
> Run the download cell in `SV01_data_loading_qc.ipynb` to fetch data from Zenodo locally.

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
| **SV04** Cell Type Deconvolution | Planned | Cell2Location with FFPE scRNA-seq reference |
| **SV05** Cell–Cell Communication | Planned | LIANA ligand–receptor analysis |
| **SV06** Predictive Modeling | Planned | SHAP validation of exclusion programs |

---

### SV01 — Data Loading & Quality Control

**File:** `notebooks/SV01_data_loading_qc.ipynb`

Validates technical quality and confirms biologically coherent spatial signal before niche analysis.

| Section | Description |
|---------|-------------|
| 1. Data Download | Fetch and unpack Zenodo archives |
| 2. Sample Metadata | Patient, CMS subtype, anatomical location |
| 3. Load SpatialData | Import Visium samples via `spatialdata_io.visium` |
| 4. Quality Control | UMI counts, gene counts, mitochondrial fraction |
| 5. Normalization | Log-normalization and scaling |
| 6. HVG Selection | Highly variable genes (Seurat v3) |
| 7. Dimensionality Reduction | PCA, UMAP, Leiden clustering |
| 8. Marker Validation | EPCAM, CD3E, ACTA2 spatial expression |
| 9–11. Summary & Save | QC metrics, biological interpretation |

**Outputs:** `SV01_adata_filtered.h5ad`, `SV01_qc_metrics.csv`, `reports/figures/SV01/*.png`

**Key findings:**
- QC within expected Visium ranges (mean UMI ~11,000; mitochondrial fraction ~3.1%)
- UMAP driven by tissue biology, not patient identity
- Pathologist compartments align with transcriptomic clusters

---

### SV02 — Spatial Architecture & Niche Identification

**File:** `notebooks/SV02_spatial_architecture_niche_identification.ipynb`

Maps tumor–immune spatial organization and defines niches from neighborhood composition.

| Section | Description |
|---------|-------------|
| Spatial neighborhood graph | Squidpy graph from spot coordinates |
| Neighborhood enrichment | Permutation test of compartment co-occurrence |
| Moran's I | Spatial autocorrelation of HVGs |
| Niche clustering | k-means on neighborhood composition (k=8) |
| Niche annotation | Biological labels for each niche |

**Eight niches:** `tumor_core`, `tumor_margin_interface`, `active_invasive_margin`, `stromal_invasive_margin`, `CAF_rich_stroma`, `immune_rich_stroma`, `immune_aggregate_TLS`, `normal_mucosa`

**Outputs:** `SV02_adata_niches.h5ad`, `reports/figures/SV02/*.png`

**Key findings:**
- Tumor ↔ immune_aggregate strongly depleted (z ≈ −21) — quantitative immune exclusion
- Three-layer architecture: tumor core → invasive margin barrier → stromal/immune periphery
- EPCAM highly spatially organized; PDCD1LG2 not significant (favors CAF/TGF-β over PD-L1 dominance)

---

### SV03 — Spatially Variable Genes & Pathway Enrichment

**File:** `notebooks/SV03_spatially_variable_genes.ipynb`

Identifies molecular programs at exclusion boundaries using DE, GSEA, and PROGENy.

| Section | Description |
|---------|-------------|
| Global Moran's I | Dataset-wide spatially variable genes |
| Niche DE | Marker genes and margin vs tumor-core contrasts |
| Hallmark GSEA | Pathway enrichment of niche programs (`gseapy`) |
| PROGENy activity | Pathway scores per niche (`decoupler`) |
| Exclusion signature | Boundary gene set for downstream validation |

**Outputs:** `SV03_adata_svgs.h5ad`, `SV03_boundary_exclusion_signature.csv` (156 genes), `reports/figures/SV03/*.png`

**Key findings:**
- IDO1 is the top globally spatially variable gene (chemokine–IDO1 metabolic trap)
- Boundary niches are an **active immune conflict zone** (IFN response, antigen presentation, IDO1), not only a passive fibrotic wall
- PROGENy: TGF-β highest in `CAF_rich_stroma`, lowest in `tumor_core` (stroma-derived exclusion)
- Revised model: stroma TGF-β gradient + boundary IDO1/IFN suppression

---

## Data Policy

Large downloaded and generated files are excluded via `.gitignore` so the repo stays pushable to GitHub (~16 MB). Local data is recreated by running the notebooks in order (SV01 → SV02 → SV03).

Tracked small artifacts include `SV01_qc_metrics.csv` and `SV03_boundary_exclusion_signature.csv`.
