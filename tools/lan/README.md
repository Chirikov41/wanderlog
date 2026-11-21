# Testing on a phone over the local network

Geolocation, the camera and the service worker all require a **secure context**. A plain
`http://192.168.x.x` address is not one, so the phone must talk to the dev machine over HTTPS.

These two scripts provide a local certificate authority and an HTTPS static server for the
production build. No cloud account, tunnel or cable is involved.

## How it works

1. `make-cert.mjs` creates a local CA (`cert/ca.crt`) and a server certificate whose SAN contains
   the machine's current LAN IP. The CA key never leaves this folder.
2. `serve.mjs` serves `dist/` over HTTPS on port 8443 and serves the CA certificate over HTTP on
   port 8080.
3. The phone installs the CA once, then trusts every certificate issued by it. When the IP changes,
   re-run `make-cert.mjs` only — the CA stays the same, so the phone does not need to reinstall it.

## Usage

```bash
pnpm build                 # dist/ must exist
node tools/lan/make-cert.mjs
node tools/lan/serve.mjs
```

Open the printed `http://<ip>:8080/` page on the phone and follow the two steps.

### Android

1. Download `ca.crt` from the help page.
2. Settings → Security → Encryption & credentials → Install a certificate → **CA certificate**.
3. Open the HTTPS address, then Chrome menu → **Install app**.

Some Android builds hide the CA install behind a lock screen PIN; that is expected.

### iOS

1. Download `ca.crt` in **Safari**.
2. Settings → General → VPN & Device Management → install the profile.
3. Settings → General → About → Certificate Trust Settings → enable full trust for the CA.
4. Open the HTTPS address in Safari → Share → **Add to Home Screen**.

## If the phone cannot reach the machine

- Campus and guest Wi-Fi often isolate clients. Use the phone's hotspot instead: turn on the
  hotspot, connect the laptop to it, re-run `make-cert.mjs` (the IP will change) and restart
  `serve.mjs`.
- Windows Firewall may block the ports. Allow Node.js on private networks, or run once in an
  administrator terminal:

  ```powershell
  netsh advfirewall firewall add rule name="Wanderlog LAN 8443" dir=in action=allow protocol=TCP localport=8443
  netsh advfirewall firewall add rule name="Wanderlog LAN 8080" dir=in action=allow protocol=TCP localport=8080
  ```

## Security notes

- `cert/` is git-ignored: never commit the CA private key.
- The CA is only trusted by devices you install it on, and only signs this project's local server.
  Remove it from the phone (Settings → Security → Trusted credentials → User) when you are done.
- These scripts are for device testing. For a permanent URL use GitHub Pages, Vercel or Netlify.
