import importlib.util
import pathlib
import unittest


APP_PATH = pathlib.Path(__file__).resolve().parents[1] / "Layonel_No_IT_CleanArchitecture" / "app.py"
spec = importlib.util.spec_from_file_location("lionel_app", APP_PATH)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ChatRouteTests(unittest.TestCase):
    def setUp(self):
        module.app.config["TESTING"] = True
        self.client = module.app.test_client()

    def test_chat_rejects_empty_message(self):
        response = self.client.post("/chat", json={"mensagem": "   "})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json()["erro"], "Informe uma mensagem válida.")

    def test_chat_handles_day_without_accent(self):
        response = self.client.post("/chat", json={"mensagem": "o que tem na terca?"})

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["source"], "regras")
        self.assertIn("FUNDAMENTOS MATEMÁTICOS PARA COMPUTAÇÃO", payload["resposta"])

    def test_healthcheck(self):
        response = self.client.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {"status": "ok"})


if __name__ == "__main__":
    unittest.main()
