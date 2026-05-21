const fs = require("fs");
const path = require("path");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function getClientDistDir() {
  if (process.env.CLIENT_DIST) {
    return path.resolve(process.env.CLIENT_DIST);
  }
  return path.resolve(__dirname, "../../client/dist");
}

function tryServeStatic(req, res) {
  const distDir = getClientDistDir();
  if (!fs.existsSync(distDir)) return false;

  const pathname = (req.url ?? "/").split("?")[0];
  if (pathname === "/health") return false;

  let relative = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
  let filePath = path.resolve(distDir, relative);

  if (!filePath.startsWith(distDir)) {
    res.writeHead(403);
    res.end();
    return true;
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    filePath = path.join(distDir, "index.html");
    if (!fs.existsSync(filePath)) return false;
  }

  const ext = path.extname(filePath);
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

module.exports = { tryServeStatic, getClientDistDir };
