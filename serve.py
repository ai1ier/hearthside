#!/usr/bin/env python3
"""Serve the planner at http://localhost:5173 (no caching, so edits show on reload)."""
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


http.server.SimpleHTTPRequestHandler.extensions_map[".js"] = "text/javascript"
print(f"Hearthside Quest Planner → http://localhost:{PORT}")
http.server.ThreadingHTTPServer(("127.0.0.1", PORT), NoCache).serve_forever()
