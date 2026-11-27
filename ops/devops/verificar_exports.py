"""Registra tamaño y SHA-256 del bundle que Expo declara para cada plataforma."""
import hashlib
import json
import sys
from pathlib import Path


def main(root):
    results = {}
    for platform in ("ios", "android"):
        directory = (root / platform).resolve()
        metadata = json.loads((directory / "metadata.json").read_text())
        relative = metadata["fileMetadata"][platform]["bundle"]
        bundle = (directory / relative).resolve()
        if directory not in bundle.parents or not bundle.is_file() or not bundle.stat().st_size:
            raise ValueError(f"Bundle inválido para {platform}")
        results[platform] = {"bundle": relative, "bytes": bundle.stat().st_size,
                             "sha256": hashlib.sha256(bundle.read_bytes()).hexdigest()}
    (root / "resumen.json").write_text(json.dumps(results, indent=2) + "\n")
    print("EXPORTACIONES_IOS_ANDROID=OK")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
