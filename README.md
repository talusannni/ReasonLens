# ReasonLens

**See how an AI answer is built.**

ReasonLens is an open-source, model-agnostic visual explorer for AI reasoning artifacts, evidence and execution. It intentionally does not claim to expose private chain-of-thought. Instead, it visualizes concise, externally explainable structure: claims, evidence, decisions, retrieval, tools and answers.

## MVP

- Interactive reasoning graph
- Clickable nodes with details and metadata
- Observable relationships: supports, contradicts, depends_on, produces, retrieves, calls, answers
- Provider abstraction with a zero-key demo mode
- OpenAI-compatible API adapter
- Local-first architecture
- Latency and token metrics

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

The default `mock` provider requires no API key. For an OpenAI-compatible endpoint, set `REASONLENS_PROVIDER=openai`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `REASONLENS_MODEL`. Ollama can use its OpenAI-compatible endpoint at `http://localhost:11434/v1`.

## Architecture

`Prompt -> Provider -> Structured Trace -> Reasoning Graph -> Explorer`

## Roadmap

1. Trace ingestion SDK
2. OpenTelemetry adapter
3. RAG retrieval/evidence view
4. Agent/tool execution view
5. Model-vs-model comparison
6. Evaluation: unsupported claims, contradictions and evidence coverage
7. Persistent traces and team features

## License

Apache-2.0.
