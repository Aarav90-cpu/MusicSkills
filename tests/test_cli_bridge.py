"""
Tests for External Agent CLI Bridge (bin/musicskills).
Verifies JSON contracts and command executions for Claude Code, Codex, and Antigravity.
Strictly zero-emoji.
"""

import json
import os
import subprocess
import tempfile
import unittest

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CLI_PATH = os.path.join(ROOT_DIR, "bin", "musicskills")


class TestCliBridge(unittest.TestCase):

    def test_cli_help(self):
        """Verifies that the CLI help documentation renders cleanly with usage instructions."""
        res = subprocess.run(
            [CLI_PATH, "--help"],
            cwd=ROOT_DIR,
            capture_output=True,
            text=True,
            check=True,
        )
        self.assertIn("MusicSkills External Agent CLI", res.stdout)
        self.assertIn("new-project", res.stdout)
        self.assertIn("generate", res.stdout)
        self.assertIn("status", res.stdout)

    def test_cli_status_json(self):
        """Verifies that musicskills status --json produces valid parseable machine JSON."""
        res = subprocess.run(
            [CLI_PATH, "status", "--json"],
            cwd=ROOT_DIR,
            capture_output=True,
            text=True,
            check=True,
        )
        data = json.loads(res.stdout)
        self.assertEqual(data.get("status"), "ready")
        self.assertIn("soundfontPath", data)
        self.assertIn("projectsCount", data)
        self.assertIn("activeProvider", data)
        self.assertTrue(data.get("cliAgentReady"))

    def test_cli_list_json(self):
        """Verifies that musicskills list --json returns a valid JSON array of projects."""
        res = subprocess.run(
            [CLI_PATH, "list", "--json"],
            cwd=ROOT_DIR,
            capture_output=True,
            text=True,
            check=True,
        )
        projects = json.loads(res.stdout)
        self.assertIsInstance(projects, list)
        if len(projects) > 0:
            first = projects[0]
            self.assertIn("id", first)
            self.assertIn("name", first)
            self.assertIn("genre", first)
            self.assertIn("bpm", first)

    def test_cli_show_json(self):
        """Verifies that musicskills show --id <id> --json outputs comprehensive project metadata."""
        list_res = subprocess.run(
            [CLI_PATH, "list", "--json"],
            cwd=ROOT_DIR,
            capture_output=True,
            text=True,
            check=True,
        )
        projects = json.loads(list_res.stdout)
        if len(projects) > 0:
            target_id = projects[0]["id"]
            show_res = subprocess.run(
                [CLI_PATH, "show", "--id", target_id, "--json"],
                cwd=ROOT_DIR,
                capture_output=True,
                text=True,
                check=True,
            )
            chat = json.loads(show_res.stdout)
            self.assertEqual(chat.get("id"), target_id)
            self.assertIn("style", chat)
            self.assertIn("lyrics", chat)
            self.assertIn("versions", chat)

    def test_cli_publish_lyrics_rejected_without_embedded(self):
        """Verifies that publishing to LRCLIB is strictly rejected when audio has no embedded lyrics."""
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tf:
            tf.write(b"\xFF\xFB\x90\x00" * 50)
            tmp_path = tf.name

        try:
            res = subprocess.run(
                [CLI_PATH, "publish-lyrics", "--audio", tmp_path, "--json"],
                cwd=ROOT_DIR,
                capture_output=True,
                text=True,
            )
            self.assertNotEqual(res.returncode, 0)
            data = json.loads(res.stdout)
            self.assertFalse(data.get("success"))
            self.assertFalse(data.get("isEmbeddedVerified"))
            self.assertIn("LRCLIB upload is restricted strictly to embedded lyrics", data.get("error", ""))
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    def test_cli_publish_lyrics_with_embedded_dry_run(self):
        """Verifies that audio files with embedded ID3 USLT lyrics pass strict verification."""
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tf:
            lyrics_text = "Midnight city lights are shining bright\nWe keep moving into the light"
            encoding = b"\x00"
            lang = b"eng"
            desc = b"\x00"
            lyrics_bytes = lyrics_text.encode("latin-1")
            frame_body = encoding + lang + desc + lyrics_bytes
            frame_id = b"USLT"
            frame_size = len(frame_body).to_bytes(4, byteorder="big")
            frame_flags = b"\x00\x00"
            frame = frame_id + frame_size + frame_flags + frame_body

            tag_size_val = len(frame)
            b0 = (tag_size_val >> 21) & 0x7F
            b1 = (tag_size_val >> 14) & 0x7F
            b2 = (tag_size_val >> 7) & 0x7F
            b3 = tag_size_val & 0x7F
            header = b"ID3\x03\x00\x00" + bytes([b0, b1, b2, b3])
            tf.write(header + frame + b"\xFF\xFB\x90\x00" * 10)
            tmp_path = tf.name

        try:
            res = subprocess.run(
                [
                    CLI_PATH,
                    "publish-lyrics",
                    "--audio",
                    tmp_path,
                    "--title",
                    "Midnight City Lights",
                    "--artist",
                    "Aarav",
                    "--dry-run",
                    "--json",
                ],
                cwd=ROOT_DIR,
                capture_output=True,
                text=True,
            )
            self.assertEqual(res.returncode, 0)
            data = json.loads(res.stdout)
            self.assertTrue(data.get("success"))
            self.assertTrue(data.get("dryRun"))
            self.assertTrue(data.get("isEmbeddedVerified"))
            self.assertEqual(data.get("trackName"), "Midnight City Lights")
            self.assertEqual(data.get("artistName"), "Aarav")
            self.assertGreater(data.get("plainLyricsLength", 0), 0)
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)


if __name__ == "__main__":
    unittest.main()

