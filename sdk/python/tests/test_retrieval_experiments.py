import unittest
from examples.run_retrieval_experiments import parse_top_k_values

class RetrievalExperimentArgumentTests(unittest.TestCase):
    def test_parses_multiple_top_k_values(self):
        self.assertEqual(parse_top_k_values("2, 4,6"), [2, 4, 6])

    def test_rejects_empty_values(self):
        with self.assertRaises(Exception):
            parse_top_k_values(" , ")

    def test_rejects_non_positive_values(self):
        with self.assertRaises(Exception):
            parse_top_k_values("2,0")

    def test_rejects_duplicates(self):
        with self.assertRaises(Exception):
            parse_top_k_values("2,2")

if __name__ == "__main__":
    unittest.main()
