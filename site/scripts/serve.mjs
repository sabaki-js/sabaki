// Minimal static server for dist/: node scripts/serve.mjs [port]
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const DIST = path.resolve(import.meta.dirname, "../dist");
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2", ".ico": "image/x-icon", ".xml": "application/xml", ".txt": "text/plain", ".webmanifest": "application/manifest+json" };
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  let f = path.join(DIST, p);
  if (!f.startsWith(DIST)) { res.writeHead(404); return res.end("not found"); }
  if (!fs.existsSync(f) && !path.extname(p)) f = path.join(DIST, p + ".html"); // URLs propres (/bunkitsu)
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end("not found"); }
  res.writeHead(200, { "content-type": types[path.extname(f)] ?? "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(Number(process.argv[2] ?? 4173), () => console.log("http://localhost:" + (process.argv[2] ?? 4173)));
