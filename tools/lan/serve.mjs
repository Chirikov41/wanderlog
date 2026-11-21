// Serves the production build over HTTPS on the local network, so a phone can
// install the PWA and use geolocation and the camera (both need a secure
// context). It also serves the CA certificate over plain HTTP at :8080 so the
// phone can download and trust it without any cable or cloud service.
//
//   node tools/lan/serve.mjs
//
// Then open the HTTPS address printed in the terminal on the phone.

import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const DIST = path.join(ROOT, 'dist')
const CERT = path.join(HERE, 'cert')
const HTTPS_PORT = Number(process.env.PORT || 8443)
const HTTP_PORT = Number(process.env.CA_PORT || 8080)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

function lanAddress() {
  const candidates = []
  for (const [name, addresses] of Object.entries(os.networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family !== 'IPv4' || address.internal) continue
      if (address.address.startsWith('169.254.')) continue
      candidates.push({ name, address: address.address })
    }
  }
  const preferred = candidates.find((item) => /wi-?fi|wlan|wireless/i.test(item.name)) ?? candidates[0]
  return preferred?.address ?? '127.0.0.1'
}

const ADDRESS = fs.existsSync(path.join(CERT, 'address.txt'))
  ? fs.readFileSync(path.join(CERT, 'address.txt'), 'utf8').trim()
  : lanAddress()

function serveStatic(req, res) {
  const url = new URL(req.url, 'https://localhost')
  let filePath = path.join(DIST, decodeURIComponent(url.pathname))

  if (!filePath.startsWith(DIST)) {
    res.writeHead(403).end('Forbidden')
    return
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST, 'index.html')
  }

  const ext = path.extname(filePath).toLowerCase()
  const immutable = url.pathname.startsWith('/assets/')
  const headers = {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': immutable
      ? 'public, max-age=31536000, immutable'
      : 'no-cache, must-revalidate',
  }
  res.writeHead(200, headers)
  fs.createReadStream(filePath).pipe(res)
}

const helpPage = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Wanderlog · 手机安装</title>
<style>
  body{margin:0;padding:28px 22px;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
       background:#f7f1e4;color:#17211d;line-height:1.6}
  h1{font-family:Georgia,serif;font-size:28px;margin:0 0 6px;color:#0e5c4a}
  p{margin:8px 0}
  .card{background:#fffdf8;border:1px solid #e5dcc7;border-radius:18px;padding:18px;margin:16px 0}
  a.btn{display:block;text-align:center;background:#0e5c4a;color:#f8f2e3;text-decoration:none;
        padding:14px;border-radius:999px;font-weight:700;margin-top:12px}
  a.alt{display:block;text-align:center;border:1px solid #d6c9ae;color:#17211d;text-decoration:none;
        padding:12px;border-radius:999px;margin-top:10px}
  ol{padding-left:20px}
  code{background:#f0e9d9;padding:2px 6px;border-radius:6px;font-size:13px}
  .muted{color:#6e7872;font-size:13px}
</style></head><body>
<h1>Wanderlog</h1>
<p class="muted">在手机上安装这个 PWA 的两步操作</p>

<div class="card">
  <strong>第 1 步 · 安装证书</strong>
  <p class="muted">局域网用的 HTTPS 证书，装一次即可（之后换 IP 也不用重装）。</p>
  <a class="btn" href="/ca.crt">下载证书 ca.crt</a>
  <ol>
    <li>下载后点开文件，按系统提示安装为「CA 证书 / 受信任的凭据」。</li>
    <li>Android：设置 → 安全 → 加密与凭据 → 安装证书 → CA 证书。</li>
    <li>iPhone：下载后到 设置 → 通用 → VPN与设备管理 安装描述文件，
        再到 设置 → 通用 → 关于本机 → 证书信任设置 打开完全信任。</li>
  </ol>
</div>

<div class="card">
  <strong>第 2 步 · 打开并安装应用</strong>
  <a class="btn" href="https://${ADDRESS}:${HTTPS_PORT}/">打开 Wanderlog</a>
  <p class="muted">打开后：Android Chrome 菜单 →「安装应用」；iPhone Safari → 分享 →「添加到主屏幕」。</p>
  <a class="alt" href="https://${ADDRESS}:${HTTPS_PORT}/">https://${ADDRESS}:${HTTPS_PORT}/</a>
</div>
</body></html>`

const httpsServer = https.createServer(
  {
    key: fs.readFileSync(path.join(CERT, 'server.key')),
    cert: fs.readFileSync(path.join(CERT, 'server.crt')),
  },
  serveStatic,
)

const httpServer = http.createServer((req, res) => {
  if (req.url === '/ca.crt') {
    res.writeHead(200, {
      'Content-Type': 'application/x-x509-ca-cert',
      'Content-Disposition': 'attachment; filename="wanderlog-ca.crt"',
    })
    fs.createReadStream(path.join(CERT, 'ca.crt')).pipe(res)
    return
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(helpPage)
})

httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
  console.log(`\n  Wanderlog HTTPS   https://${ADDRESS}:${HTTPS_PORT}/`)
  console.log(`  Certificate help  http://${ADDRESS}:${HTTP_PORT}/`)
  console.log(`  CA download       http://${ADDRESS}:${HTTP_PORT}/ca.crt\n`)
})

httpServer.listen(HTTP_PORT, '0.0.0.0')
