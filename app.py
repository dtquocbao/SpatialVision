"""
SpatialVision — Hugging Face Gradio Space entrypoint.

Pulls processed outputs from dataset dtquocbao/SpatialVision-data.
ZeroGPU requires at least one @spaces.GPU-decorated function.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import gradio as gr
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from huggingface_hub import hf_hub_download

try:
    import spaces
except ImportError:  # local runs without the Spaces runtime
    class _SpacesFallback:
        @staticmethod
        def GPU(fn=None, duration=60):
            if fn is not None and callable(fn):
                return fn

            def deco(f):
                return f

            return deco

    spaces = _SpacesFallback()

ROOT = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("DATA_DIR", ROOT / "data" / "processed"))
DATA_REPO = os.environ.get("HF_DATA_REPO", "dtquocbao/SpatialVision-data")

# Files under dataset `processed/` needed by the Gradio demo
REQUIRED_DATASETS = [
    "processed/SV02_adata_niches.h5ad",
    "processed/SV06_shap_values_top50.csv",
    "processed/SV05_shap_validation_targets.csv",
    "processed/SV03_boundary_exclusion_signature.csv",
    "processed/SV06_model_metrics.csv",
    "processed/SV06_adata_ml.h5ad",  # optional-ish; phenotype probabilities
]

os.environ["DATA_DIR"] = str(DATA_DIR)
sys.path.insert(0, str(ROOT / "app"))


def ensure_data_from_hub() -> None:
    """Download missing processed files from the HF Dataset into DATA_DIR."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")

    for rel in REQUIRED_DATASETS:
        name = Path(rel).name
        dest = DATA_DIR / name
        if dest.exists():
            print(f"  ✓ {name} (local)")
            continue
        print(f"  ↓ downloading {rel} from {DATA_REPO} ...")
        try:
            cached = hf_hub_download(
                repo_id=DATA_REPO,
                filename=rel,
                repo_type="dataset",
                token=token,
            )
            # Place a stable path under DATA_DIR for the backend loader
            if Path(cached).resolve() != dest.resolve():
                dest.unlink(missing_ok=True)
                try:
                    dest.hardlink_to(cached)
                except OSError:
                    import shutil
                    shutil.copy2(cached, dest)
            print(f"  ✓ {name}")
        except Exception as exc:  # noqa: BLE001 — continue with partial data
            print(f"  ⚠ skip {name}: {exc}")


print(f"DATA_DIR={DATA_DIR}")
print(f"HF_DATA_REPO={DATA_REPO}")
ensure_data_from_hub()

from SV07_backend_main import load_data, store  # noqa: E402

load_data()

NICHE_COLORS = store.get("niche_colors", {})
PATIENTS = store.get("patients", {})


def _samples() -> list[str]:
    samples = store.get("samples") or []
    return samples if samples else ["(no spatial data — check dataset download)"]


@spaces.GPU(duration=60)
def plot_spatial(sample_id: str, color_by: str):
    spatial = store.get("spatial", {})
    if sample_id not in spatial:
        fig, ax = plt.subplots(figsize=(5, 4))
        ax.text(
            0.5, 0.5,
            "Spatial .h5ad not loaded\n"
            f"Expected in DATA_DIR or {DATA_REPO}",
            ha="center", va="center", transform=ax.transAxes,
        )
        ax.axis("off")
        return fig

    spots = spatial[sample_id]["spots"]
    xs = [s["x"] for s in spots]
    ys = [s["y"] for s in spots]

    fig, ax = plt.subplots(figsize=(5.5, 5))
    if color_by == "niche":
        niches = sorted({s["niche"] for s in spots})
        for niche in niches:
            pts = [s for s in spots if s["niche"] == niche]
            ax.scatter(
                [p["x"] for p in pts],
                [p["y"] for p in pts],
                s=8,
                c=NICHE_COLORS.get(niche, "#888888"),
                label=niche.replace("_", " "),
                alpha=0.85,
            )
        ax.legend(fontsize=7, loc="best", frameon=False)
    else:
        probs = store.get("infiltrated_probability", {}).get(sample_id)
        if probs and len(probs) == len(spots):
            colors = [("#888888" if p < 0 else plt.cm.RdBu_r(p)) for p in probs]
            ax.scatter(xs, ys, s=8, c=colors, alpha=0.85)
        else:
            ax.scatter(xs, ys, s=8, c="#4169E1", alpha=0.85)

    ax.set_title(f"{sample_id} — {color_by}")
    ax.set_aspect("equal")
    ax.invert_yaxis()
    ax.axis("off")
    fig.tight_layout()
    return fig


@spaces.GPU(duration=30)
def plot_shap(top_n: int):
    rows = store.get("shap_top50") or []
    fig, ax = plt.subplots(figsize=(7, 5))
    if not rows:
        ax.text(0.5, 0.5, "SV06_shap_values_top50.csv not found",
                ha="center", va="center", transform=ax.transAxes)
        ax.axis("off")
        return fig

    df = pd.DataFrame(rows).head(int(top_n))
    colors = ["#DC143C" if r else "#4169E1" for r in df["is_priority"]]
    ax.barh(df["gene"][::-1], df["mean_abs_shap"][::-1], color=colors[::-1])
    ax.set_xlabel("Mean |SHAP|")
    ax.set_title("XGBoost SHAP — top features (red = LIANA priority)")
    fig.tight_layout()
    return fig


@spaces.GPU(duration=30)
def plot_liana_heatmap():
    heat = store.get("liana_niche_heatmap") or {}
    fig, ax = plt.subplots(figsize=(8, 4.5))
    interactions = heat.get("interactions") or []
    niches = heat.get("niches") or []
    if not interactions:
        ax.text(0.5, 0.5, "No LIANA heatmap data", ha="center", va="center",
                transform=ax.transAxes)
        ax.axis("off")
        return fig

    mat = np.array([row["scores"] for row in interactions], dtype=float)
    im = ax.imshow(mat, aspect="auto", cmap="YlOrRd")
    ax.set_yticks(range(len(interactions)))
    ax.set_yticklabels([row["name"] for row in interactions], fontsize=8)
    ax.set_xticks(range(len(niches)))
    ax.set_xticklabels([n.replace("_", "\n") for n in niches], fontsize=7)
    ax.set_title("LIANA+ niche interaction scores (SV05)")
    fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    fig.tight_layout()
    return fig


def patient_table() -> pd.DataFrame:
    rows = []
    for pid, meta in PATIENTS.items():
        rows.append({
            "patient": pid,
            "location": meta.get("location", ""),
            "CMS": meta.get("cms", ""),
            "phenotype": meta.get("phenotype", ""),
        })
    return pd.DataFrame(rows)


def summary_md() -> str:
    metrics = store.get("model_metrics") or {}
    n_samples = len(store.get("samples") or [])
    n_shap = len(store.get("shap_top50") or [])
    n_sig = len(store.get("boundary_signature") or [])
    return f"""
# SpatialVision
### Spatial transcriptomics of CRC immune exclusion

**Author:** Bao Dang · Valdeolivas et al. 2024 Visium CRC · Lee et al. 2020 reference

| Metric | Value |
|--------|-------|
| Spatial samples loaded | {n_samples} |
| SHAP features | {n_shap} |
| Boundary signature genes | {n_sig} |
| XGBoost AUC | {metrics.get("AUC", "0.925")} |
| Data repo | `{DATA_REPO}` |

**Four-layer exclusion model (LIANA+):** CAF TGF-β → stromal ECM barrier (COL1A1/FN1)
→ invasive-margin chemokines (CXCL9/10/11) → CXCL12→CXCR4 stromal trapping.
"""


with gr.Blocks(title="SpatialVision", theme=gr.themes.Soft()) as demo:
    gr.Markdown(summary_md())

    with gr.Tab("Spatial niches"):
        with gr.Row():
            sample = gr.Dropdown(choices=_samples(), value=_samples()[0], label="Sample")
            color_by = gr.Radio(
                ["niche", "infiltrated_probability"],
                value="niche",
                label="Color by",
            )
        spatial_plot = gr.Plot(label="Visium spots")
        sample.change(plot_spatial, [sample, color_by], spatial_plot)
        color_by.change(plot_spatial, [sample, color_by], spatial_plot)
        demo.load(plot_spatial, [sample, color_by], spatial_plot)

    with gr.Tab("SHAP (SV06)"):
        top_n = gr.Slider(10, 50, value=25, step=5, label="Top N genes")
        shap_plot = gr.Plot()
        top_n.change(plot_shap, top_n, shap_plot)
        demo.load(plot_shap, top_n, shap_plot)

    with gr.Tab("LIANA (SV05)"):
        liana_plot = gr.Plot()
        demo.load(plot_liana_heatmap, None, liana_plot)

    with gr.Tab("Patients"):
        gr.Dataframe(patient_table(), label="Cohort metadata")

    gr.Markdown(
        "Data: "
        f"[`{DATA_REPO}`](https://huggingface.co/datasets/{DATA_REPO}) · "
        "Code: [github.com/dtquocbao/SpatialVision](https://github.com/dtquocbao/SpatialVision)"
    )


if __name__ == "__main__":
    demo.launch()
