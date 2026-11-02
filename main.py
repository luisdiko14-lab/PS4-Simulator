"""Run the PS4 Simulator in a PyQt6 desktop window and serve it on port 8000."""

from __future__ import annotations

import argparse
import errno
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
import sys
from threading import Thread


ROOT = Path(__file__).resolve().parent


def make_server(host: str, port: int) -> ThreadingHTTPServer:
    handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))
    return ThreadingHTTPServer((host, port), handler)


def serve_web(server: ThreadingHTTPServer) -> int:
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the PS4 Simulator web app")
    parser.add_argument("--host", default="0.0.0.0", help="interface to bind")
    parser.add_argument("--port", type=int, default=8000, help="HTTP port")
    parser.add_argument("--web-only", action="store_true", help="serve on the port without opening a desktop window")
    args = parser.parse_args()

    try:
        server = make_server(args.host, args.port)
    except OSError as error:
        if error.errno != errno.EADDRINUSE:
            raise
        server = None

    print(f"PS4 Simulator web page: http://localhost:{args.port}", flush=True)

    if args.web_only:
        if server is None:
            print(f"Port {args.port} is already in use; the existing server was left untouched.", file=sys.stderr)
            return 1
        return serve_web(server)

    if sys.platform.startswith("linux") and not (os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY")):
        print("No graphical display detected; falling back to web mode.", flush=True)
        if server is None:
            print(f"Port {args.port} is already in use; the existing server was left untouched.", file=sys.stderr)
            return 1
        return serve_web(server)

    try:
        from PyQt6.QtCore import QUrl
        from PyQt6.QtWidgets import QApplication, QMainWindow
        from PyQt6.QtWebEngineCore import QWebEngineSettings
        from PyQt6.QtWebEngineWidgets import QWebEngineView
    except ImportError as error:
        print(f"Qt desktop runtime unavailable ({error}). Falling back to web mode.", file=sys.stderr, flush=True)
        if server is None:
            print(f"Port {args.port} is already in use; the existing server was left untouched.", file=sys.stderr)
            return 1
        return serve_web(server)

    if server:
        Thread(target=server.serve_forever, daemon=True).start()

    app = QApplication(sys.argv[:1])
    window = QMainWindow()
    window.setWindowTitle("PlayStation 4 Simulator")
    window.resize(1440, 900)
    view = QWebEngineView(window)
    view.settings().setAttribute(QWebEngineSettings.WebAttribute.LocalStorageEnabled, True)
    view.setUrl(QUrl(f"http://127.0.0.1:{args.port}/"))
    window.setCentralWidget(view)
    window.show()
    try:
        return app.exec()
    except KeyboardInterrupt:
        return 0
    finally:
        if server:
            server.shutdown()
            server.server_close()


if __name__ == "__main__":
    raise SystemExit(main())
