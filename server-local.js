const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const ROOT = process.cwd();

function carregarEnvLocal() {
  const envPath = path.join(ROOT, '.env.local');

  if (!fs.existsSync(envPath)) {
    console.warn('⚠️ Arquivo .env.local não encontrado.');
    return;
  }

  const linhas = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);

  for (const linha of linhas) {
    const texto = linha.trim();
    if (!texto || texto.startsWith('#')) continue;

    const idx = texto.indexOf('=');
    if (idx === -1) continue;

    const chave = texto.slice(0, idx).trim();
    let valor = texto.slice(idx + 1).trim();

    if ((valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"))) {
      valor = valor.slice(1, -1);
    }

    if (chave) process.env[chave] = valor;
  }

  console.log('✅ .env.local carregado');
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp'
  };
  return types[ext] || 'application/octet-stream';
}

function lerBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk.toString(); });
    req.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
  });
}

async function handleApi(req, res) {
  if (req.url.startsWith('/api/lauos-login')) {
    req.body = await lerBody(req);
    const handler = require('./api/lauos-login.js');
    return handler(req, res);
  }

  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ ok: false, message: 'API não encontrada.' }));
}

function servirArquivo(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.resolve(ROOT, '.' + urlPath);

  if (!filePath.startsWith(ROOT)) {
    res.statusCode = 403;
    res.end('Acesso negado.');
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Arquivo não encontrado.');
    return;
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', getMimeType(filePath));
  fs.createReadStream(filePath).pipe(res);
}

carregarEnvLocal();

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/')) {
      return await handleApi(req, res);
    }
    return servirArquivo(req, res);
  } catch (error) {
    console.error('❌ Erro no servidor local:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, message: 'Erro interno no servidor local.' }));
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('🚀 LauOS rodando localmente sem Vercel');
  console.log(`👉 Abra: http://localhost:${PORT}`);
  console.log('');
});
