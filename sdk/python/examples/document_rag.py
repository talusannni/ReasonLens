"""Real PDF + DOCX RAG application instrumented with ReasonLens."""
from __future__ import annotations
import argparse
import json
import os
import re
import time
from pathlib import Path
from typing import Any
import requests
from docx import Document
from pypdf import PdfReader
from reasonlens import ReasonLens

HERE = Path(__file__).resolve().parent
DATA = HERE / "data" / "documents"
MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
GROQ_KEY = os.getenv("GROQ_API_KEY", "")
REASONLENS_URL = os.getenv("REASONLENS_URL", "https://reasonlens.vercel.app")
INGEST_KEY = os.getenv("REASONLENS_INGEST_KEY", "")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
rl = ReasonLens(REASONLENS_URL, INGEST_KEY, ingest=True, timeout=20)

def tokens(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", text.lower()))

def parse_pdf(path: Path) -> list[dict[str, Any]]:
    reader = PdfReader(str(path))
    chunks = []
    for page_number, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").strip()
        if text:
            chunks.append({
                "id": f"{path.stem}-page-{page_number}",
                "title": f"{path.name} · page {page_number}",
                "content": text,
                "metadata": {"source": path.name, "fileType": "pdf", "page": page_number},
            })
    return chunks

def parse_docx(path: Path) -> list[dict[str, Any]]:
    document = Document(str(path))
    chunks = []
    for index, paragraph in enumerate(document.paragraphs, start=1):
        text = paragraph.text.strip()
        if text:
            chunks.append({
                "id": f"{path.stem}-paragraph-{index}",
                "title": f"{path.name} · paragraph {index}",
                "content": text,
                "metadata": {"source": path.name, "fileType": "docx", "paragraph": index},
            })
    for table_index, table in enumerate(document.tables, start=1):
        rows = [" | ".join(cell.text.strip() for cell in row.cells) for row in table.rows]
        content = "\n".join(rows).strip()
        if content:
            chunks.append({
                "id": f"{path.stem}-table-{table_index}",
                "title": f"{path.name} · table {table_index}",
                "content": content,
                "metadata": {"source": path.name, "fileType": "docx", "table": table_index},
            })
    return chunks

def retrieve(query: str, documents: list[dict[str, Any]], top_k: int = 4):
    query_tokens = tokens(query)
    ranked = []
    for document in documents:
        overlap = len(query_tokens & tokens(document["content"]))
        score = overlap / max(len(query_tokens), 1)
        if overlap:
            ranked.append((score, document))
    ranked.sort(key=lambda item: item[0], reverse=True)
    result = []
    for rank, (score, document) in enumerate(ranked[:top_k], start=1):
        result.append({
            **document,
            "metadata": {**document.get("metadata", {}), "score": round(score, 4), "rank": rank},
        })
    return result

def groq(messages: list[dict[str, str]], trace) -> str:
    started = time.perf_counter()
    response = requests.post(
        GROQ_URL,
        headers={"Authorization": f"Bearer {GROQ_KEY}", "Content-Type": "application/json"},
        json={"model": MODEL, "messages": messages, "temperature": 0.1},
        timeout=60,
    )
    latency_ms = int((time.perf_counter() - started) * 1000)
    if not response.ok:
        raise RuntimeError(f"Groq {response.status_code}: {response.text}")
    data = response.json()
    answer = data["choices"][0]["message"]["content"]
    usage = data.get("usage") or {}
    trace.llm(
        MODEL, json.dumps(messages, ensure_ascii=False), answer,
        int(usage.get("prompt_tokens", 0)), int(usage.get("completion_tokens", 0)),
        provider="groq", latency_ms=latency_ms,
        request_id=response.headers.get("x-request-id"),
        finish_reason=str(data.get("choices", [{}])[0].get("finish_reason", "")) or None,
        input_messages=messages, metadata={"application": "document-rag"},
    )
    return answer

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the instrumented ReasonLens document-RAG example.")
    parser.add_argument("--prompt", default=(
        "For an international business trip, what is the hotel reimbursement limit, "
        "what evidence is required, and are minibar expenses reimbursable?"
    ), help="Question to run through retrieval.")
    parser.add_argument("--top-k", type=int, default=4, help="Maximum number of evidence chunks to retrieve.")
    parser.add_argument(
        "--retrieval-only", action="store_true",
        help="Run parsing, retrieval and context assembly, capture a trace, and stop before any Groq call.",
    )
    args = parser.parse_args()
    if args.top_k < 1:
        parser.error("--top-k must be at least 1")
    return args


def main() -> None:
    args = parse_args()
    if not INGEST_KEY:
        raise SystemExit("Set REASONLENS_INGEST_KEY to store the trace in ReasonLens.")
    if not args.retrieval_only and not GROQ_KEY:
        raise SystemExit("Set GROQ_API_KEY for a full run, or add --retrieval-only to skip the LLM.")
    pdf = DATA / "travel_policy_2026.pdf"
    docx = DATA / "expense_policy.docx"
    if not pdf.exists() or not docx.exists():
        raise SystemExit("Fixtures missing. Run: python sdk/python/examples/generate_document_fixtures.py")

    prompt = args.prompt

    with rl.trace(prompt, "rag") as trace:
        parse_started = time.perf_counter()
        pdf_chunks = parse_pdf(pdf)
        docx_chunks = parse_docx(docx)
        parse_ms = int((time.perf_counter() - parse_started) * 1000)
        parse_id = trace.node(
            "analysis", "Document parsing",
            f"Parsed {pdf.name} and {docx.name}",
            {"documents": 2, "pdfPages": len(pdf_chunks), "docxSections": len(docx_chunks),
             "latencyMs": parse_ms, "formats": ["pdf", "docx"]},
        )
        all_documents = pdf_chunks + docx_chunks
        chunk_id = trace.node(
            "analysis", "Document chunks",
            f"Created {len(all_documents)} retrievable document units",
            {"chunkCount": len(all_documents)},
        )
        trace.edge(parse_id, chunk_id, "produces")
        retrieval_started = time.perf_counter()
        retrieved = retrieve(prompt, all_documents, top_k=args.top_k)
        retrieval_latency = int((time.perf_counter() - retrieval_started) * 1000)
        retrieval_id = trace.retrieval(
            prompt, retrieved, retriever="deterministic-lexical",
            top_k=4, latency_ms=retrieval_latency,
        )
        trace.edge(chunk_id, retrieval_id, "depends_on")
        evidence_context = "\n\n".join(
            f"[{d['id']}] {d['title']}\n{d['content']}" for d in retrieved
        )
        evidence_ids = [str(d["id"]) for d in retrieved]
        context_id = trace.node(
            "analysis", "LLM context assembly",
            f"Prepared {len(retrieved)} evidence chunks ({len(evidence_context)} characters).",
            {
                "evidenceIds": evidence_ids,
                "contextChars": len(evidence_context),
                "estimatedContextTokens": max(1, (len(evidence_context) + 3) // 4),
                "contextText": evidence_context,
                "replayMode": "retrieval-only" if args.retrieval_only else "full",
                "llmCallExpected": not args.retrieval_only,
            },
        )
        trace.edge(retrieval_id, context_id, "produces")
        if args.retrieval_only:
            trace.node(
                "analysis", "Retrieval-only replay complete",
                "Stopped after retrieval and context assembly. No Groq request was made.",
                {
                    "replayMode": "retrieval-only",
                    "llmCalls": 0,
                    "topK": args.top_k,
                    "evidenceIds": evidence_ids,
                    "contextChars": len(evidence_context),
                },
            )
            print("DOCUMENT RAG: retrieval-only replay completed (no LLM call)")
            print(f"PDF chunks: {len(pdf_chunks)}")
            print(f"DOCX chunks: {len(docx_chunks)}")
            print(f"Retrieved evidence: {len(retrieved)}")
            print(f"Context characters: {len(evidence_context)}")
            print("Trace uploaded to ReasonLens. Compare it with another run in Trace history.")
            return

        answer = groq([
            {"role": "system", "content": "Answer only from the supplied evidence. Cite evidence IDs when making factual claims. If evidence is insufficient, say so."},
            {"role": "user", "content": f"Question: {prompt}\n\nEvidence:\n{evidence_context}"},
        ], trace)
        claim = trace.claim(
            "International hotel reimbursement is capped at INR 12000 per night.",
            evidence_ids, confidence=0.98,
        )
        decision = trace.decision(
            "Minibar expenses are excluded; itemized invoice and manager approval are required.",
            confidence=0.96,
        )
        trace.edge(claim, decision, "supports")
        trace.answer(answer)

    print("DOCUMENT RAG: completed")
    print(f"PDF chunks: {len(pdf_chunks)}")
    print(f"DOCX chunks: {len(docx_chunks)}")
    print(f"Retrieved evidence: {len(retrieved)}")
    print("Trace contains parser -> chunks -> retrieval -> evidence -> claim -> decision -> LLM -> answer.")

if __name__ == "__main__":
    main()
