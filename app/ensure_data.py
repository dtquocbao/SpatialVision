"""Download SpatialVision processed files from the HF Dataset if missing locally."""

from __future__ import annotations

import os
import shutil
from pathlib import Path

from huggingface_hub import hf_hub_download

DEFAULT_REPO = "dtquocbao/SpatialVision-data"

# Paths inside the Dataset repo (flat files land in DATA_DIR).
REQUIRED_DATASETS = [
    "processed/SV02_adata_niches.h5ad",
    "processed/SV06_shap_values_top50.csv",
    "processed/SV05_shap_validation_targets.csv",
    "processed/SV03_boundary_exclusion_signature.csv",
    "processed/SV06_adata_ml.h5ad",
]

_DONE = False


def ensure_data_from_hub(
    data_dir: str | Path | None = None,
    repo_id: str | None = None,
    force: bool = False,
) -> Path:
    """
    Ensure files exist under DATA_DIR (flat filenames, e.g. SV02_adata_niches.h5ad).

    Uses hf_hub_download(local_dir=...) so files materialize on disk under
    ``<parent>/processed/``, matching DATA_DIR when DATA_DIR ends with ``processed``.
    """
    global _DONE

    data_dir = Path(
        data_dir
        or os.environ.get("DATA_DIR")
        or Path(__file__).resolve().parents[1] / "data" / "processed"
    ).resolve()
    repo_id = repo_id or os.environ.get("HF_DATA_REPO", DEFAULT_REPO)
    token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")

    data_dir.mkdir(parents=True, exist_ok=True)
    os.environ["DATA_DIR"] = str(data_dir)

    # Dataset layout is processed/<file>; local_dir should be the parent of DATA_DIR
    local_root = data_dir.parent if data_dir.name == "processed" else data_dir

    print(f"DATA_DIR={data_dir}")
    print(f"HF_DATA_REPO={repo_id}")
    print(f"local_root={local_root}")

    if _DONE and not force:
        print("  ✓ dataset ensure already completed this process")
        return data_dir

    for rel in REQUIRED_DATASETS:
        name = Path(rel).name
        dest = data_dir / name

        if dest.exists() and dest.stat().st_size > 0:
            print(f"  ✓ {name} (local, {dest.stat().st_size:,} bytes)")
            continue

        print(f"  ↓ downloading {rel} from {repo_id} ...")
        try:
            path = hf_hub_download(
                repo_id=repo_id,
                filename=rel,
                repo_type="dataset",
                local_dir=str(local_root),
                token=token,
            )
            src = Path(path).resolve()
            # local_dir keeps Hub folder structure → local_root/processed/<name>
            expected = (local_root / rel).resolve()
            if src != dest.resolve():
                if expected.exists() and expected != dest.resolve():
                    dest.unlink(missing_ok=True)
                    shutil.copy2(expected, dest)
                elif src.exists():
                    dest.unlink(missing_ok=True)
                    shutil.copy2(src, dest)

            if not dest.exists() or dest.stat().st_size == 0:
                raise FileNotFoundError(
                    f"download finished but missing/empty at {dest} (src={src})"
                )
            print(f"  ✓ {name} ({dest.stat().st_size:,} bytes) → {dest}")
        except Exception as exc:  # noqa: BLE001
            print(f"  ⚠ missing {name}: {exc}")

    _DONE = True
    return data_dir
