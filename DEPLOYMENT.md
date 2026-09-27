# Deploying to the Client Machine (Static Public IP)

This walks through taking the app from zero to live on the client's own
machine, reachable at their static public IP over HTTP (port 80), with a
path to add HTTPS once they have a domain.

Everything runs via Docker Compose: **nginx** (serves the built React app +
reverse-proxies `/api` and `/uploads` to the API), **api** (Node/Express),
**postgres** (internal only, never exposed to the network).

---

## 1. Prerequisites on the client machine

- A Linux server (Ubuntu 22.04/24.04 is the easiest target) with at least
  2GB RAM and a few GB free disk. Windows Server works too via Docker
  Desktop, but Linux is simpler for an unattended server.
- Admin/root access.
- The machine's **static public IP** already assigned by their ISP (this
  guide assumes that's in place — if it's actually a dynamic IP behind a
  router, you'd want a DDNS service instead, which is a different setup).

## 2. Install Docker

On Ubuntu:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# log out and back in for the group change to take effect
docker --version
docker compose version
```

Confirm Docker starts automatically on reboot (the installer usually does
this, but verify):

```bash
sudo systemctl enable docker
sudo systemctl is-enabled docker   # should print "enabled"
```

## 3. Copy the project onto the machine

Get the project folder (from the zip, a USB drive, `scp`, or a git repo if
you're using one) onto the server, e.g. into `/opt/yard-management`.

```bash
sudo mkdir -p /opt/yard-management
# copy the extracted project contents into that folder
cd /opt/yard-management
ls   # should show backend/ frontend/ nginx/ docker-compose.yml README.md ...
```

## 4. Configure the backend environment

```bash
cd backend
cp .env.example .env
nano .env   # or vim/whatever's available
```

Fill in real values — **do not leave the example values in production**:

| Variable | What to set it to |
|---|---|
| `JWT_SECRET` | A long random string. Generate one: `openssl rand -hex 32` |
| `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` | The real first login for this deployment. You'll change the password after first login anyway (see step 8), but set something reasonable here since it's what creates the account. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Their real mailbox for Auto Reports. If it's Gmail, this needs an App Password, not the account password — see the note in the main README. |
| `TZ` | Leave as `Asia/Kolkata` unless the client is elsewhere. |
| `DATABASE_URL` | Leave as-is — Docker Compose overrides this with the internal Postgres hostname automatically; the `.env` value is only used if you ever run the API outside Docker. |

`PORT` and `NODE_ENV` can stay as their defaults.

## 5. Point the router at this machine

In the client's internet router admin panel, forward these ports to this
machine's **local** (LAN) IP address:

- **Port 80 → this machine, port 80** (HTTP)
- **Port 443 → this machine, port 443** (only once you've set up HTTPS — see step 9; leave unmapped until then)

If the machine itself has a software firewall (`ufw` on Ubuntu), allow the
port:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 22/tcp   # keep SSH open too, obviously
sudo ufw enable         # only if it isn't already active
```

Do **not** open port 5432 (Postgres) or 4000 (the raw API) to the internet
— the Compose setup already keeps those internal-only by design; this step
is just about not accidentally opening them yourself at the router/firewall
level too.

## 6. Build and start everything

From the project root (`/opt/yard-management`):

```bash
docker compose up -d --build
```

First build takes a few minutes (installing dependencies, compiling
TypeScript, building the React app). Watch it succeed:

```bash
docker compose ps          # all three services should show "running"/"healthy"
docker compose logs -f api # watch for "Yard Management API listening on :4000"
                            # and "[scheduler] started, timezone=Asia/Kolkata"
```

Press `Ctrl+C` to stop tailing logs (the containers keep running).

## 7. Verify it's actually reachable

From the server itself first:

```bash
curl http://localhost/api/health   # should return {"ok":true}
```

Then from **outside** the client's network (e.g. your own laptop on
mobile data, not their office wifi) open:

```
http://<their-static-ip>/
```

You should see the login screen. If it times out, double check the router
port-forward and the server's firewall — those are the two most common
culprits.

## 8. First login and cleanup

1. Log in with the `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` from `.env`.
2. Go to **Settings** and fill in the real company name, address, and
   upload the logo.
3. Go to **Users**, and either change the superadmin password to something
   the client will actually use, or create a separate named superadmin
   account for them and disable/repurpose the generic one — whichever
   fits how they want to manage access.
4. Go to **Masters** and set up their real Importers, CHA, Bays, Cranes,
   Categories, Container Sizes (the app seeds a few sensible defaults on
   first boot, but these need the client's actual data).
5. Go to **Auto Reports** and set up their real scheduled templates with
   the real recipient addresses, then use "Send Now / Test" on one to
   confirm SMTP is actually working end to end.

## 9. HTTPS (once they have a domain)

Right now this serves plain HTTP. Once the client points a domain at their
static IP (an A record), the simplest way to add HTTPS is a Certbot
sidecar or swapping Nginx for a Caddy-based setup that handles Let's
Encrypt automatically. That's a small enough change that it's worth doing
as its own follow-up task rather than guessing at it here — let me know
when they have the domain ready and I'll wire it in properly (including
uncommenting the `443:443` port mapping in `docker-compose.yml` and adding
the actual certificate handling, which isn't in this scaffold yet).

## 10. Backups

Set up a daily Postgres dump via cron. As root (or via `sudo crontab -e`):

```bash
# Runs at 2:30 AM daily, keeps a rolling 14 days of dumps
30 2 * * * docker exec $(docker compose -f /opt/yard-management/docker-compose.yml ps -q postgres) pg_dump -U yard yard_management | gzip > /opt/backups/yard-$(date +\%Y\%m\%d).sql.gz && find /opt/backups -name "yard-*.sql.gz" -mtime +14 -delete
```

Create `/opt/backups` first (`sudo mkdir -p /opt/backups`), and periodically
copy those dumps off the machine (external drive, cloud storage) — a backup
that only lives on the same disk as the database doesn't protect against
disk failure.

## 11. Day-to-day operations

- **Restart everything**: `docker compose restart`
- **Stop everything**: `docker compose down` (data persists in the `pgdata`/`api_uploads` volumes)
- **View logs**: `docker compose logs -f api` (or `nginx`, `postgres`)
- **Deploy an update** (new code from us): replace the changed files, then
  `docker compose up -d --build` again — this rebuilds only what changed
  and restarts the affected containers with minimal downtime.
- **Check the scheduler is alive**: `docker compose logs api | grep scheduler` should show a tick roughly every 20 seconds.

## 12. If something doesn't come up cleanly

- `docker compose logs api` — most issues show up here (a Prisma schema
  mismatch, a missing `.env` value, etc.)
- The README's "Things to verify once you can actually run it" and "If you
  pull updated code and start seeing 500s" sections cover the most common
  first-boot issues, particularly around Prisma schema sync.
