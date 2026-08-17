from __future__ import annotations

import argparse
import json
from pathlib import Path

from faster_whisper import WhisperModel


def stamp(seconds: float) -> str:
    minutes, remainder = divmod(seconds, 60)
    return f"{int(minutes):02d}:{remainder:06.3f}"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("audio", type=Path)
    parser.add_argument("--output-dir", type=Path, default=Path("narration"))
    parser.add_argument("--model", default="large-v3-turbo")
    parser.add_argument("--device", default="cuda")
    parser.add_argument("--compute-type", default="float16")
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    model = WhisperModel(args.model, device=args.device, compute_type=args.compute_type)
    stream, info = model.transcribe(
        str(args.audio),
        language="en",
        beam_size=5,
        word_timestamps=True,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 300},
        condition_on_previous_text=False,
    )

    segments = []
    for segment in stream:
        segments.append(
            {
                "id": segment.id,
                "start": round(segment.start, 3),
                "end": round(segment.end, 3),
                "text": segment.text.strip(),
                "avg_logprob": segment.avg_logprob,
                "no_speech_prob": segment.no_speech_prob,
                "words": [
                    {
                        "start": round(word.start, 3),
                        "end": round(word.end, 3),
                        "word": word.word,
                        "probability": word.probability,
                    }
                    for word in (segment.words or [])
                ],
            }
        )

    payload = {
        "source": str(args.audio.resolve()),
        "model": args.model,
        "device": args.device,
        "language": info.language,
        "language_probability": info.language_probability,
        "duration": info.duration,
        "duration_after_vad": info.duration_after_vad,
        "segments": segments,
    }
    (args.output_dir / "transcript_raw.json").write_text(
        json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    lines = [
        "# Raw narration transcript",
        "",
        f"- Source: `{payload['source']}`",
        f"- Model: `{args.model}`",
        f"- Duration: {payload['duration']:.3f} seconds",
        "",
        "| Time | Transcript |",
        "|---|---|",
    ]
    for segment in segments:
        text = segment["text"].replace("|", "\\|")
        lines.append(f"| {stamp(segment['start'])}–{stamp(segment['end'])} | {text} |")
    (args.output_dir / "transcript_raw.md").write_text(
        "\n".join(lines) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
