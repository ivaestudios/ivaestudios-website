import http.server, socketserver, os, sys, urllib.parse
REPO = "/Users/ivae/Desktop/WEB IVAE ESTUDIOS PROYECTO/ivae-6-extracted"
OVER = sys.argv[1]; PORT = int(sys.argv[2])
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def resolve(self, path):
        p = urllib.parse.unquote(urllib.parse.urlparse(path).path)
        cands = [p]
        if p.endswith("/"): cands = [p + "index.html", p.rstrip("/") + ".html"]
        elif not os.path.splitext(p)[1]: cands = [p + ".html", p + "/index.html"]
        for c in cands:
            for base in (OVER, REPO):
                f = os.path.join(base, c.lstrip("/"))
                if os.path.isfile(f): return f
        return None
    def do_GET(self):
        f = self.resolve(self.path)
        if not f: self.send_error(404); return
        ext = os.path.splitext(f)[1].lower()
        ct = {".html":"text/html; charset=utf-8",".css":"text/css",".js":"application/javascript",".json":"application/json",".webp":"image/webp",".avif":"image/avif",".jpg":"image/jpeg",".jpeg":"image/jpeg",".png":"image/png",".svg":"image/svg+xml",".woff2":"font/woff2",".ico":"image/x-icon",".mp4":"video/mp4"}.get(ext,"application/octet-stream")
        data = open(f,"rb").read()
        self.send_response(200); self.send_header("Content-Type", ct); self.send_header("Content-Length", str(len(data))); self.send_header("Cache-Control","no-store"); self.end_headers(); self.wfile.write(data)
class T(socketserver.ThreadingMixIn, http.server.HTTPServer): daemon_threads = True; allow_reuse_address = True
T(("127.0.0.1", PORT), H).serve_forever()
