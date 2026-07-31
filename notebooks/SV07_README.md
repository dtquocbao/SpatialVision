# SpatialVision — Interactive Platform (SV07)

Spatial transcriptomics platform for CRC immune exclusion analysis.
FastAPI backend + React frontend, living under `app/` at the project root.

```
SpatialVision/
├── Dockerfile                      # Hugging Face Docker Space image
├── .github/workflows/
│   └── sync-to-hub.yml             # CI/CD: push main → HF Space
├── app/
│   ├── SV07_backend_main.py        # FastAPI backend
│   ├── requirements-sv07.txt       # Slim deps for Space / Docker
│   └── frontend/                   # Vite + React (has package.json)
│       └── src/App.jsx
├── data/processed/                 # Pre-computed SV01–SV06 outputs
└── notebooks/SV07_README.md        # This file
```

GitHub repo: [dtquocbao/SpatialVision](https://github.com/dtquocbao/SpatialVision)  
Target Space: [dtquocbao/SpatialVision](https://huggingface.co/spaces/dtquocbao/SpatialVision) (create once if missing)

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
pip install -r app/requirements-sv07.txt   # or full requirements.txt

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

For production / Hugging Face (same origin), build with an empty `VITE_API_URL` so the UI calls `/api/...` on the same host.

### 3. Build for production

```bash
cd app/frontend
VITE_API_URL= npm run build
# Static assets in app/frontend/dist/
```

The backend serves `app/frontend/dist/` when present (override with env `FRONTEND_DIR`).

---

## Data Files Required

Place these in `data/processed/` (project root). Large `.h5ad` files are **gitignored** and are **not** synced to Hugging Face by CI.

| File | Source | Purpose |
|------|--------|---------|
| `SV02_adata_niches.h5ad` | SV02 | Spatial coordinates, niche labels, Moran's I |
| `SV03_boundary_exclusion_signature.csv` | SV03 | Boundary exclusion gene signature |
| `SV05_adata_liana.h5ad` | SV05 | Cell type fractions, LIANA NMF factors |
| `SV05_shap_validation_targets.csv` | SV05 | LIANA priority genes |
| `SV06_shap_values_top50.csv` | SV06 | SHAP values for top 50 genes |
| `SV06_model_metrics.csv` | SV06 | AUC, F1 metrics |
| `SV06_adata_ml.h5ad` | SV06 | Immune phenotype predictions |

Recreate `.h5ad` files by running notebooks SV01 → SV06. Small CSVs can stay in git.

---

## Hugging Face Space + GitHub CI/CD

On every push to `main` (and on manual run), GitHub Actions mirrors this repo to a **Docker** Space using [`huggingface/hub-sync`](https://github.com/huggingface/hub-sync). The Space builds the root `Dockerfile` (frontend build + uvicorn on port **7860**).

Docs: [Managing Spaces with GitHub Actions](https://huggingface.co/docs/hub/spaces-github-actions)

### One-time setup

#### 0. Space `README.md` YAML (required)

Hugging Face reads **YAML frontmatter** at the top of the repo-root `README.md`. Without it the Space shows *Missing configuration in README*.

This repo already includes:

```yaml
---
title: SpatialVision
emoji: 🔬
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
pinned: false
---
```

After changing it, push to `main` so CI re-syncs the Space (or edit README on the Space and keep GitHub in sync).

#### 1. Create the Space (if it does not exist)

1. Open [huggingface.co/new-space](https://huggingface.co/new-space)
2. **Owner:** `dtquocbao` · **Name:** `SpatialVision` (must match the workflow `huggingface_repo_id`)
3. **SDK:** Docker
4. Visibility: public or private as you prefer

`hub-sync` can also create the Space on first run when `space_sdk: docker` is set.

#### 2. Create a Hugging Face write token

1. [HF Settings → Access Tokens](https://huggingface.co/settings/tokens)
2. Create a token with **write** access to the Space (fine-grained, scoped to that Space, is best)
3. Copy the token once

#### 3. Add the token to GitHub

1. Repo → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret**
   - Name: `HF_TOKEN`
   - Value: your HF write token

#### 4. Confirm the workflow file

Already in the repo:

```text
.github/workflows/sync-to-hub.yml
```

It syncs `dtquocbao/SpatialVision` (GitHub) → `dtquocbao/SpatialVision` (Space).  
If your Space name differs, edit `huggingface_repo_id` in that file.

#### 5. Provide processed data (important with `hub-sync`)

`hub-sync` **mirrors** the GitHub tree and **deletes** Space files that are not in GitHub. Do **not** rely on one-off uploads of `.h5ad` into the Space git repo, the next CI run will remove them.

Use one of these patterns instead:

**Option A — Hugging Face Dataset (recommended)**

1. Create a Dataset repo (e.g. `dtquocbao/SpatialVision-data`) and upload required processed files there (Git LFS for large `.h5ad`).
2. In the Space, set secrets/variables as needed for private datasets.
3. Add a small startup download in the container (or extend the Dockerfile `CMD` wrapper) that pulls into `DATA_DIR=/data/processed`.

**Option B — bake small CSVs in git; fetch `.h5ad` at runtime**

Tracked CSVs sync with CI. For `.h5ad`, download from Zenodo / your Dataset in an entrypoint script before uvicorn starts.

**Option C — persistent disk outside the git mirror**

If your Space hardware includes persistent storage mounted at `/data`, keep processed files there and set:

| Name | Value |
|------|--------|
| `DATA_DIR` | `/data/processed` |

Ensure that path is **not** overwritten by the synced repository layout.

```bash
# Example Dataset upload (run locally once)
pip install -U huggingface_hub
hf auth login
hf upload dtquocbao/SpatialVision-data data/processed/SV02_adata_niches.h5ad \
  SV02_adata_niches.h5ad --repo-type dataset
```

The Dockerfile defaults `DATA_DIR=/data/processed`.

#### 6. Trigger CI/CD

```bash
git add Dockerfile app/ .github/workflows/sync-to-hub.yml
git commit -m "Add Hugging Face Space Docker deploy and CI sync"
git push origin main
```

Or run **Actions** → **Sync to Hugging Face Space** → **Run workflow**.

Watch:

- GitHub: **Actions** tab (sync job)
- Hugging Face: Space → **Logs** (Docker build + uvicorn)

Space URL: https://huggingface.co/spaces/dtquocbao/SpatialVision

### What the pipeline does

```text
push to main
    → GitHub Action checkout
    → hub-sync uploads repo files to the Space (excludes .git / .github)
    → HF builds Dockerfile
         · pip install app/requirements-sv07.txt
         · npm ci && VITE_API_URL= npm run build
         · uvicorn SV07_backend_main:app --port 7860
    → Space serves API + React UI on one origin
```

### Local Docker smoke test (optional)

```bash
docker build -t spatialvision .
docker run --rm -p 7860:7860 \
  -e DATA_DIR=/data/processed \
  -v "%CD%/data/processed:/data/processed" \
  spatialvision
# open http://localhost:7860
```

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| Action fails auth | Recreate `HF_TOKEN` with write scope; ensure secret name is exactly `HF_TOKEN` |
| Space builds but UI calls `localhost:8000` | Rebuild frontend with empty `VITE_API_URL` (Dockerfile already does this) |
| API empty / missing niches | Upload `.h5ad` files; confirm `DATA_DIR` points at them |
| `uvicorn` import error | Run module as `SV07_backend_main:app` with cwd `/app/app` (Dockerfile sets this) |
| Wrong Space updated | Align `huggingface_repo_id` in `.github/workflows/sync-to-hub.yml` |

### Alternative: manual git push to the Space

If you prefer git-to-git instead of `hub-sync` file mirroring:

```bash
git remote add space https://huggingface.co/spaces/dtquocbao/SpatialVision
git push space main
```

Use a token as the password, or embed it in the HTTPS URL only in CI (never commit tokens).

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
