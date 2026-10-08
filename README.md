# ReasonLens

**See how AI reaches an answer.**

ReasonLens is a model-agnostic, local-first visual debugger for AI systems. It focuses on observable, externally explainable execution artifacts rather than private chain-of-thought.

## What works now

- Workspace with chat, RAG and agent trace modes
- Interactive execution graph
- Evidence and retrieval nodes for RAG workflows
- Tool-call nodes for agent workflows
- Claims, decisions and answer relationships
- Node inspector with metadata
- Trace metrics: latency and token counts
- Local browser trace history
- Search trace history
- Import/export trace JSON
- Zero-key demo engine
- OpenAI-compatible and Ollama-compatible provider
- Responsive desktop/mobile UI
- GitHub Actions typecheck/build validation

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000.

For the demo engine, no API key is required. For an OpenAI-compatible provider configure:

```env
REASONLENS_PROVIDER=openai
REASONLENS_MODEL=<your-model>
OPENAI_API_KEY=<your-key>
OPENAI_BASE_URL=https://api.openai.com/v1
```

Ollama can use `OPENAI_BASE_URL=http://localhost:11434/v1`.

## Architecture

```text
User prompt
    |
    v
Trace API
    |
    +--> Provider adapter --> Structured trace
    |
    +--> Demo scenarios (chat / RAG / agent)
                              |
                              v
                     ReasonLens graph
                              |
              +---------------+---------------+
              |               |               |
           evidence        tools          decisions
              |               |               |
              +---------------+---------------+
                              |
                              v
                         Final answer
```

## Important boundary

ReasonLens does not attempt to expose hidden model chain-of-thought. It displays structured traces, evidence, tool execution, claims and decisions that can be intentionally produced and reviewed.

## Roadmap

- SDK for instrumenting applications
- OpenTelemetry trace ingestion
- Live streaming traces
- Real RAG connector ingestion
- Agent framework adapters
- Unsupported-claim and evidence-coverage evaluation
- Model comparison and regression evaluation
- Persistent multi-user trace storage

## License

Apache-2.0.
