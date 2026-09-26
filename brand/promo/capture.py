#!/usr/bin/env python3
"""Serve the promo and accept rendered frames posted back from the canvas."""
import http.server, os, socketserver, sys

FRAMES = sys.argv[2] if len(sys.argv) > 2 else "frames"
os.makedirs(FRAMES, exist_ok=True)

class H(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if not self.path.startswith("/frame/"):
            self.send_error(404); return
        n = int(self.path.rsplit("/", 1)[1])
        data = self.rfile.read(int(self.headers["Content-Length"]))
        open(os.path.join(FRAMES, f"f_{n:05d}.jpg"), "wb").write(data)
        self.send_response(200); self.send_header("Content-Length", "2")
        self.end_headers(); self.wfile.write(b"ok")
    def log_message(self, *a): pass

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", int(sys.argv[1])), H) as s:
    s.serve_forever()
