const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
}

function json(res, code, data) {
  cors(res);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

async function handleOembed(res, u) {
  const target = u.searchParams.get('url');
  if (!target || !/^https:\/\/open\.spotify\.com\//.test(target)) {
    return json(res, 400, { error: 'url inválida' });
  }
  try {
    const r = await fetch('https://open.spotify.com/oembed?url=' + encodeURIComponent(target));
    if (!r.ok) throw new Error('status ' + r.status);
    const data = await r.json();
    json(res, 200, {
      title: data.title || '',
      thumbnail: data.thumbnail_url || '',
      width: data.width || 0,
      height: data.height || 0
    });
  } catch (e) {
    json(res, 502, { error: 'falha ao buscar dados da música' });
  }
}

async function handleImg(res, u) {
  const target = u.searchParams.get('url');
  let host = '';
  try { host = new URL(target).hostname; } catch (e) { return json(res, 400, { error: 'url inválida' }); }

  const allowed = host.endsWith('.scdn.co') || host.endsWith('.spotifycdn.com') ||
    host.endsWith('.itunes.apple.com') || host.endsWith('.mzstatic.com');
  if (!/^https:\/\//.test(target) || !allowed) {
    return json(res, 403, { error: 'host não permitido' });
  }
  try {
    const r = await fetch(target);
    if (!r.ok) throw new Error('status ' + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    cors(res);
    res.writeHead(200, {
      'Content-Type': r.headers.get('content-type') || 'image/jpeg',
      'Cache-Control': 'public, max-age=86400'
    });
    res.end(buf);
  } catch (e) {
    json(res, 502, { error: 'falha ao buscar imagem' });
  }
}

function serveStatic(res, pathname) {
  let rel = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('403');
  }
  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(buf);
  });
}

const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));

  if (req.method === 'OPTIONS') {
    cors(res);
    res.writeHead(204);
    return res.end();
  }

  if (u.pathname === '/api/oembed') return void handleOembed(res, u);
  if (u.pathname === '/api/img') return void handleImg(res, u);
  return void serveStatic(res, u.pathname);
});

srv.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log('Porta ' + PORT + ' já em uso — a página já deve estar rodando em http://localhost:' + PORT);
  } else {
    console.error(e);
  }
});

srv.listen(PORT, () => {
  console.log('Spotify Waves rodando em  http://localhost:' + PORT);
});
