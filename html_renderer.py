# html_renderer.py
from __future__ import annotations
from typing import Dict


def render_html(data: Dict) -> str:
    playlist_name = data["playlist_name"]
    tracks = data["tracks"]

    rows = []
    for t in tracks:
        links = t["links"]
        row = f"""
        <tr>
          <td>{t['title']}</td>
          <td>{t['artist']}</td>
          <td>{t['album']}</td>
          <td><a href="{links['beatport']}" target="_blank">Beatport</a></td>
          <td><a href="{links['bandcamp']}" target="_blank">Bandcamp</a></td>
          <td><a href="{links['itunes']}" target="_blank">iTunes</a></td>
        </tr>
        """
        rows.append(row)

    rows_html = "\n".join(rows)

    html = f"""<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <title>{playlist_name} - Spotify Shopper</title>
  <style>
    body {{
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      padding: 24px;
    }}
    table {{
      border-collapse: collapse;
      width: 100%;
    }}
    th, td {{
      border: 1px solid #ccc;
      padding: 6px 8px;
      font-size: 12px;
    }}
    th {{
      background: #f5f5f5;
    }}
    a {{
      text-decoration: none;
    }}
  </style>
</head>
<body>
  <h1>{playlist_name}</h1>
  <table>
    <thead>
      <tr>
        <th>Title</th>
        <th>Artist</th>
        <th>Album</th>
        <th>Beatport</th>
        <th>Bandcamp</th>
        <th>iTunes</th>
      </tr>
    </thead>
    <tbody>
      {rows_html}
    </tbody>
  </table>
</body>
</html>
"""
    return html
