# SpatialVision — Interactive Platform (SV07)

Spatial transcriptomics platform for CRC immune exclusion analysis.

- **Local / portfolio UI:** FastAPI + React under `app/`
- **Hugging Face Space:** Gradio (`app.py`) — required for **ZeroGPU**

```
SpatialVision/
├── app.py                          # Gradio Space entry (HF app_file)
├── requirements.txt                # Slim deps for HF Gradio Space
├── requirements-lock.txt           # Full research stack pin
├── .github/workflows/sync-to-hub.yml
├── app/
│   ├── SV07_backend_main.py        # Shared data loader + FastAPI
│   └── frontend/                   # Vite + React (local UI)
├── data/processed/
└── notebooks/SV07_README.md
```

GitHub: [dtquocbao/SpatialVision](https://github.com/dtquocbao/SpatialVision)  
Space: [dtquocbao/SpatialVision](https://huggingface.co/spaces/dtquocbao/SpatialVision)

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

---

## Vercel frontend ↔ Gradio Space (API on free tier)

Docker Spaces are paid on some accounts. Use **one Gradio Space** that mounts FastAPI:

```text
Browser → https://your-app.vercel.app
                │  VITE_API_URL
                ▼
         https://dtquocbao-spatialvision.hf.space
                ├── /           Gradio UI
                ├── /api/*      FastAPI JSON (React)
                └── /docs       OpenAPI
                │
                ▼
         Dataset dtquocbao/SpatialVision-data
```

`app.py` does `gr.mount_gradio_app(api_app, demo, path="/")` so `/api/shap` etc. work without Docker.

### 1. Hugging Face Space (Gradio + ZeroGPU)

On [Create a new Space](https://huggingface.co/new-space) (or keep existing `SpatialVision`):

| Field | Value |
|-------|--------|
| Space name | `SpatialVision` |
| SDK | **Gradio** (not Docker) |
| Template | Blank |
| Hardware | **ZeroGPU** (or CPU Basic) |

Do **not** create `SpatialVision-api`. Sync this repo with the existing Gradio workflow (`sync-to-hub.yml`).

Space secrets / variables:

| Name | Value |
|------|--------|
| `HF_DATA_REPO` | `dtquocbao/SpatialVision-data` |
| `HF_TOKEN` | only if the Dataset is private |

After the Space is **Running**, smoke-test:

```bash
curl https://dtquocbao-spatialvision.hf.space/api/health
curl https://dtquocbao-spatialvision.hf.space/api/shap
# Gradio UI:
# https://dtquocbao-spatialvision.hf.space/
```

### 2. Deploy frontend on Vercel

1. Root Directory: `app/frontend`
2. Environment variable (Production + Preview):

| Name | Value |
|------|--------|
| `VITE_API_URL` | `https://dtquocbao-spatialvision.hf.space` |

No trailing slash. Redeploy after changing `VITE_*` (baked in at build time).

### 3. CORS

Backend allows `*` and `https://*.vercel.app`. Optional lock-down:

```bash
CORS_ORIGINS=https://your-app.vercel.app
```

### 4. What not to do

| Mistake | Why it fails |
|---------|----------------|
| Point Vercel at `…-spatialvision-api.hf.space` | That Docker Space is optional/paid and may not exist |
| Use `https://huggingface.co/spaces/...` as API base | Hub page, not the app host |
| Expect `/api/*` before `app.py` with `mount_gradio_app` is synced | Push + wait for Space rebuild |

### 3. Build for production (local static)

```bash
cd app/frontend
# same-origin (API serves UI):
VITE_API_URL= npm run build
# or point at HF API:
# VITE_API_URL=https://dtquocbao-spatialvision-api.hf.space npm run build
```

The backend can serve `app/frontend/dist/` when present (override with env `FRONTEND_DIR`).

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

## Hugging Face Space + GitHub CI/CD (Gradio / ZeroGPU)

On every push to `main`, GitHub Actions mirrors this repo to a **Gradio** Space via [`huggingface/hub-sync`](https://github.com/huggingface/hub-sync).

**ZeroGPU is Gradio-only** — `sdk: docker` will fail with *ZeroGPU is only available on Gradio SDK*. This repo uses:

| Field | Value |
|-------|--------|
| `sdk` | `gradio` |
| `app_file` | `app.py` |
| `sdk_version` | `5.38.0` |

Docs: [Spaces config](https://huggingface.co/docs/hub/spaces-config-reference) · [GitHub Actions](https://huggingface.co/docs/hub/spaces-github-actions)

### Local Gradio smoke test

```bash
conda activate spatialvision
pip install -r requirements.txt
set DATA_DIR=%CD%\data\processed
python app.py
```

### One-time setup

#### 0. Space `README.md` YAML (required)

```yaml
---
title: SpatialVision
emoji: 🔬
colorFrom: blue
colorTo: green
sdk: gradio
sdk_version: "5.38.0"
python_version: "3.12"
app_file: app.py
pinned: false
short_description: CRC spatial transcriptomics — Gradio demo
---
```

In Space **Settings → Hardware**, choose **ZeroGPU** or CPU. ZeroGPU requires `sdk: gradio`.

#### 1. Create the Space (if needed)

1. [huggingface.co/new-space](https://huggingface.co/new-space)
2. Owner `dtquocbao` · Name `SpatialVision`
3. **SDK: Gradio** (not Docker)

Workflow uses `space_sdk: gradio` in `.github/workflows/sync-to-hub.yml`.

#### 2–3. HF token → GitHub secret `HF_TOKEN`

Create a write token at [HF tokens](https://huggingface.co/settings/tokens), then add repo secret `HF_TOKEN`.

#### 4. Wire the Dataset to the Space

Your data lives at [`dtquocbao/SpatialVision-data`](https://huggingface.co/datasets/dtquocbao/SpatialVision-data) under `processed/`.

`app.py` downloads missing files from that Dataset into `DATA_DIR` (`data/processed` by default) on startup via `huggingface_hub.hf_hub_download`.

| Space setting | Value |
|---------------|--------|
| README `datasets:` | `dtquocbao/SpatialVision-data` |
| Env / secret `HF_DATA_REPO` | `dtquocbao/SpatialVision-data` (optional; this is the default) |
| Env / secret `DATA_DIR` | `data/processed` (optional) |
| Secret `HF_TOKEN` | Only if the Dataset is **private** (write/read token) |

**Space → Settings → Variables and secrets**

1. If the Dataset is private: add secret `HF_TOKEN` (HF read token that can access the Dataset).
2. Optional variable: `HF_DATA_REPO=dtquocbao/SpatialVision-data`.

No need to copy the 11 GB tree into the Space git repo — CI would also wipe non-git files on sync.

**ZeroGPU:** plot callbacks use `@spaces.GPU` (required). First cold start may download large `.h5ad` files (~4 GB); later starts use the Hub cache when available.

If downloads OOM or time out on ZeroGPU, switch hardware to **CPU basic** temporarily for the first successful data pull, or trim `REQUIRED_DATASETS` in `app.py` to only the files you need.

#### 5. Trigger CI/CD

```bash
git add app.py README.md requirements.txt requirements-lock.txt .github/workflows/sync-to-hub.yml
git commit -m "Switch Hugging Face Space to Gradio for ZeroGPU"
git push origin main
```

Or **Actions** → **Sync to Hugging Face Space** → **Run workflow**.

### What the pipeline does

```text
push to main
    → hub-sync mirrors repo to the Space
    → HF installs requirements.txt (slim)
    → runs Gradio app.py
    → ZeroGPU-compatible demo (spatial / SHAP / LIANA tabs)
```

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| ZeroGPU only on Gradio | Set `sdk: gradio` + `app_file: app.py` (done in README) |
| `short_description` invalid | Keep ≤ 60 characters |
| Action auth failure | Refresh `HF_TOKEN` write scope |
| Empty plots | Supply `data/processed` `.h5ad` / CSVs via Dataset or `DATA_DIR` |
| Wrong Space | Match `huggingface_repo_id` in the workflow |

### Alternative: manual git push

```bash
git remote add space https://huggingface.co/spaces/dtquocbao/SpatialVision
git push space main
```

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
