// Generates a local CA and a server certificate for this machine's LAN IP.
//
//   node tools/lan/make-cert.mjs
//
// The CA is created once (cert/ca.crt). Re-run this script whenever the machine's
// IP address changes: it re-issues only the server certificate, signed by the same
// CA, so the phone does not need to install anything again.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const CERT = path.join(HERE, 'cert')
const OPENSSL = process.env.OPENSSL_BIN || 'C:/Program Files/Git/usr/bin/openssl.exe'

function lanAddress() {
  const nets = os.networkInterfaces()
  const candidates = []
  for (const [name, addresses] of Object.entries(nets)) {
    for (const address of addresses ?? []) {
      if (address.family !== 'IPv4' || address.internal) continue
      if (address.address.startsWith('169.254.')) continue
      candidates.push({ name, address: address.address })
    }
  }
  const preferred =
    candidates.find((item) => /wi-?fi|wlan|wireless/i.test(item.name)) ?? candidates[0]
  if (!preferred) throw new Error('No LAN IPv4 address found. Connect to Wi-Fi first.')
  return preferred
}

function run(args) {
  execFileSync(OPENSSL, args, { stdio: 'inherit', cwd: CERT })
}

fs.mkdirSync(CERT, { recursive: true })
const { name, address } = lanAddress()
console.log(`Using ${address} (${name})`)

if (!fs.existsSync(path.join(CERT, 'ca.key'))) {
  console.log('Creating local CA...')
  run([
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
    '-keyout', 'ca.key', '-out', 'ca.crt', '-days', '3650', '-sha256',
    '-subj', '/CN=Wanderlog Local CA/O=Wanderlog',
    '-addext', 'basicConstraints=critical,CA:TRUE',
    '-addext', 'keyUsage=critical,keyCertSign,cRLSign',
  ])
}

const san = `subjectAltName=IP:${address},IP:127.0.0.1,DNS:localhost`
console.log('Issuing server certificate for', san)
run([
  'req', '-new', '-newkey', 'rsa:2048', '-nodes',
  '-keyout', 'server.key', '-out', 'server.csr',
  '-subj', '/CN=Wanderlog LAN',
  '-addext', san,
  '-addext', 'basicConstraints=critical,CA:FALSE',
  '-addext', 'keyUsage=critical,digitalSignature,keyEncipherment',
  '-addext', 'extendedKeyUsage=serverAuth',
])
run([
  'x509', '-req', '-in', 'server.csr',
  '-CA', 'ca.crt', '-CAkey', 'ca.key', '-CAcreateserial',
  '-out', 'server.crt', '-days', '825', '-sha256',
  '-copy_extensions', 'copy',
])

fs.writeFileSync(path.join(CERT, 'address.txt'), address + '\n')
console.log('Done. CA:', path.join(CERT, 'ca.crt'))
