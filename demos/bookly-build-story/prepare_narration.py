from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path


def run(command: list[str]) -> None:
    subprocess.run(command, check=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--spec", type=Path, default=Path("narration/cue_cuts.json"))
    parser.add_argument("--raw-dir", type=Path, default=Path("narration/raw"))
    parser.add_argument("--ffmpeg", default="ffmpeg")
    args = parser.parse_args()

    spec = json.loads(args.spec.read_text(encoding="utf-8"))
    source = Path(spec["source"])
    if not source.exists():
        raise SystemExit(f"Narration source not found: {source}")

    args.raw_dir.mkdir(parents=True, exist_ok=True)
    for cue in spec["cues"]:
        output = args.raw_dir / cue["file"]
        duration = cue["end"] - cue["start"]
        command = [
            args.ffmpeg,
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-ss",
            f"{cue['start']:.3f}",
            "-i",
            str(source),
            "-t",
            f"{duration:.3f}",
            "-vn",
            "-ac",
            str(spec["channels"]),
            "-ar",
            str(spec["sample_rate"]),
            "-c:a",
            "pcm_s16le",
            str(output),
        ]
        run(command)
        print(f"wrote {output} ({duration:.3f}s)")


if __name__ == "__main__":
    main()
