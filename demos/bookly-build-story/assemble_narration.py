from __future__ import annotations

import json
import wave
from array import array
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SEGMENTS_PATH = ROOT / "voiceover_segments.json"
CUTS_PATH = ROOT / "narration" / "cue_cuts.json"
RAW_DIR = ROOT / "narration" / "raw"
OUTPUT_PATH = ROOT / "narration" / "voiceover_raw.wav"
TOTAL_SECONDS = 240.0


def read_pcm16_mono(path: Path) -> tuple[int, array]:
    with wave.open(str(path), "rb") as handle:
        if handle.getnchannels() != 1:
            raise ValueError(f"{path.name}: expected mono audio")
        if handle.getsampwidth() != 2:
            raise ValueError(f"{path.name}: expected 16-bit PCM")
        rate = handle.getframerate()
        samples = array("h")
        samples.frombytes(handle.readframes(handle.getnframes()))
    return rate, samples


def main() -> None:
    segments = json.loads(SEGMENTS_PATH.read_text(encoding="utf-8"))
    cuts = json.loads(CUTS_PATH.read_text(encoding="utf-8"))["cues"]
    if len(segments) != len(cuts):
        raise ValueError("Cue count mismatch between timeline and approved cuts")

    sample_rate = 48_000
    master = array("h", [0]) * round(TOTAL_SECONDS * sample_rate)
    previous_end = 0

    for index, (segment, cut) in enumerate(zip(segments, cuts, strict=True), start=1):
        cue_path = RAW_DIR / cut["file"]
        rate, cue_samples = read_pcm16_mono(cue_path)
        if rate != sample_rate:
            raise ValueError(f"{cue_path.name}: expected {sample_rate} Hz, got {rate} Hz")

        start = round(float(segment["start_seconds"]) * sample_rate)
        end = start + len(cue_samples)
        if start < previous_end:
            raise ValueError(f"Cue {index} overlaps the preceding cue")
        if end > len(master):
            raise ValueError(f"Cue {index} exceeds the 4:00 master")

        master[start:end] = cue_samples
        previous_end = end
        expected_end = round(float(segment["end_seconds"]) * sample_rate)
        # The cue compiler rounds scene padding to video frames, so the cue's
        # scheduled end can include a few milliseconds of intentional room tone.
        if abs(end - expected_end) > round(0.05 * sample_rate):
            raise ValueError(
                f"Cue {index} duration mismatch: audio ends at {end / sample_rate:.3f}s, "
                f"timeline expects {expected_end / sample_rate:.3f}s"
            )

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUTPUT_PATH), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(sample_rate)
        handle.writeframes(master.tobytes())

    peak = max(abs(value) for value in master)
    print(f"Wrote {OUTPUT_PATH}")
    print(f"Duration: {len(master) / sample_rate:.3f}s")
    print(f"Peak PCM: {peak} ({peak / 32767:.4f})")


if __name__ == "__main__":
    main()
