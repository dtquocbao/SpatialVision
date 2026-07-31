"""Download SpatialVision processed files from the HF Dataset if missing locally."""

from __future__ import annotations

import os
import shutil
from pathlib import Path

from huggingface_hub import hf_hub_download

DEFAULT_REPO = "dtquocbao/SpatialVision-data"

REQUIRED_DATASETS = [
    "processed/SV02_adata_niches.h5ad",
    "processed/SV06_shap_values_top50.csv",
    "processed/SV05_shap_validation_targets.csv",
    "processed/SV03_boundary_exclusion_signature.csv",
    "processed/SV06_model_metrics.csv",
    "processed/SV06_adata_ml.h5ad",
]


def ensure_data_from_hub(
    data_dir: str | Path | None = None,
    repo_id: str | None = None,
) -> Path:
    data_dir = Path(
        data_dir
        or os.environ.get("DATA_DIR")
        or Path(__file__).resolve().parents[1] / "data" / "processed"
    )
    repo_id = repo_id or os.environ.get("HF_DATA_REPO", DEFAULT_REPO)
    token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")

    data_dir.mkdir(parents=True, exist_ok=True)
    print(f"DATA_DIR={data_dir}")
    print(f"HF_DATA_REPO={repo_id}")

    for rel in REQUIRED_DATASETS:
        name = Path(rel).name
        dest = data_dir / name
        if dest.exists():
            print(f"  ✓ {name} (local)")
            continue
        print(f"  ↓ downloading {rel} from {repo_id} ...")
        try:
            cached = hf_hub_download(
                repo_id=repo_id,
                filename=rel,
                repo_type="dataset",
                token=token,
            )
            if Path(cached).resolve() != dest.resolve():
                dest.unlink(missing_ok=True)
                try:
                    dest.hardlink_to(cached)
                except OSError:
                    shutil.copy2(cached, dest)
            print(f"  ✓ {name}")
        except Exception as exc:  # noqa: BLE001
            print(f"  ⚠ skip {name}: {exc}")

    return data_dir
