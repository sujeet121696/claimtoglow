"""Claim agent and LLM fallback, with fake providers (no network)."""

import os
import unittest
from unittest import mock

from app import llm
from app.claim import clean, parse_claim


class ClaimTest(unittest.TestCase):
    def test_clean_keeps_only_allowed_concerns(self):
        out = clean({"concerns": ["radiance", "glow", "radiance", "texture"], "deadline_days": 28, "rationale": "x"})
        self.assertEqual(out, {"concerns": ["radiance", "texture"], "deadline_days": 28, "rationale": "x"})

    def test_clean_rejects_bad_deadline(self):
        self.assertIsNone(clean({"deadline_days": "two weeks"})["deadline_days"])
        self.assertIsNone(clean({"deadline_days": 0})["deadline_days"])

    def test_parse_claim_uses_the_reply(self):
        fake = lambda system, user: ({"concerns": ["age_spot"], "deadline_days": 14, "rationale": "spots"}, "fake/model")
        out = parse_claim("Dark spots fade in 14 days", complete=fake)
        self.assertEqual((out["concerns"], out["deadline_days"], out["model"]), (["age_spot"], 14, "fake/model"))


class FallbackTest(unittest.TestCase):
    env = {"GROQ_API_KEY": "g", "GEMINI_API_KEY": "m", "LLM_PROVIDERS": "groq,gemini"}

    def test_falls_back_to_next_provider(self):
        def call(provider, key, model, system, user):
            if provider == "groq":
                raise llm.LLMError("quota")
            return 'Sure: {"concerns": []}'
        with mock.patch.dict(os.environ, self.env, clear=True), mock.patch.object(llm, "load_env"):
            reply, used = llm.complete_json("s", "u", call=call)
        self.assertEqual((reply, used), ({"concerns": []}, "gemini/gemini-3.5-flash-lite"))

    def test_all_failing_raises(self):
        def call(*args):
            raise llm.LLMError("down")
        with mock.patch.dict(os.environ, self.env, clear=True), mock.patch.object(llm, "load_env"):
            with self.assertRaises(llm.LLMError):
                llm.complete_json("s", "u", call=call)

    def test_no_keys_raises(self):
        with mock.patch.dict(os.environ, {}, clear=True), mock.patch.object(llm, "load_env"):
            with self.assertRaises(llm.LLMError):
                llm.complete_json("s", "u")


if __name__ == "__main__":
    unittest.main()
