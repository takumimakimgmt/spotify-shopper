#!/usr/bin/env python3
"""
Spotify プレイリストを取得して、
- プレイリスト基本情報
- 各トラック情報（タイトル / アーティスト / アルバム / ISRC / Spotify URL）
- Beatport / Bandcamp / iTunes 検索リンク

を Python 辞書で返すコアモジュール。
"""

from __future__ import annotations

import os
import re
import urllib.parse
from typing import Any, Dict, List

import spotipy
from spotipy.oauth2 import SpotifyClientCredentials


# =========================
# Spotify クライアント
# =========================


def get_spotify_client() -> spotipy.Spotify:
    """
    環境変数から Spotify API のクレデンシャルを読み込み、
    Spotipy クライアントを返す。

    必要な環境変数:
    - SPOTIFY_CLIENT_ID
    - SPOTIFY_CLIENT_SECRET
    """
    client_id = os.getenv("SPOTIFY_CLIENT_ID")
    client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")

    if not client_id or not client_secret:
        raise RuntimeError(
            "Spotify client credentials are not set. "
            "Please set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET."
        )

    auth_manager = SpotifyClientCredentials(
        client_id=client_id,
        client_secret=client_secret,
    )
    return spotipy.Spotify(auth_manager=auth_manager)


# =========================
# プレイリストID抽出
# =========================


def extract_playlist_id(url_or_id: str) -> str:
    """
    Spotifyプレイリストの「URL / URI / ID」全部OKで受けて、
    正しい 22文字のID だけ取り出す。

    例：
    - https://open.spotify.com/playlist/0ZzPDztlFcDLdLbBa7hOks?si=... → 0ZzPDztlFcDLdLbBa7hOks
    - spotify:playlist:0ZzPDztlFcDLdLbBa7hOks                     → 0ZzPDztlFcDLdLbBa7hOks
    - 0ZzPDztlFcDLdLbBa7hOks                                      → 0ZzPDztlFcDLdLbBa7hOks
    """
    s = (url_or_id or "").strip()

    # 1) まずは「ふつうのURL」としてパースしてみる
    try:
        parsed = urllib.parse.urlparse(s)
        if parsed.scheme and parsed.netloc:
            # 例: /playlist/0ZzPDztlFcDLdLbBa7hOks
            parts = parsed.path.rstrip("/").split("/")
            if parts:
                cand = parts[-1]
                if re.fullmatch(r"[A-Za-z0-9]{22}", cand):
                    return cand
    except Exception:
        # URLとしてパースできなくても無視
        pass

    # 2) spotify:playlist:xxxxxx や /playlist/xxxxxx 形式から抜く
    m = re.search(r"(?:playlist[/:])([A-Za-z0-9]{22})", s)
    if m:
        return m.group(1)

    # 3) すでにIDだけが渡されているケース
    if re.fullmatch(r"[A-Za-z0-9]{22}", s):
        return s

    # どれにも当てはまらない場合はエラーにする
    raise ValueError(f"Invalid Spotify playlist URL or ID: {url_or_id}")


# =========================
# ストア検索リンク生成
# =========================


def build_search_query(title: str, artist: str, album: str | None = None) -> str:
    """
    ストア検索用のベースクエリを作る。
    一旦シンプルに「タイトル + アーティスト (+ アルバム)」で。
    """
    parts = [title.strip(), artist.strip()]
    if album:
        parts.append(album.strip())
    return " ".join(p for p in parts if p)


def build_store_links(title: str, artist: str, album: str | None = None) -> Dict[str, str]:
    """
    Beatport / Bandcamp / iTunes (Apple Music) の検索リンクを生成。
    """
    query = build_search_query(title, artist, album)
    q = urllib.parse.quote_plus(query)

    beatport = f"https://www.beatport.com/search?q={q}"
    bandcamp = f"https://bandcamp.com/search?q={q}"
    itunes = f"https://music.apple.com/search?term={q}"

    return {
        "beatport": beatport,
        "bandcamp": bandcamp,
        "itunes": itunes,
    }


# =========================
# プレイリスト取得
# =========================


def fetch_playlist_tracks(url_or_id: str) -> Dict[str, Any]:
    """
    Spotifyプレイリストを取得して、
    - playlist: プレイリストメタデータ
    - items: トラック項目（全件）

    の形で返す。

    ここでは Spotipy の生のレスポンスをちょっとだけ整形するレベルに留める。
    実際に使いやすい dict への変換は playlist_result_to_dict() で行う。
    """
    playlist_id = extract_playlist_id(url_or_id)
    sp = get_spotify_client()

    # プレイリストメタ情報
    playlist = sp.playlist(
        playlist_id,
        fields="id,name,external_urls",
    )

    # トラック全件（100曲以上にも対応）
    items: List[Dict[str, Any]] = []
    results = sp.playlist_tracks(playlist_id, limit=100, offset=0)
    items.extend(results.get("items", []))

    while results.get("next"):
        results = sp.next(results)
        items.extend(results.get("items", []))

    return {
        "playlist": playlist,
        "items": items,
    }


# =========================
# フロント/CLI向けのフラットな dict に変換
# =========================


def playlist_result_to_dict(raw: Dict[str, Any]) -> Dict[str, Any]:
    """
    fetch_playlist_tracks() の結果（raw dict）を、
    フロントエンドや CLI 用に扱いやすい形の dict に変換する。

    戻り値フォーマット:
    {
      "playlist_id": str,
      "playlist_name": str,
      "playlist_url": str,
      "tracks": [
        {
          "title": str,
          "artist": str,
          "album": str,
          "isrc": str | None,
          "spotify_url": str,
          "links": {
            "beatport": str,
            "bandcamp": str,
            "itunes": str,
          }
        },
        ...
      ]
    }
    """
    playlist = raw["playlist"]
    items = raw["items"]

    playlist_id = playlist["id"]
    playlist_name = playlist["name"]
    playlist_url = playlist.get("external_urls", {}).get("spotify", "")

    tracks_out: List[Dict[str, Any]] = []

    for item in items:
        track = item.get("track")
        if not track:
            continue

        # ローカルトラックはスキップ
        if track.get("is_local"):
            continue

        title = track.get("name") or ""
        artists = track.get("artists") or []
        album = track.get("album") or {}

        artist_name = ", ".join(a.get("name") or "" for a in artists if a.get("name"))
        album_name = album.get("name") or ""
        spotify_url = track.get("external_urls", {}).get("spotify", "")
        isrc = (track.get("external_ids") or {}).get("isrc")

        links = build_store_links(title, artist_name, album_name)

        tracks_out.append(
            {
                "title": title,
                "artist": artist_name,
                "album": album_name,
                "isrc": isrc,
                "spotify_url": spotify_url,
                "links": links,
            }
        )

    return {
        "playlist_id": playlist_id,
        "playlist_name": playlist_name,
        "playlist_url": playlist_url,
        "tracks": tracks_out,
    }
