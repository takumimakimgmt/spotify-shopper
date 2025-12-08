#!/usr/bin/env python3
import json
from pathlib import Path

from core import fetch_playlist_tracks, playlist_result_to_dict
from html_renderer import render_html


def main():
    pl_url = input("SpotifyプレイリストURL: ").strip()

    # コアからプレイリスト情報を取得
    result = fetch_playlist_tracks(pl_url)
    data = playlist_result_to_dict(result)

    print(f"Spotifyから取得中: {data['playlist_name']} ...")
    print(f"{len(data['tracks'])} 曲を取得しました。HTMLを生成します。")

    # 出力先ディレクトリ ~/Music/SpotifyShopLinks
    outdir = Path.home() / "Music" / "SpotifyShopLinks"
    outdir.mkdir(parents=True, exist_ok=True)

    # JSON保存
    json_path = outdir / f"{data['playlist_name']}.json"
    with json_path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    # HTML生成＆保存
    html = render_html(data)
    html_path = outdir / f"{data['playlist_name']}.html"
    html_path.write_text(html, encoding="utf-8")

    print(f"JSON: {json_path}")
    print(f"HTML: {html_path}")
    print("ブラウザで開いて、各ストアリンクから正規購入してください。")


if __name__ == "__main__":
    main()
