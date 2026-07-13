#!/usr/bin/env python3
import argparse
import json
import os
import sqlite3
import subprocess
import sys
from pathlib import Path


def parse_args():
    parser = argparse.ArgumentParser(
        description="Pack a materialized z/x/y MVT directory into MBTiles and PMTiles."
    )
    parser.add_argument("--city", default=os.environ.get("TWIN_STUDIO_SMOKE_CITY_ID", "guanajuato"))
    parser.add_argument("--version", default="latest")
    parser.add_argument("--runtime-dir", default=os.environ.get("TWIN_STUDIO_RUNTIME_DIR", "runtime-data"))
    parser.add_argument("--input-dir", default="")
    parser.add_argument("--output-dir", default="")
    parser.add_argument("--pmtiles-bin", default=os.environ.get("PMTILES_BIN", "pmtiles"))
    return parser.parse_args()


def latest_mvt_dir(runtime_dir, city):
    base_dir = Path(runtime_dir) / "artifacts" / city / "mvt"
    candidates = []
    for child in base_dir.iterdir():
        if not child.is_dir():
            continue
        manifest_path = child / "manifest.json"
        stat_path = manifest_path if manifest_path.exists() else child
        candidates.append((stat_path.stat().st_mtime, child))
    if not candidates:
        raise RuntimeError(f"No MVT package directories found under {base_dir}")
    return sorted(candidates, reverse=True)[0][1]


def center_from_bbox(bbox):
    west, south, east, north = [float(value) for value in bbox]
    return [(west + east) / 2, (south + north) / 2]


def write_metadata(cursor, manifest):
    bbox = manifest.get("bbox") or [-180, -85, 180, 85]
    center = center_from_bbox(bbox)
    metadata = {
        "name": f"{manifest.get('cityId', 'city')} {manifest.get('version', 'mvt')}",
        "description": "Twin Studio materialized vector tiles.",
        "version": manifest.get("version", ""),
        "format": "pbf",
        "bounds": ",".join(str(round(float(value), 7)) for value in bbox),
        "center": f"{round(center[0], 7)},{round(center[1], 7)},{manifest.get('minZoom', 0)}",
        "minzoom": str(manifest.get("minZoom", 0)),
        "maxzoom": str(manifest.get("maxZoom", 0)),
        "json": json.dumps({
            "vector_layers": [
                {
                    "id": "features",
                    "description": "Twin Studio city objects.",
                    "fields": {
                        "objectId": "String",
                        "semanticClass": "String",
                        "label": "String",
                        "authorityStatus": "String",
                        "sourceFormat": "String",
                    },
                },
            ],
        }, separators=(",", ":")),
    }
    cursor.executemany(
        "INSERT INTO metadata (name, value) VALUES (?, ?)",
        sorted(metadata.items()),
    )


def write_mbtiles(input_dir, mbtiles_path):
    manifest_path = input_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if mbtiles_path.exists():
        mbtiles_path.unlink()

    connection = sqlite3.connect(str(mbtiles_path))
    try:
        cursor = connection.cursor()
        cursor.execute("PRAGMA synchronous=OFF")
        cursor.execute("PRAGMA journal_mode=MEMORY")
        cursor.execute("CREATE TABLE metadata (name TEXT, value TEXT)")
        cursor.execute(
            "CREATE TABLE tiles (zoom_level INTEGER, tile_column INTEGER, tile_row INTEGER, tile_data BLOB)"
        )
        cursor.execute("CREATE UNIQUE INDEX tile_index ON tiles (zoom_level, tile_column, tile_row)")
        write_metadata(cursor, manifest)

        rows = []
        total_bytes = 0
        for tile in manifest.get("tiles", []):
            byte_size = int(tile.get("byteSize") or 0)
            if byte_size <= 0:
                continue
            z = int(tile["z"])
            x = int(tile["x"])
            y = int(tile["y"])
            tile_path = input_dir / tile["path"]
            if not tile_path.exists():
                raise RuntimeError(f"Tile listed in manifest is missing: {tile_path}")
            tms_y = (2 ** z - 1) - y
            payload = tile_path.read_bytes()
            total_bytes += len(payload)
            rows.append((z, x, tms_y, payload))

        cursor.executemany(
            "INSERT INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (?, ?, ?, ?)",
            rows,
        )
        connection.commit()
        return {
            "manifest": manifest,
            "tileCount": len(rows),
            "tileBytes": total_bytes,
        }
    finally:
        connection.close()


def run_pmtiles_convert(pmtiles_bin, mbtiles_path, pmtiles_path):
    if pmtiles_path.exists():
        pmtiles_path.unlink()
    subprocess.run(
        [pmtiles_bin, "convert", str(mbtiles_path), str(pmtiles_path)],
        check=True,
        stdout=sys.stderr,
        stderr=sys.stderr,
    )
    subprocess.run(
        [pmtiles_bin, "verify", str(pmtiles_path)],
        check=True,
        stdout=sys.stderr,
        stderr=sys.stderr,
    )


def main():
    args = parse_args()
    runtime_dir = Path(args.runtime_dir).resolve()
    city = args.city.strip()
    input_dir = Path(args.input_dir).resolve() if args.input_dir else (
        latest_mvt_dir(runtime_dir, city) if args.version == "latest"
        else runtime_dir / "artifacts" / city / "mvt" / args.version
    )
    if not (input_dir / "manifest.json").exists():
        raise RuntimeError(f"MVT manifest not found: {input_dir / 'manifest.json'}")

    output_dir = Path(args.output_dir).resolve() if args.output_dir else runtime_dir / "artifacts" / city / "pmtiles"
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((input_dir / "manifest.json").read_text(encoding="utf-8"))
    version = str(manifest.get("version") or input_dir.name)
    mbtiles_path = output_dir / f"{version}.mbtiles"
    pmtiles_path = output_dir / f"{version}.pmtiles"
    package_manifest_path = output_dir / f"{version}.manifest.json"

    stats = write_mbtiles(input_dir, mbtiles_path)
    run_pmtiles_convert(args.pmtiles_bin, mbtiles_path, pmtiles_path)
    pmtiles_bytes = pmtiles_path.stat().st_size
    result = {
        "ok": True,
        "cityId": city,
        "version": version,
        "transport": "pmtiles",
        "sourceMvtDir": str(input_dir),
        "mbtilesPath": str(mbtiles_path),
        "pmtilesPath": str(pmtiles_path),
        "tileCount": stats["tileCount"],
        "tileBytes": stats["tileBytes"],
        "pmtilesBytes": pmtiles_bytes,
        "bbox": stats["manifest"].get("bbox"),
        "minZoom": stats["manifest"].get("minZoom"),
        "maxZoom": stats["manifest"].get("maxZoom"),
    }
    package_manifest_path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
