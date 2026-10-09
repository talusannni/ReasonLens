"""Run repeatable top-k retrieval experiments against the bundled document-RAG harness."""
from __future__ import annotations
import argparse
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
HARNESS = ROOT / "sdk" / "python" / "examples" / "document_rag.py"

def parse_top_k_values(raw: str) -> list[int]:
    try:
        values = [int(part.strip()) for part in raw.split(",") if part.strip()]
    except ValueError as exc:
        raise argparse.ArgumentTypeError("top-k values must be comma-separated integers, e.g. 2,4,6") from exc
    if not values or any(value < 1 for value in values):
        raise argparse.ArgumentTypeError("provide one or more positive top-k values")
    if len(set(values)) != len(values):
        raise argparse.ArgumentTypeError("top-k values must not contain duplicates")
    return values

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run retrieval-only experiments and optionally one full Groq-backed run."
    )
    parser.add_argument("--prompt", default=(
        "For an international business trip, what is the hotel reimbursement limit, "
        "what evidence is required, and are minibar expenses reimbursable?"
    ))
    parser.add_argument("--top-k-values", type=parse_top_k_values, default=parse_top_k_values("2,4"),
                        help="Comma-separated top-k settings; each creates a separate trace (default: 2,4).")
    parser.add_argument("--full-run-top-k", type=int, default=None,
                        help="Optionally call Groq once at this top-k value. Must be included in --top-k-values.")
    return parser

def main() -> int:
    args = build_parser().parse_args()
    if args.full_run_top_k is not None and args.full_run_top_k not in args.top_k_values:
        raise SystemExit("--full-run-top-k must be one of --top-k-values")
    if not os.getenv("REASONLENS_INGEST_KEY"):
        raise SystemExit("Set REASONLENS_INGEST_KEY to store experiment traces in ReasonLens.")
    if args.full_run_top_k is not None and not os.getenv("GROQ_API_KEY"):
        raise SystemExit("GROQ_API_KEY is required only when --full-run-top-k is specified.")
    for top_k in args.top_k_values:
        full_run = top_k == args.full_run_top_k
        command = [sys.executable, str(HARNESS), "--prompt", args.prompt, "--top-k", str(top_k)]
        if not full_run:
            command.append("--retrieval-only")
        mode = "FULL RUN (Groq call)" if full_run else "RETRIEVAL ONLY (no LLM call)"
        print(f"\n=== top-k={top_k} | {mode} ===", flush=True)
        subprocess.run(command, cwd=ROOT, env=os.environ.copy(), check=True)
    print("\nExperiment batch complete. Select the resulting traces in ReasonLens Run comparison.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
