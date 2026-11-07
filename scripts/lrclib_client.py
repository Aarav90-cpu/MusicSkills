"""
MusicSkills Studio - LRCLIB Integration Client
Command-line utility and Python module to query https://lrclib.net for
synchronized (.lrc) lyrics and plain text baselines.
Strictly zero-emoji compliant.
"""

import argparse
import json
import os
import sys
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional


USER_AGENT = "MusicSkills-Studio/1.0.0 (https://github.com/Aarav90-cpu/MusicSkills)"
BASE_URL = "https://lrclib.net/api"


def search_lrclib(query: str) -> List[Dict[str, Any]]:
    """Searches LRCLIB by query keyword."""
    encoded_query = urllib.parse.quote(query.strip())
    url = f"{BASE_URL}/search?q={encoded_query}"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Lrclib-Client": USER_AGENT})

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status == 200:
                data = json.loads(response.read().decode("utf-8"))
                return data if isinstance(data, list) else []
    except Exception as e:
        print(f"[LRCLIB] Search failed for query '{query}': {e}", file=sys.stderr)
    return []


def get_lrclib_record(
    track_name: str,
    artist_name: str,
    album_name: Optional[str] = None,
    duration: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    """Retrieves exact match record from LRCLIB get endpoint."""
    params: Dict[str, str] = {
        "track_name": track_name.strip(),
        "artist_name": artist_name.strip(),
    }
    if album_name:
        params["album_name"] = album_name.strip()
    if duration and duration > 0:
        params["duration"] = str(int(duration))

    query_str = urllib.parse.urlencode(params)
    url = f"{BASE_URL}/get?{query_str}"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Lrclib-Client": USER_AGENT})

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status == 200:
                return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code == 404:
            # Fall back to search
            results = search_lrclib(f"{track_name} {artist_name}")
            return results[0] if results else None
    except Exception as e:
        print(f"[LRCLIB] Exact fetch failed: {e}", file=sys.stderr)

    return None


def fetch_lyrics(
    title: str,
    artist: Optional[str] = None,
    album: Optional[str] = None,
    duration: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    """High-level lyrics fetch prioritizing synchronized timing."""
    if artist:
        rec = get_lrclib_record(title, artist, album, duration)
        if rec:
            return rec

    search_query = f"{title} {artist}" if artist else title
    records = search_lrclib(search_query)
    if not records:
        return None

    # Prefer record with syncedLyrics
    for r in records:
        if r.get("syncedLyrics"):
            return r

    return records[0]


def main():
    parser = argparse.ArgumentParser(description="LRCLIB Synchronized Lyrics Client")
    parser.add_argument("query", nargs="?", default="", help="Song search query or title")
    parser.add_argument("--artist", default=None, help="Artist or band name")
    parser.add_argument("--track", default=None, help="Explicit track title")
    parser.add_argument("--album", default=None, help="Album name")
    parser.add_argument("--duration", type=int, default=None, help="Track duration in seconds")
    parser.add_argument("--save-lrc", default=None, help="File path to save .lrc lyrics")
    parser.add_argument("--json", action="store_true", help="Output raw JSON data")

    args = parser.parse_args()

    title = args.track or args.query
    if not title:
        parser.print_help()
        sys.exit(1)

    print(f"[MusicSkills] Querying LRCLIB for: '{title}'" + (f" by {args.artist}" if args.artist else ""))
    record = fetch_lyrics(title=title, artist=args.artist, album=args.album, duration=args.duration)

    if not record:
        print(f"No lyrics found on LRCLIB for '{title}'.")
        sys.exit(1)

    if args.json:
        print(json.dumps(record, indent=2))
        return

    print("\n--- Track Information ---")
    print(f"Title:  {record.get('trackName')}")
    print(f"Artist: {record.get('artistName')}")
    print(f"Album:  {record.get('albumName') or 'N/A'}")
    print(f"Synced: {'Yes' if record.get('syncedLyrics') else 'No (Plain text only)'}")

    lyrics_content = record.get("syncedLyrics") or record.get("plainLyrics") or ""

    if args.save_lrc:
        os.makedirs(os.path.dirname(os.path.abspath(args.save_lrc)), exist_ok=True)
        with open(args.save_lrc, "w", encoding="utf-8") as f:
            f.write(lyrics_content)
        print(f"\nSaved lyrics to: {args.save_lrc}")
    else:
        print("\n--- Lyrics Preview ---")
        lines = lyrics_content.splitlines()[:12]
        print("\n".join(lines))
        if len(lyrics_content.splitlines()) > 12:
            print(f"... ({len(lyrics_content.splitlines()) - 12} more lines)")


if __name__ == "__main__":
    main()

