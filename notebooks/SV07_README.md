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

## Vercel frontend ↔ Hugging Face FastAPI backend

The React app on **Vercel** talks to FastAPI on a **Docker** Hugging Face Space (not the Gradio ZeroGPU demo). Gradio does not expose your `/api/*` JSON routes for the portfolio UI.

```text
Browser → https://your-app.vercel.app     (Vite/React)
                │  fetch(`${VITE_API_URL}/api/...`)
                ▼
         https://<space>.hf.space         (FastAPI / Docker Space)
                │
                ▼
         Dataset dtquocbao/SpatialVision-data
```

### 1. Create an API Space (Docker)

> **If `https://dtquocbao-spatialvision-api.hf.space/...` returns Hub 404**, the Space
> `dtquocbao/SpatialVision-api` does not exist yet (or never built). The Gradio demo
> Space (`SpatialVision`) is separate and does **not** serve `/api/shap`.

**Option A — GitHub Action (recommended)**

1. Ensure repo secret `HF_TOKEN` has write access
2. Run **Actions → Sync API Space (Docker) → Run workflow**
3. Wait until [huggingface.co/spaces/dtquocbao/SpatialVision-api](https://huggingface.co/spaces/dtquocbao/SpatialVision-api) shows a running Docker build
4. Set Space secrets: `HF_TOKEN` (if Dataset private), optional `HF_DATA_REPO=dtquocbao/SpatialVision-data`

**Option B — create manually**

1. [New Space](https://huggingface.co/new-space) → name `SpatialVision-api` → **SDK: Docker**
2. Push contents of `spaces/api/` (plus copied `SV07_backend_main.py`, `ensure_data.py`, `requirements-sv07.txt` from `app/`) as the Space root
3. Or run the workflow above after creating an empty Docker Space

Direct API host (use in Vercel — **not** `huggingface.co/spaces/...`):

```text
https://dtquocbao-spatialvision-api.hf.space
```

Smoke-test **after** the Space is Running:

```bash
curl https://dtquocbao-spatialvision-api.hf.space/api/health
curl https://dtquocbao-spatialvision-api.hf.space/api/shap
curl https://dtquocbao-spatialvision-api.hf.space/docs
```

| Name | Value |
|------|--------|
| `HF_DATA_REPO` | `dtquocbao/SpatialVision-data` |
| `DATA_DIR` | `/data/processed` |
| `HF_TOKEN` | read token if Dataset is private |
| `CORS_ORIGINS` | `*` (default) or `https://your-app.vercel.app` |

Local image test:

```bash
# from repo root after copying app files into spaces/api (same as CI)
cp app/SV07_backend_main.py app/ensure_data.py app/requirements-sv07.txt spaces/api/
docker build -t spatialvision-api spaces/api
docker run --rm -p 7860:7860 -e HF_TOKEN=%HF_TOKEN% spatialvision-api
```

### 2. Deploy frontend on Vercel

From `app/frontend` (or set Vercel **Root Directory** to `app/frontend`):

1. Import the GitHub repo in Vercel
2. **Root Directory:** `app/frontend`
3. Framework: Vite
4. **Environment variable** (Production + Preview):

| Name | Value |
|------|--------|
| `VITE_API_URL` | `https://dtquocbao-spatialvision-api.hf.space` |

No trailing slash. Rebuild after changing env vars (`VITE_*` is baked in at build time).

5. `vercel.json` is included for SPA client-side routing

```bash
cd app/frontend
# optional CLI deploy
npx vercel --prod
```

### 3. CORS

Backend already allows all origins and `https://*.vercel.app` via regex. To lock down:

```bash
CORS_ORIGINS=https://your-app.vercel.app
```

### 4. What not to do

| Mistake | Why it fails |
|---------|----------------|
| Point `VITE_API_URL` at the Gradio Space | Gradio UI ≠ `/api/patients` JSON |
| Use `https://huggingface.co/spaces/...` as API base | That’s the Hub page, not the app host |
| Forget to rebuild Vercel after changing `VITE_API_URL` | Vite inlines env at build time |

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
