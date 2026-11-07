"""
Tests for External Agent CLI Bridge (bin/musicskills).
Verifies JSON contracts and command executions for Claude Code, Codex, and Antigravity.
Strictly zero-emoji.
"""

import json
import os
import subprocess
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


if __name__ == "__main__":
    unittest.main()

