"""
Unit Tests for LRCLIB Integration Client
Strictly zero-emoji compliant.
"""

from unittest.mock import MagicMock, patch
import pytest
from scripts.lrclib_client import fetch_lyrics, get_lrclib_record, search_lrclib, USER_AGENT


class TestLRCLibClient:
    def test_user_agent_format(self):
        """Ensures compliance with LRCLIB client identification requirements."""
        assert "MusicSkills-Studio" in USER_AGENT
        assert "https://github.com/Aarav90-cpu/MusicSkills" in USER_AGENT

    @patch("urllib.request.urlopen")
    def test_search_lrclib_success(self, mock_urlopen):
        """Verifies parsing of search results from LRCLIB."""
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.read.return_value = b'[{"trackName": "Are We Still Here", "artistName": "ARK", "syncedLyrics": "[00:10.00]Line 1"}]'
        mock_urlopen.return_value.__enter__.return_value = mock_response

        results = search_lrclib("Are We Still Here")
        assert len(results) == 1
        assert results[0]["trackName"] == "Are We Still Here"
        assert results[0]["artistName"] == "ARK"

    @patch("urllib.request.urlopen")
    def test_fetch_lyrics_prefers_synced(self, mock_urlopen):
        """Ensures synced lyrics are prioritized over plain text lyrics."""
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.read.return_value = (
            b'['
            b'{"trackName": "Song", "plainLyrics": "Plain only"},'
            b'{"trackName": "Song", "syncedLyrics": "[00:05.00]Synced lyrics"}'
            b']'
        )
        mock_urlopen.return_value.__enter__.return_value = mock_response

        record = fetch_lyrics(title="Song")
        assert record is not None
        assert record.get("syncedLyrics") == "[00:05.00]Synced lyrics"

