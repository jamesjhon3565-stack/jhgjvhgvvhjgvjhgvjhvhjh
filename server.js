const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const root = __dirname;
const port = process.env.PORT || 3000;

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf'
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath);
  const normalized = path.normalize(decoded).replace(/^([.][.][/\\])+/, '');
  const fullPath = path.resolve(root, '.' + path.sep + normalized.replace(/^[/\\]+/, ''));
  return fullPath.startsWith(root) ? fullPath : null;
}

function sendFile(filePath, res) {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', mime[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
    fs.createReadStream(filePath).pipe(res);
  });
}

http.createServer((req, res) => {
  let pathname;
  try {
    pathname = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname;
  } catch {
    res.statusCode = 400;
    return res.end('Bad Request');
  }

  if (pathname === '/') pathname = '/index.html';

  const requested = safePath(pathname);
  if (!requested) {
    res.statusCode = 403;
    return res.end('Forbidden');
  }

  fs.stat(requested, (err, stat) => {
    if (!err && stat.isDirectory()) {
      return sendFile(path.join(requested, 'index.html'), res);
    }
    if (!err && stat.isFile()) {
      return sendFile(requested, res);
    }

    // SPA fallback for client-side routes.
    if (!path.extname(pathname)) {
      return sendFile(path.join(root, 'index.html'), res);
    }

    res.statusCode = 404;
    res.end('Not Found');
  });
}).listen(port, () => {
  console.log(`Listening on port ${port}`);
});
