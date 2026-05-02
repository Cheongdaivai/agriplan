# AgriPlan Backend — Cloudflare Zero Trust Tunnel Deployment

This guide deploys the Node.js/Express backend on your server and exposes it
publicly via a **Cloudflare Zero Trust named tunnel** on a subdomain you choose
(e.g. `api.yourdomain.com`).

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Domain added to Cloudflare | Must be on any plan (free works) |
| Server / VPS with Linux | Ubuntu 22.04 or Debian / any systemd distro |
| Node.js ≥ 18 | `node -v` to check |
| MongoDB running | `mongod` on `localhost:27017` |
| `cloudflared` installed | See step 1 |

---

## Step 1 — Install `cloudflared`

```bash
# Debian / Ubuntu (amd64)
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
  | sudo gpg --dearmor -o /usr/share/keyrings/cloudflare-main.gpg

echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] \
  https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" \
  | sudo tee /etc/apt/sources.list.d/cloudflared.list

sudo apt update && sudo apt install -y cloudflared

# Verify
cloudflared --version
```

---

## Step 2 — Authenticate with Cloudflare

This opens a browser tab — log into your Cloudflare account and authorise
the domain you want to use.

```bash
cloudflared tunnel login
```

A credentials file is saved to `~/.cloudflared/cert.pem`.

---

## Step 3 — Create the named tunnel

```bash
cloudflared tunnel create agriplan-api
```

Output example:
```
Created tunnel agriplan-api with id 4a1b2c3d-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

Copy that UUID — you need it in the next step.

---

## Step 4 — Configure the tunnel

Edit `backend/deploy/tunnel-config.yml` and replace every placeholder:

| Placeholder | Replace with |
|---|---|
| `<TUNNEL-ID>` | UUID from step 3 |
| `<YOUR-LINUX-USER>` | your Linux username (e.g. `ubuntu`) |
| `<YOUR-DOMAIN>` | your root domain (e.g. `example.com`) |
| `<SUBDOMAIN>` | desired prefix (e.g. `api`) |

Then copy it to the default cloudflared location so `cloudflared` can find it:

```bash
# Either copy to the default location:
cp backend/deploy/tunnel-config.yml ~/.cloudflared/config.yml

# …or leave it where it is and pass --config to cloudflared (see service file)
```

---

## Step 5 — Create the DNS record (subdomain)

This single command creates a **CNAME** record in Cloudflare pointing
`api.yourdomain.com` → your tunnel (no need to touch the dashboard).

```bash
cloudflared tunnel route dns agriplan-api <SUBDOMAIN>.<YOUR-DOMAIN>
# e.g.
cloudflared tunnel route dns agriplan-api api.example.com
```

Verify in the Cloudflare dashboard → DNS tab: you should see a new CNAME
proxied record.

---

## Step 6 — Configure the backend `.env`

```bash
cd backend
cp .env.example .env
nano .env   # or your preferred editor
```

Update these values:

```dotenv
PORT=5000
MONGO_URI=mongodb://localhost:27017/agriplan
NODE_ENV=production
CORS_ORIGIN=https://<your-app>.netlify.app   # ← your exact Netlify URL
```

---

## Step 7 — Install the Node.js backend as a systemd service

```bash
# Edit the service file — set the two placeholders
nano backend/deploy/agriplan-api.service

# Copy to systemd
sudo cp backend/deploy/agriplan-api.service /etc/systemd/system/

# Enable & start
sudo systemctl daemon-reload
sudo systemctl enable --now agriplan-api

# Check it's running
sudo systemctl status agriplan-api
curl http://localhost:5000/api/health
```

---

## Step 8 — Install cloudflared as a systemd service

Option A — automatic installer (simplest):
```bash
sudo cloudflared --config ~/.cloudflared/config.yml service install
sudo systemctl enable --now cloudflared
```

Option B — manual (useful if you keep the config in the project folder):
```bash
# Edit service file — set <YOUR-LINUX-USER> and <ABSOLUTE-PATH-TO-BACKEND>
nano backend/deploy/cloudflared.service

sudo cp backend/deploy/cloudflared.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now cloudflared
```

Check the tunnel is live:
```bash
sudo systemctl status cloudflared
curl https://api.yourdomain.com/api/health
```

---

## Step 9 — Point the Netlify frontend at the new subdomain

In **Netlify dashboard → Site settings → Environment variables** add:

| Key | Value |
|---|---|
| `VITE_API_URL` | `https://api.yourdomain.com/api` |

Then trigger a new deploy in Netlify (redeploy from the dashboard or push a
commit). The frontend will now call your Cloudflare-tunnelled backend.

---

## Useful commands

```bash
# Stream backend logs
journalctl -u agriplan-api -f

# Stream tunnel logs
journalctl -u cloudflared -f

# Restart after a config change
sudo systemctl restart agriplan-api
sudo systemctl restart cloudflared

# List all tunnels in your Cloudflare account
cloudflared tunnel list
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `502 Bad Gateway` from the subdomain | Backend not running — check `systemctl status agriplan-api` |
| CORS errors in browser | `CORS_ORIGIN` in `.env` doesn't match the Netlify URL exactly |
| DNS not resolving | Wait 1–2 min; confirm CNAME exists in Cloudflare dashboard |
| `credentials-file` not found | Wrong `<TUNNEL-ID>` or wrong `<YOUR-LINUX-USER>` in `tunnel-config.yml` |
| MongoDB connection error | Ensure `mongod` is running: `sudo systemctl status mongod` |
