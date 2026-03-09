import { createReadStream } from 'node:fs';
import { promises as fileSystem } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const PORT = 8765;

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.d.ts': 'text/plain; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function getMimeType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

function resolvePath(urlPath) {
  if (urlPath === '/' || urlPath === '/index.html') {
    return path.join(__dirname, 'index.html');
  }

  if (urlPath === '/app.mjs') {
    return path.join(__dirname, 'app.mjs');
  }

  if (urlPath.startsWith('/assets/')) {
    return path.join(REPO_ROOT, urlPath);
  }

  if (urlPath.startsWith('/dist/')) {
    return path.join(REPO_ROOT, urlPath);
  }

  return null;
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://localhost:${PORT}`);
  const filePath = resolvePath(url.pathname);

  if (!filePath) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  try {
    const stat = await fileSystem.stat(filePath);
    if (!stat.isFile()) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    response.writeHead(200, {
      'Content-Length': String(stat.size),
      'Content-Type': getMimeType(filePath),
      'Cache-Control': 'no-store',
    });
    createReadStream(filePath).pipe(response);
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(String(error instanceof Error ? error.message : error));
  }
});

server.listen(PORT, () => {
  console.log(`Preview server: http://localhost:${PORT}`);
  console.log('Serving the browser-native preview demo from dist/ and assets/.');
});
