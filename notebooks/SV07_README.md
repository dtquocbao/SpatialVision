# SpatialVision — Interactive Platform (SV07)

Spatial transcriptomics platform for CRC immune exclusion analysis.
FastAPI backend + React frontend, living under `app/` at the project root.

```
SpatialVision/
├── app/
│   ├── SV07_backend_main.py    # FastAPI backend (entry: `app`)
│   ├── SV07_frontend_App.jsx   # Source template (synced into frontend)
│   └── frontend/               # Vite + React app (has package.json)
│       └── src/App.jsx
├── data/processed/             # Pre-computed SV01–SV06 outputs
└── notebooks/SV07_README.md    # This file
```

---

## Local Development

### Prerequisites

- Conda env `spatialvision` (Python 3.12) with project `requirements.txt` installed
- Node.js 18+
- Processed outputs from SV01–SV06 in `data/processed/` (see table below)

### 1. Start the backend

From the **project root**:

```bash
conda activate spatialvision
pip install fastapi uvicorn   # if not already installed

# DATA_DIR is relative to the process cwd; prefer an absolute path on Windows
set DATA_DIR=%CD%\data\processed          # PowerShell / cmd
# export DATA_DIR="$(pwd)/data/processed" # bash / macOS / Linux

cd app
uvicorn SV07_backend_main:app --reload --port 8000
# Do not use .\SV07_backend_main — uvicorn treats that as a relative import and fails on Windows
```

| URL | Purpose |
|-----|---------|
| http://localhost:8000 | API |
| http://localhost:8000/docs | Interactive OpenAPI docs |

Default `DATA_DIR` inside the backend is `../data/processed` (correct when cwd is `app/`).

### 2. Start the frontend

`npm install` must run from `app/frontend/` (that directory has `package.json`). Do **not** run it from `app/`.

```bash
cd app/frontend
npm install
npm run dev
```

Frontend: http://localhost:5173

API base URL is set in `app/frontend/.env`:

```bash
VITE_API_URL=http://localhost:8000
```

### 3. Build for production

```bash
cd app/frontend
npm run build
# Static assets in app/frontend/dist/ (or build/, depending on Vite config)
```

The backend can serve the built SPA via `StaticFiles` when `FRONTEND_DIR` / build path is configured.

---

## Data Files Required

Place these in `data/processed/` (project root):

| File | Source | Purpose |
|------|--------|---------|
| `SV02_adata_niches.h5ad` | SV02 | Spatial coordinates, niche labels, Moran's I |
| `SV03_boundary_exclusion_signature.csv` | SV03 | Boundary exclusion gene signature |
| `SV05_adata_liana.h5ad` | SV05 | Cell type fractions, LIANA NMF factors |
| `SV05_shap_validation_targets.csv` | SV05 | LIANA priority genes |
| `SV06_shap_values_top50.csv` | SV06 | SHAP values for top 50 genes |
| `SV06_model_metrics.csv` | SV06 | AUC, F1 metrics |
| `SV06_adata_ml.h5ad` | SV06 | Immune phenotype predictions |

Large `.h5ad` files are gitignored — recreate them by running notebooks SV01 → SV06.

---

## HuggingFace Spaces Deployment

1. Create a Space at [huggingface.co/spaces](https://huggingface.co/spaces) with the **Docker** SDK
2. Upload `app/` (backend + pre-built frontend static files)
3. Upload required files into `/data/processed/` in the Space
4. Set Space secret / env: `DATA_DIR=/data/processed`
5. Entrypoint should run uvicorn against the backend module, e.g.  
   `uvicorn SV07_backend_main:app --host 0.0.0.0 --port 7860`

---

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check |
| `GET /api/patients` | All patients + metadata |
| `GET /api/spatial/{sample_id}` | Spot data for one sample |
| `GET /api/shap` | SHAP top 50 features |
| `GET /api/liana` | LIANA interaction scores |
| `GET /api/signature` | Boundary exclusion gene signature |
| `GET /api/summary` | Project overview for landing page |
