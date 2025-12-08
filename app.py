#!/usr/bin/env python3
from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import (
    FastAPI,
    Query,
    HTTPException,
    UploadFile,
    File,
    Form,
)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from core import fetch_playlist_tracks, playlist_result_to_dict
from rekordbox import mark_owned_tracks


# .env 読み込み（SPOTIFY_* と BACKEND_CORS_ORIGINS）
load_dotenv()

app = FastAPI(title="Spotify Playlist Shopper API")

# =========================
# CORS 設定
# =========================

origins_str = os.getenv(
    "BACKEND_CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
)
origins = [o.strip() for o in origins_str.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================
# Pydantic モデル
# =========================


class PlaylistWithRekordboxRequest(BaseModel):
    url: str
    rekordbox_xml_path: Optional[str] = None


# =========================
# ヘルスチェック
# =========================


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


# =========================
# プレイリストのみ
# =========================


@app.get("/api/playlist")
async def api_playlist(
    url: str = Query(..., description="Spotify playlist URL / URI / ID"),
) -> dict:
    try:
        raw = fetch_playlist_tracks(url)
        data = playlist_result_to_dict(raw)
        return data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# =========================
# Rekordbox：パス指定版（Macアプリなどから使用）
# =========================


@app.post("/api/playlist-with-rekordbox")
async def api_playlist_with_rekordbox(
    payload: PlaylistWithRekordboxRequest,
) -> dict:
    if not payload.rekordbox_xml_path:
        raise HTTPException(
            status_code=400,
            detail="rekordbox_xml_path is required for this endpoint",
        )

    try:
        raw = fetch_playlist_tracks(payload.url)
        data = playlist_result_to_dict(raw)
        data = mark_owned_tracks(data, payload.rekordbox_xml_path)
        return data
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# =========================
# Rekordbox：XMLアップロード版（Web用）
# =========================


@app.post("/api/playlist-with-rekordbox-upload")
async def api_playlist_with_rekordbox_upload(
    url: str = Form(..., description="Spotify playlist URL / URI / ID"),
    rekordbox_xml: UploadFile = File(..., description="Rekordbox collection XML"),
) -> dict:
    """
    フロントから:
      - FormData: { url, rekordbox_xml: File }
      を投げるエンドポイント。

    アップロードされた XML は一時ファイルに保存してから
    mark_owned_tracks() に渡し、処理後削除する。
    """
    tmp_path: Optional[str] = None

    try:
        # 一時ファイルに保存
        suffix = Path(rekordbox_xml.filename or "rekordbox.xml").suffix or ".xml"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp_path = tmp.name
            content = await rekordbox_xml.read()
            tmp.write(content)

        # プレイリスト取得
        raw = fetch_playlist_tracks(url)
        data = playlist_result_to_dict(raw)

        # Rekordbox 突き合わせ
        data = mark_owned_tracks(data, tmp_path)
        return data

    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                # 消せなくても致命的ではないので黙殺
                pass
