import unittest

from reasonlens import ReasonLens


class TraceContextTests(unittest.TestCase):
    def setUp(self):
        self.rl = ReasonLens("http://example.invalid", ingest=False)

    def test_retrieval_evidence_nodes_are_independent(self):
        with self.rl.trace("find refund policy", "rag") as trace:
            retrieval_id = trace.retrieval(
                "refund policy",
                [
                    {"id": "doc-a", "title": "Policy A", "content": "Refunds within 30 days."},
                    {"id": "doc-b", "title": "Policy B", "content": "Shipping takes 3 days."},
                ],
                retriever="test",
                top_k=2,
            )
            trace.answer("Refunds are allowed within 30 days.")

        self.assertEqual(retrieval_id, trace.nodes[1]["id"])
        evidence_edges = [
            edge for edge in trace.edges
            if edge["kind"] == "retrieves"
        ]
        self.assertEqual(
            {(edge["source"], edge["target"]) for edge in evidence_edges},
            {(retrieval_id, "doc-a"), (retrieval_id, "doc-b")},
        )

        dependency_targets = {
            edge["target"]
            for edge in trace.edges
            if edge["kind"] == "depends_on"
        }
        self.assertNotIn("doc-a", dependency_targets)
        self.assertNotIn("doc-b", dependency_targets)

    def test_groq_cost_is_aggregated(self):
        with self.rl.trace("cost", "chat") as trace:
            trace.llm(
                "openai/gpt-oss-120b",
                "input",
                "output",
                input_tokens=1_000,
                output_tokens=2_000,
                provider="groq",
            )
            result = trace.finish()

        expected = (1000 / 1_000_000 * 0.15) + (2000 / 1_000_000 * 0.60)
        self.assertAlmostEqual(result["metrics"]["estimatedCostUsd"], expected, places=12)
        self.assertEqual(result["metrics"]["inputTokens"], 1000)
        self.assertEqual(result["metrics"]["outputTokens"], 2000)

    def test_exception_marks_trace_failed(self):
        trace = None
        with self.assertRaises(RuntimeError):
            with self.rl.trace("failure", "agent") as current:
                trace = current
                raise RuntimeError("expected test failure")

        self.assertIsNotNone(trace)
        self.assertEqual(trace.status, "failed")
        self.assertTrue(any(node["kind"] == "warning" for node in trace.nodes))


if __name__ == "__main__":
    unittest.main()
