import unittest

from examples.document_rag import retrieve


class DocumentRagRetrievalTests(unittest.TestCase):
    def test_retrieve_ranks_matching_chunks_and_respects_top_k(self):
        documents = [
            {"id": "unrelated", "title": "Shipping", "content": "delivery parcels transit"},
            {"id": "policy-a", "title": "Refund", "content": "refund policy within 30 days"},
            {"id": "policy-b", "title": "Refund details", "content": "refund within 14 days under exception"},
        ]
        results = retrieve("refund policy 30 days", documents, top_k=1)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["id"], "policy-a")
        self.assertEqual(results[0]["metadata"]["rank"], 1)
        self.assertGreater(results[0]["metadata"]["score"], 0)

    def test_no_matching_chunks_returns_empty_list(self):
        self.assertEqual(
            retrieve("security encryption", [
                {"id": "refund", "title": "Refund", "content": "refund within 30 days"}
            ], top_k=3),
            [],
        )


if __name__ == "__main__":
    unittest.main()
