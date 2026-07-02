"""Configure CPU thread limits before numpy/torch/sentence-transformers load."""

from __future__ import annotations

import os


def configure_ml_runtime() -> None:
    """
    Reduce peak RAM from OpenBLAS/PyTorch on Windows and low-memory machines.

    Must run before importing sentence_transformers, torch, or numpy-heavy libs.
    """
    os.environ.setdefault("OMP_NUM_THREADS", "1")
    os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
    os.environ.setdefault("MKL_NUM_THREADS", "1")
    os.environ.setdefault("NUMEXPR_NUM_THREADS", "1")
    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

    try:
        import torch

        if hasattr(torch, "set_num_interop_threads"):
            try:
                torch.set_num_interop_threads(1)
            except RuntimeError:
                pass
        try:
            torch.set_num_threads(1)
        except RuntimeError:
            pass
    except ImportError:
        pass
