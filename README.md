# SpatialVision

Computational oncology portfolio project for spatial transcriptomics analysis of colorectal cancer using the scverse ecosystem.

**Author:** Bao Dang

## Overview

SpatialVision analyzes 10x Visium spatial transcriptomics data to validate data quality, map tissue architecture, and identify spatially coherent biological signal in colorectal cancer. The pipeline uses `SpatialData` as the unified data container, with `scanpy` for single-cell-style analysis and `squidpy` for spatial statistics.

## Dataset

**Valdeolivas et al. 2024** - *npj Precision Oncology*

- **Zenodo:** [doi:10.5281/zenodo.7760264](https://doi.org/10.5281/zenodo.7760264)
- **Samples:** 14 Visium sections (7 patients × 2 technical replicates)
- **Annotations:** Pathologist spot-level compartment labels (tumor, stroma, immune, etc.)
- **Metadata:** Patient ID, anatomical location, CMS subtype, immune phenotype

## Repository Structure

```
SpatialVision/
├── notebooks/
│   └── SV01_data_loading_qc.ipynb   # Data loading, QC, clustering, marker validation
├── data/
│   ├── raw/valdeolivas_2024/        # Space Ranger outputs + pathologist annotations
│   └── processed/                   # Filtered AnnData and QC tables
├── reports/
│   └── figures/SV01/                # QC and validation figures
└── requirements.txt                 # Pinned Python environment
```

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
| squidpy | 1.8.3 | Spatial statistics and visualization |
| scikit-misc | 0.5.2 | Seurat v3 HVG selection (`flavor='seurat_v3'`) |
| leidenalg | 0.12.0 | Leiden clustering |

Launch Jupyter from the `notebooks/` directory so relative paths resolve correctly:

```bash
cd notebooks
jupyter lab
```

Select the `spatialvision` conda environment as the kernel.

## Notebooks

### SV01 - Data Loading & Quality Control

**File:** `notebooks/SV01_data_loading_qc.ipynb`

Validates that the dataset is technically sound and captures biologically coherent spatial signal before downstream analysis.

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

**Outputs:**

| File | Description |
|------|-------------|
| `data/processed/SV01_adata_filtered.h5ad` | Filtered, normalized AnnData (all samples) |
| `data/processed/SV01_qc_metrics.csv` | Per-spot QC metrics and metadata |
| `reports/figures/SV01/*.png` | QC distributions, UMAP, marker plots |

### SV02 - Spatial Architecture & Niche Identification *(planned)*

Will refine Leiden clusters into biologically annotated spatial niches using Squidpy neighborhood graph methods. Depends on SV01 outputs.

## SV01 Key Findings

- QC metrics within expected Visium ranges (mean UMI ~11,000; mitochondrial fraction ~3.1%)
- UMAP clusters driven by tissue biology, not patient identity
- Pathologist compartment labels align with transcriptomic clusters
- Spatial markers show expected enrichment (EPCAM in tumor, CD3E at invasive margin, ACTA2/TGFB1 in stroma)

## Git History

| Commit | Summary |
|--------|---------|
| `1423dba` | Initial repository setup |
| `fbf625f` | Dataset DOI update; improved output saving |
| `060a316` | Notebook formatting and QC mapping fixes |
| `c2dc994` | Formatting fixes; empty code cell |
| `a98551c` | Execution count cleanup; PCA variance figure update |

Working tree is currently clean on `main`.
