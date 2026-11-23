# Deployment

Wanderlog is a static site: `pnpm build` produces `dist/`, and any static host can serve it. The
repository includes ready-made configuration for GitHub Pages, Vercel and Netlify.

> **HTTPS is required** for geolocation, camera and service-worker installation. `localhost` is the
> only exception, which is why phone testing needs one of the options below.

## 1. GitHub Pages (recommended for the coursework)

The workflow at `.github/workflows/deploy.yml` runs on every push to `main`:

1. checkout;
2. install pnpm and Node 22;
3. `pnpm install --frozen-lockfile`;
4. `pnpm test`;
5. `pnpm build`;
6. upload `dist/` as a Pages artefact and deploy it.

One-time setup in the repository:

1. Push the project to `main`.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Wait for the *Deploy to GitHub Pages* run to finish.
4. The URL is `https://chirikov41.github.io/wanderlog/`.

Because `base` is `'./'` and the router is hash-based, no extra path configuration is required.
If you rename the repository, the URL changes but the build still works.

## 2. Vercel

```bash
pnpm dlx vercel        # first run links the project
pnpm dlx vercel --prod # production deployment
```

`vercel.json` already sets the build command and output directory. Or import the Git repository in
the Vercel dashboard; the detected framework preset is Vite.

## 3. Netlify

- **Drag and drop**: run `pnpm build`, then drop the `dist` folder onto
  <https://app.netlify.com/drop>.
- **Git**: connect the repository; `netlify.toml` supplies `pnpm build` and `publish = "dist"`.

## 4. Testing on a real phone before deploying

### Option A — deploy first (simplest)

Deploy to GitHub Pages / Vercel / Netlify, open the HTTPS URL on the phone and install it. This is
the only option that exercises the real install flow.

### Option B — HTTPS tunnel to your dev server

```bash
pnpm dev            # terminal 1, http://localhost:5173
cloudflared tunnel --url http://localhost:5173   # or: ngrok http 5173
```

Open the printed `https://…` URL on the phone. Tunnels terminate TLS, so geolocation, camera and
the service worker all work.

### Option C — local network with a trusted certificate

Plain `http://192.168.x.x:5173` is **not** a secure context: geolocation and the camera will be
blocked and the service worker will not register. If you need a LAN URL, put a reverse proxy with a
certificate in front of Vite (for example `caddy reverse-proxy --from https://wanderlog.localhost
--to 127.0.0.1:5173`) and trust the certificate on the phone.

## 5. Environment variables

None are required. Optional build-time variables:

| Variable | Effect |
| --- | --- |
| `VITE_*` | Available to the app through `import.meta.env`; none are used today |

If you add analytics or a hosted geocoder, put the key in a `.env.local` file (ignored by git) and
reference it as `import.meta.env.VITE_…`. Never commit secrets to a public repository.

## 6. Verifying a deployment

1. Open the URL on the phone.
2. Install the app and launch it from the home screen.
3. Capture a memory with the camera and location.
4. Reload; the memory is still there.
5. Enable aeroplane mode and reload; the journal still renders.
6. Run Lighthouse → *Installable* and *PWA* checks should pass.

## 7. Updating a deployment

Push to `main`. The workflow builds and deploys, and installed clients receive the new service
worker; Wanderlog shows a "new version is available" banner and applies it when tapped.

## 8. Rollback

- **GitHub Pages**: re-run an earlier successful workflow, or revert the commit and push.
- **Vercel**: *Deployments → previous deployment → Promote to production*.
- **Netlify**: *Deploys → previous deploy → Publish deploy*.
