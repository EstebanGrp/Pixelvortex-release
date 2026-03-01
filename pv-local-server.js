const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT_DIR = __dirname;
const PORT = Number(process.env.PV_PORT || process.env.PORT || 8080);
const API_TOKEN = process.env.PV_API_TOKEN ? String(process.env.PV_API_TOKEN) : "";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".otf": "font/otf",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".gltf": "model/gltf+json",
  ".glb": "model/gltf-binary",
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

function send(res, statusCode, headers, streamOrBody) {
  res.writeHead(statusCode, headers);
  if (streamOrBody && typeof streamOrBody.pipe === "function") {
    streamOrBody.pipe(res);
    return;
  }
  res.end(streamOrBody || "");
}

function parseRangeHeader(rangeHeader, size) {
  const m = /^bytes=(\d*)-(\d*)$/i.exec(String(rangeHeader || ""));
  if (!m) return null;
  let start = m[1] === "" ? NaN : Number(m[1]);
  let end = m[2] === "" ? NaN : Number(m[2]);

  if (Number.isNaN(start) && !Number.isNaN(end)) {
    start = Math.max(0, size - end);
    end = size - 1;
  } else if (!Number.isNaN(start) && Number.isNaN(end)) {
    end = size - 1;
  }

  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  if (start < 0 || end < start || start >= size) return null;
  end = Math.min(end, size - 1);
  return { start, end };
}

function resolveAllowedOrigin(req) {
  const origin = String(req.headers.origin || "");
  if (!origin) return "";
  const allowed = new Set([`http://127.0.0.1:${PORT}`, `http://localhost:${PORT}`]);
  return allowed.has(origin) ? origin : "";
}

function buildCorsHeaders(req, allowMethods) {
  const allowOrigin = resolveAllowedOrigin(req);
  if (!allowOrigin) return {};
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": allowMethods,
    "Access-Control-Allow-Headers": "Content-Type, X-PV-Token",
    "Vary": "Origin",
  };
}

function hasValidToken(req, url) {
  if (!API_TOKEN) return true;
  const token = String(req.headers["x-pv-token"] || "") || String(url.searchParams.get("token") || "");
  return token === API_TOKEN;
}

function safeResolvePath(urlPathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPathname || "/");
  } catch {
    return null;
  }

  const normalized = decoded.replace(/\\/g, "/").replace(/^\/+/, "");
  const joined = path.resolve(ROOT_DIR, normalized);
  const rel = path.relative(ROOT_DIR, joined);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return joined;
}

function getCacheControl(urlPathname, filePath) {
  const p = String(urlPathname || "/");
  if (p === "/" || p.toLowerCase().endsWith("/index.html") || p.toLowerCase() === "/index.html") return "no-store";
  if (p.startsWith("/assets/")) return "public, max-age=31536000, immutable";
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "no-store";
  if (ext === ".json" || ext === ".txt") return "no-store";
  return "public, max-age=86400";
}

function serveFile(req, res, filePath, urlPathname) {
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch (_) {
    return false;
  }

  if (stat.isDirectory()) {
    const indexPath = path.join(filePath, "index.html");
    return serveFile(req, res, indexPath, urlPathname);
  }

  const mimeType = getMimeType(filePath);
  const baseHeaders = {
    "Content-Type": mimeType,
    "Cache-Control": getCacheControl(urlPathname, filePath),
    "Accept-Ranges": "bytes",
  };

  const rangeHeader = req.headers.range;
  if (rangeHeader) {
    const range = parseRangeHeader(rangeHeader, stat.size);
    if (!range) {
      send(res, 416, { ...baseHeaders, "Content-Range": `bytes */${stat.size}` }, "");
      return true;
    }
    const chunkSize = range.end - range.start + 1;
    send(
      res,
      206,
      {
        ...baseHeaders,
        "Content-Length": chunkSize,
        "Content-Range": `bytes ${range.start}-${range.end}/${stat.size}`,
      },
      fs.createReadStream(filePath, { start: range.start, end: range.end }),
    );
    return true;
  }

  send(
    res,
    200,
    {
      ...baseHeaders,
      "Content-Length": stat.size,
    },
    fs.createReadStream(filePath),
  );
  return true;
}

function acceptsHtml(req) {
  const accept = String(req.headers.accept || "");
  return accept.includes("text/html") || accept.includes("*/*");
}

const server = http.createServer((req, res) => {
  const method = String(req.method || "GET").toUpperCase();
  if (method === "OPTIONS") {
    let url;
    try {
      url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    } catch {
      send(res, 204, { "Cache-Control": "no-store" }, "");
      return;
    }

    send(
      res,
      204,
      {
        "Cache-Control": "no-store",
        ...buildCorsHeaders(req, "GET,HEAD,OPTIONS"),
      },
      "",
    );
    return;
  }
  if (method !== "GET" && method !== "HEAD") {
    send(res, 405, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }, "Method Not Allowed");
    return;
  }

  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  } catch (_) {
    send(res, 400, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }, "Bad Request");
    return;
  }

  if (url.pathname === "/pv/saves") {
    if (!hasValidToken(req, url)) {
      send(res, 401, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...buildCorsHeaders(req, "GET,HEAD,OPTIONS") }, JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    const savesDir = path.join(ROOT_DIR, "integrated server", "saves");
    let worlds = [];
    try {
      if (fs.existsSync(savesDir)) {
        worlds = fs
          .readdirSync(savesDir, { withFileTypes: true })
          .filter((d) => d.isFile())
          .map((d) => d.name)
          .filter((name) => name.toLowerCase().endsWith(".json"))
          .sort((a, b) => a.localeCompare(b, void 0, { numeric: true, sensitivity: "base" }));
      }
    } catch (_) {
      worlds = [];
    }
    const body = JSON.stringify({ worlds });
    send(
      res,
      200,
      {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        ...buildCorsHeaders(req, "GET,HEAD,OPTIONS"),
        "Content-Length": Buffer.byteLength(body),
      },
      method === "HEAD" ? "" : body,
    );
    return;
  }

  const resolved = safeResolvePath(url.pathname);
  if (!resolved) {
    send(res, 403, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }, "Forbidden");
    return;
  }

  const served = serveFile(req, res, resolved, url.pathname);
  if (served) return;

  if (acceptsHtml(req)) {
    const fallback = path.join(ROOT_DIR, "index.html");
    if (serveFile(req, res, fallback, "/index.html")) return;
  }

  send(res, 404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }, "Not Found");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`PV local server: http://127.0.0.1:${PORT}/`);
  console.log(`NetLog: ejecuta en consola del navegador -> PV_enableNetLog()`);
});
