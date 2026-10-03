#!/usr/bin/env python3
"""מוריד סרטונים מפינטרסט ומרוב הרשתות החברתיות (מבוסס yt-dlp).

הרצה:  python app.py            -> שרת עם ממשק web ב-http://127.0.0.1:8000
CLI:   python app.py URL [--audio] [--quality 720]
"""
import argparse
import json
import mimetypes
import shutil
import sys
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, urlparse

import yt_dlp

HERE = Path(__file__).parent
QUALITIES = {"best", "1080", "720", "480", "360"}


def valid_url(url: str) -> bool:
    p = urlparse(url or "")
    return p.scheme in ("http", "https") and bool(p.netloc)


def base_opts(outdir=None):
    opts = {"quiet": True, "no_warnings": True, "noplaylist": True}
    if outdir:
        opts["outtmpl"] = str(Path(outdir) / "%(title).80B [%(id)s].%(ext)s")
    return opts


def get_info(url: str) -> dict:
    with yt_dlp.YoutubeDL(base_opts()) as ydl:
        info = ydl.extract_info(url, download=False)
    heights = sorted({f["height"] for f in info.get("formats", []) if f.get("height")}, reverse=True)
    return {
        "title": info.get("title"),
        "thumbnail": info.get("thumbnail"),
        "uploader": info.get("uploader"),
        "duration": info.get("duration"),
        "site": info.get("extractor_key"),
        "heights": heights,
    }


def download(url: str, outdir: str, audio=False, quality="best") -> Path:
    opts = base_opts(outdir)
    if audio:
        opts["format"] = "bestaudio/best"
        if shutil.which("ffmpeg"):
            opts["postprocessors"] = [{"key": "FFmpegExtractAudio", "preferredcodec": "mp3"}]
    else:
        h = "" if quality == "best" else f"[height<={quality}]"
        # עדיפות לקובץ יחיד (עובד גם בלי ffmpeg); מיזוג וידאו+אודיו רק אם ffmpeg קיים
        opts["format"] = (
            f"bestvideo{h}+bestaudio/best{h}" if shutil.which("ffmpeg") else f"best{h}/best"
        )
        opts["merge_output_format"] = "mp4"
    with yt_dlp.YoutubeDL(opts) as ydl:
        ydl.extract_info(url, download=True)
    files = [f for f in Path(outdir).iterdir() if f.is_file()]
    if not files:
        raise RuntimeError("ההורדה לא יצרה קובץ")
    return max(files, key=lambda f: f.stat().st_size)


class Handler(BaseHTTPRequestHandler):
    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(u.query).items()}
        if u.path == "/":
            body = (HERE / "index.html").read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif u.path == "/api/info":
            self._guarded(q, lambda: self._json(200, get_info(q["url"])))
        elif u.path == "/api/download":
            self._guarded(q, lambda: self._serve_download(q))
        else:
            self._json(404, {"error": "לא נמצא"})

    def _guarded(self, q, fn):
        if not valid_url(q.get("url", "")):
            return self._json(400, {"error": "כתובת לא תקינה (נדרש http/https)"})
        try:
            fn()
        except Exception as e:  # שגיאות yt-dlp: אתר לא נתמך, סרטון פרטי וכו'
            msg = str(e).replace("ERROR: ", "")
            self._json(422, {"error": msg[:300]})

    def _serve_download(self, q):
        quality = q.get("quality", "best")
        if quality not in QUALITIES:
            quality = "best"
        with tempfile.TemporaryDirectory() as tmp:
            f = download(q["url"], tmp, audio=q.get("mode") == "audio", quality=quality)
            self.send_response(200)
            self.send_header("Content-Type", mimetypes.guess_type(f.name)[0] or "application/octet-stream")
            self.send_header("Content-Length", str(f.stat().st_size))
            self.send_header("Content-Disposition", f"attachment; filename*=UTF-8''{quote(f.name)}")
            self.end_headers()
            with open(f, "rb") as fh:
                shutil.copyfileobj(fh, self.wfile)

    def log_message(self, *a):
        pass


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("url", nargs="?", help="כתובת לסרטון (ללא כתובת: מפעיל שרת web)")
    ap.add_argument("--audio", action="store_true", help="אודיו בלבד (mp3 אם יש ffmpeg)")
    ap.add_argument("--quality", default="best", choices=sorted(QUALITIES))
    ap.add_argument("--out", default=".", help="תיקיית יעד ב-CLI")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8000)
    a = ap.parse_args()
    if a.url:
        if not valid_url(a.url):
            sys.exit("כתובת לא תקינה")
        out = Path(a.out)
        out.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory() as tmp:
            f = download(a.url, tmp, a.audio, a.quality)
            print("נשמר:", shutil.move(str(f), out / f.name))
        return
    print(f"פועל על http://{a.host}:{a.port}  (Ctrl+C לעצירה)")
    ThreadingHTTPServer((a.host, a.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
