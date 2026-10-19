import unittest

from app.nodes.llm import compose_local_podcast_script
from app.nodes.common import read_pitch_hz, read_rate_percent, read_temperature, to_spoken_text


class TextHelpersTests(unittest.TestCase):
    def test_markdown_is_removed_from_spoken_text(self) -> None:
        raw = "# 标题\n\n**大家好**，这里是播客。\n- 第一点\n- 第二点 🎙️"
        spoken = to_spoken_text(raw)
        self.assertNotIn("#", spoken)
        self.assertNotIn("**", spoken)
        self.assertNotIn("🎙️", spoken)
        self.assertIn("大家好", spoken)

    def test_local_script_is_always_audio_ready(self) -> None:
        script, detail = compose_local_podcast_script("为什么晚上适合听播客")
        self.assertGreater(len(script), 180)
        self.assertIn("为什么晚上适合听播客", script)
        self.assertIn("本地口播", detail)

    def test_local_script_keeps_existing_long_script(self) -> None:
        source = "大家好，欢迎收听。这是一段已经写好的长口播稿。" * 10
        script, _ = compose_local_podcast_script(source)
        self.assertTrue(script.startswith("大家好"))
        self.assertLessEqual(len(script), 2400)

    def test_numeric_settings_are_clamped(self) -> None:
        self.assertEqual(read_temperature(9), 1.5)
        self.assertEqual(read_rate_percent(-100), -30)
        self.assertEqual(read_pitch_hz(999), 50)


if __name__ == "__main__":
    unittest.main()
