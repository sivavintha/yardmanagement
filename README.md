# Yard Management System

Full implementation of the Yard Management LLD: inbound entry with multiple
containers, partial outbound issuance with balance validation, printable gate
passes, stock/outbound reports, and scheduled daily report emails.

- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Backend:** Node.js + Express + TypeScript + Prisma ORM
- **Database:** PostgreSQL
- **Runtime:** Docker Compose (Nginx + API + Postgres)

## ⚠️ Status of this codebase

This was authored end-to-end (schema, API, business rules, UI, deployment
config) but **has not been run or tested** — the environment it was built in
has no network access, so `npm install` was never executed and nothing was
booted against a real database. Treat this as a complete first draft that
needs a normal debug pass, not a verified build. The sections below tell you
exactly how to bring it up and what's most likely to need a fix.

## Project layout

```
yard-management/
├── backend/            Express API, Prisma schema, business logic
├── frontend/            React app
├── nginx/               Nginx config + Dockerfile that builds & serves the frontend
├── docker-compose.yml
└── README.md (this file)
```

## Quick start — local development (no Docker)

You'll need Node.js 20+ and a local Postgres instance (or use `docker compose up postgres` and point at `localhost:5432`).

### 1. Backend

```bash
cd backend
cp .env.example .env
# edit .env: set DATABASE_URL to your local Postgres, set SUPERADMIN_*, SMTP_* etc.
npm install
npx prisma generate
npx prisma db push       # creates tables from schema.prisma
npm run seed              # creates default roles/superadmin/masters
npm run dev                # starts on :4000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                # starts on :5173, proxies /api to :4000
```

Log in with the `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` from your `.env`.

## Quick start — full stack via Docker Compose

```bash
cd backend
cp .env.example .env
# edit .env with real values, especially JWT_SECRET, SUPERADMIN_PASSWORD, SMTP_*

cd ..
docker compose up -d --build
```

This brings up:
- `postgres` — internal only, not published to the host
- `api` — Express API, internal only
- `nginx` — builds the React frontend and serves it on port 80, proxying `/api/*` to the API

Visit `http://localhost` (or the client machine's static IP once deployed).

The API container runs `prisma db push --accept-data-loss` on every boot to
keep the schema in sync — fine for this small deployment where the DB is
disposable. If you later want a real migration history (and to drop the
`--accept-data-loss` flag), run `npx prisma migrate dev --name init` locally
to generate `backend/prisma/migrations/`, commit it, and switch the
Dockerfile's `CMD` to `prisma migrate deploy`.

### If you pull updated code and start seeing 500s on every list screen

That almost always means the Postgres schema is out of sync with
`schema.prisma` — most often because a prior structural change (renamed/
dropped columns, new relations) needs `--accept-data-loss` to apply and
`db push` silently refused without it, leaving the DB on the old shape while
the API code expects the new one. Fix:

```bash
cd backend
npx prisma generate
npx prisma db push --accept-data-loss   # or --force-reset to wipe and start clean
npm run seed                             # only needed after --force-reset
```

If you're on Docker, just `docker compose up -d --build` again — the
Dockerfile's `CMD` now includes `--accept-data-loss` by default.

## Things to verify once you can actually run it

These are the parts most likely to need small fixes on first boot, since none
of this was executed:

0. **Run `npm run build` (tsc) after pulling any update.** My sandbox has no
   network access, so I can never run `tsc`/`npm install` myself — every fix
   is written by hand against my knowledge of TypeScript/Prisma/Zod's APIs,
   not verified by an actual compiler. Real type errors have slipped through
   before (mismatched Prisma `WhereInput` types from string-typed `mode:
   "insensitive"` values, a `jwt.sign()` overload mismatch, `.partial()`
   called on an overly-generic Zod type, a nullable JSON field Prisma
   rejects). If you're running a compiled build (`npm run build && npm
   start`, or Docker) rather than `npm run dev` (tsx watch), a failed build
   silently leaves `dist/` stale — routes that look present in the source
   can 404 forever because the old compiled output is still what's running.
   **Always run `npm run build` after pulling changes and confirm it exits
   clean before assuming new code is live.**

1. **Prisma client generation** — `npx prisma generate` must succeed against
   `schema.prisma` before `tsc` will compile cleanly (the generated types are
   imported throughout `src/routes/*` and `src/jobs/scheduler.ts`).
2. **`FOR UPDATE` raw query in `outbound.ts`** — the row-lock query uses
   `tx.$queryRaw` with a template literal; confirm the Postgres user has
   rights and that this runs inside the `$transaction` callback correctly
   under your Prisma version.
3. **Zod version compatibility** — schemas use `.coerce.date()` and
   `z.record(z.any())`; confirm these match the installed Zod 3.23 API.
4. **`InboundContainer` unique-while-active-stock rule** — enforced in
   application code (`assertContainerNumbersAvailable` in `inbound.ts`), not
   a DB constraint. Double check the query logic once you have real data.
5. **Nodemailer/SMTP** — `src/lib/mailer.ts` assumes standard SMTP auth;
   adjust if the client's mailbox needs OAuth2 or a different transport.
6. **ExcelJS/PDFKit output** — `reportFiles.ts` was written against their
   documented APIs but never run; check column widths / PDF pagination look
   right with real report data.
7. **Cookie-based auth + Nginx proxy** — `proxy_cookie_path / /;` is set so
   the JWT cookie survives the `/api/` proxy; confirm `sameSite`/`secure`
   settings work over plain HTTP on the client's static IP (you may need
   `secure: false` until TLS is configured — currently it's tied to
   `NODE_ENV=production`, which the Docker image sets by default, so update
   `src/routes/auth.ts` if you're serving over HTTP without a cert yet).
8. **Role permission editing UI** — the Users & Roles screen manages users
   and role *assignment*, but menu-level permission editing (view/create/
   edit/void/print/export per role) is only wired up in the API
   (`PUT /api/admin/roles/:id`), not yet as a dedicated form in the UI.

## Deployment on the client machine (per LLD section 9)

1. Install Docker Engine + Docker Compose.
2. Copy this whole project to the client machine.
3. `cd backend && cp .env.example .env` and fill in real secrets (JWT secret,
   superadmin password, SMTP mailbox details once supplied).
4. `docker compose up -d --build`.
5. Configure the router's static public IP to forward ports 80/443 to this
   machine.
6. Once a domain is available, terminate TLS (e.g. certbot + a small Nginx
   tweak, or a reverse proxy in front of this stack) and update the
   cookie settings accordingly.
7. Set up daily `pg_dump` backups of the `postgres` volume to an external
   drive or approved cloud storage (not included here — add a cron job or
   sidecar container calling `pg_dump` against the `postgres` service).

## Phase-1 changes (from client feedback doc)

Applied on top of the original draft:

- **CHA master** added (mirrors Importer), wired into Inbound create/edit and all reports.
- **Searchable dropdowns** (custom `SearchableSelect`, no extra dependency) for Importer, CHA, Category, Bay throughout.
- **Pagination + sorting** added to the Inbound and Outbound list APIs/UI (`?page=&pageSize=&sortBy=&sortDir=`); filtering already existed and was extended with CHA.
- **Responsive layout**: sidebar collapses into a mobile drawer under the `md` breakpoint.
- **Void buttons removed from the Inbound/Outbound list UI.** The void API endpoints still exist server-side (unchanged permissions), just not exposed as buttons — trivial to re-add a button later if needed.
- **Outbound restructured** into a header (`Outbound`) + line items (`OutboundLine`): one outbound entry now picks a single Inbound, then any number of that inbound's containers, each with its **own truck number** and its **own Ex-Bond BE No/Date**. The Outbound list has **Summary** (one row per entry) and **Detail** (one row per container/truck line) tabs.
- **Gate pass** is now a separate entry screen (`/gate-pass/new`): pick the outbound, then pick from its available trucks (manual gate pass number, optional place-from/to and driver details). **One gate pass per truck** — if a truck carries multiple containers from that outbound, the printed pass lists all of them with a total. Creating a gate pass is no longer available inline from the Outbound list.
- **Gate pass printout** now shows the company logo/name (from Settings) and a per-container table with a total.
- **Settings** gained a logo upload control (multer-backed endpoint, 2MB image cap, served from `/uploads`).
- **Dashboard** now shows a 7-day inbound-vs-outbound bar chart and an active-stock-by-category pie chart (via `recharts`), alongside the existing summary cards.
- **Consolidated report** added (Reports → Consolidated tab), matching the layout of the client's original Excel sheet — one row per container showing in-bond BE info alongside every ex-bond issuance against it. Every report tab now has Importer, CHA, Category, and date-range filters.

### On "how do I access the API in the browser?"

`http://localhost:4000/` isn't meant to be opened directly — there's no
route at `/`, only under `/api/*`, and most of those require an
authenticated session cookie the browser won't have on a bare GET. Use the
frontend (`http://localhost:5173` in dev, or port 80 via Nginx in Docker) to
log in and interact with the app; if you want to poke the API directly, use
`curl`/Postman/Insomnia and log in via `POST /api/auth/login` first, or hit
`http://localhost:4000/api/health` for a quick liveness check.

### Structural note for your next validation pass

Because Outbound is now header+line, a few things that used to be simple are
now list-shaped: an outbound's "truck number" is really a set of truck
numbers (one per line), and "issued packages" is a sum across lines. The
Outbound Summary tab and Dashboard already do this aggregation; keep it in
mind if you're comparing against the old single-truck mental model while
reviewing the remaining screens.

## Phase-2 changes (structural rework from legacy-system screenshots + follow-up doc)

This round matched the app's data model to how the actual legacy software works, confirmed against your screenshots and clarifying answers:

- **Auto-numbering everywhere.** Inbond booking no. (`TY000011`), Exbond no. (`EX000001`), Gate Pass no. (`000001`), and Importer/CHA/Bay/Crane codes are all system-generated via a new `Sequence` table, incremented atomically inside the same transaction as the record they number — no more typing booking numbers by hand.
- **Exbond is now one container per entry, multiple truck-lines.** Matches the legacy screen exactly: pick an inbound, pick **one** container, then add as many truck-lines as needed (Truck No, No. of Logs, Ex-BE No/Date, Crane, Weight) to split that container's logs across trucks. Editable until any line is pulled into a gate pass.
- **Gate Pass is truck-centric and can span multiple Exbond entries.** Pick a truck number, and every active un-passed line for that truck — even from different Exbond bookings/containers — gets pulled onto one gate pass, matching your sample printout (3 containers, 1 truck, 1 pass). Place From/To are mandatory; no driver fields (matches the legacy screen, which doesn't have them either).
- **Sec49/Duty Paid**: kept your existing Category master as-is, and added a separate **Duty Paid** checkbox per container (Category already covered the Section-49/Bonding/Non-Bonding distinction, so nothing there needed replacing).
- **Inbound fields realigned to the legacy screen**: removed Truck Number and the header-level Bay (bay is per-container only), added **Crane** and **Weight** per container, relabeled Goods Description → "Cargo", Inbound Date → "Arrival Date", BE No/Date → "In BE No/Date".
- **Masters**: added a Crane master; Importer/CHA now carry Address 1–4, City, Pincode, Contact Person, Email, plus an auto-generated Code that can never be edited; delete is now a **hard delete** restricted to superadmins and blocked outright if the record is referenced anywhere (no more silent soft-disable).
- **New Roles screen** (`/roles`) — a real permission-matrix UI (view/create/edit/void/print/export × every menu) instead of API-only.
- **Company logo/name** now shown in the sidebar and on the gate pass printout (which also gained the missing **Cargo** field, and shows every distinct importer if a pass spans multiple Exbond entries). Fixed the bug where the logo silently failed to load for non-superadmin roles — `GET /api/admin/settings` no longer requires the `settings.view` permission, since every user needs to see company branding regardless of role.
- **Validations**: container numbers checked against the standard 4-letter/7-digit shipping format; phone numbers restricted to digits/+/-/spaces; emails format-checked — on both Importer and CHA masters.
- **Menu labels** renamed to Inbond/Exbond (the underlying routes/API/schema keep the original English names for code clarity — only what's shown to users changed).
- Added a styled login background and a small truck-themed loading indicator (`LoadingTruck`) on first-load states.

### Gmail SMTP

Since you've finished the app-password setup, Auto Reports → "Send Now / Test" should work end to end now. If a test send fails, the error text saved to `ReportDelivery` (visible in the Auto Reports → Recent Deliveries table) will tell you whether it's an auth problem or something else.

## Phase-3 changes (bug fixes + polish)

- **Fixed the real logo bug.** It wasn't a settings problem — the upload's manual `Content-Type: multipart/form-data` header was stripping axios's auto-generated boundary, corrupting the file; and in local dev, Vite only proxied `/api`, not `/uploads`, so even a successful upload 404'd when displayed. Both fixed. (The `proxy.js: disconnected port object` console error is unrelated browser-extension noise, not app code.)
- **Auto-generated codes now shown on the entry screen itself**, not just after saving — Inbound, Outbound, and every coded master preview their next number (e.g. "IB000012") via a new read-only `/api/sequence/peek/:key` endpoint. It's a live preview, not a reservation, so it's labeled provisional; the real number is still assigned atomically at save time.
- **Inbound code prefix changed `TY` → `IB`.**
- **Container number validation tightened** to the exact spec: 4 letters + 6 digits + optional hyphen + 1 check digit (11 chars).
- **Masters**: pagination + search added to every master list; phone fields now strip non-numeric characters as you type instead of rejecting on submit; email is validated on blur, not just at submit.
- **Outbound edit** (until a gate pass is created against it) and **Outbound list filters** (importer/category/date/search) — both now fully wired end to end.
- **Gate Pass printout**: info block is a single column instead of a 2-column grid, the redundant "Gate Pass" heading is gone, and it's set up for clean A4 printing (`@page` CSS + full-width on print).
- **Reports**: added Created Date/Created By to every report; Stock Summary gained Arrival Date/In-BE No/Date; Outbound Detail gained Ex-BE Date; the Consolidated report is now grouped by inbound (one block per inbound with its containers and their ex-bond lines nested underneath) to match your Excel layout, with pagination on all three report views.
- **Auto Reports is now a real multi-template system** — create, edit, pause/resume, and delete named templates, each with its own recipients, filters (including a Party/Importer filter), schedule, and send history.
- **Users**: temp password field has a show/hide eye-icon toggle.

## Phase-4 changes (bug fixes + Excel-exact export)

- **Fixed a real bug**: editing an Exbond entry's issued quantity showed a wrong, inflated "logs available" figure (your 100→105 example). Root cause was a frontend display formula recalculating off the *live value you were typing* instead of the *originally saved* value — the backend's actual balance math was correct the whole time. Now shows both a fixed "Container capacity" and a live "Remaining if you save now."
- **Scheduler robustness**: closed two real gaps that could explain "Send Now works, scheduled auto-send doesn't" — the exact-minute match had zero tolerance for event-loop delay (now checks every 20s instead of 60, safe due to the existing send-lock), and there was no logging to see whether it was ticking at all (now logs every check). Also pinned `process.env.TZ` explicitly rather than relying only on dayjs's per-call timezone conversion, in case the container's OS-level timezone data disagreed with it.
- **Consolidated report "phantom issued qty"**: re-verified the grouping is correctly scoped by container ID, not container number (which can repeat once stock clears) — containers with no Exbond lines show "not yet issued," never a number. Please re-test against this build specifically, since the underlying query was already rewritten in phase 3.
- **In BE No/Date and Ex-BE No/Date are now mandatory**, front and back.
- **Excel export now matches your reference sheet exactly** — merged header cells per inbound group, `UNITS`/`TOTAL LOGS`/`BALANCE UNITS`/`TOTAL BALANCE LOGS` summary rows, same column order. This also now applies to the **emailed attachment**, not just the manual export button (that was a real gap — the scheduler was still using the old flat layout). One honest limitation: your reference sheet has a separate "ACTUAL QTY" column distinct from the BE-stated log count, which this system doesn't track as a separate field — those columns are populated with the same received/balance figures as the "BE WISE" columns. Flagged in code with a comment; let us know if you need that as a real separate field.
- **PDF attachments** now carry full field parity with the Excel exports (Created Date/By, Crane, Weight, etc. — previously a slimmer column set).
- **Roles**: removed the unused "void" column from the permission grid (matches void buttons being removed from the UI everywhere else) and added inline explanations for what View/Create/Edit/Print/Export actually control.
- **Settings**: removed the internal SMTP note from the user-facing page.
- **Pagination**: every list screen (Inbound, Outbound, Masters, Gate Pass, Reports) now has a rows-per-page selector (10/25/50).
- **Gate Pass print** already had the logo-left/name-address-right letterhead, full borders, and signatures pinned to the bottom of the page from the phase-3 pass — verified still correct.
- **Auto Reports** already had separate Templates and Sent Mail tabs from the phase-3 pass — verified still correct.

## Phase-5 changes (bugs finally pinned down with screenshots)

Your screenshots this round made two long-standing bugs conclusively diagnosable — real fixes, not further guessing:

- **Consolidated report "Issued = Received" bug, actually found this time.** Your screenshot showed "not yet issued" correctly in the Out Date column but a number in the Issued column for the same row — that's the tell. The placeholder cell used `colSpan={4}` when the table needs `colSpan={5}` to cover Out Date/Ex-BE No/Ex-BE Date/Truck/Issued; the missing span pushed the Balance cell one column left into the Issued slot. Since Balance equals Received when nothing's been issued yet, it looked exactly like your report. One-line fix.
- **Auto Reports date off-by-one, root cause confirmed.** Your Sent Mail screenshot showed "Sent At: 24-Aug 12:03" right next to "Report Date: 23-Aug" — that pairing pinpointed it. `reportDate.toDate()` on an IST-shifted dayjs value loses the calendar date when Prisma writes it to a date-only Postgres column, because the JS Date's *UTC* components get used, not the intended local ones (IST midnight Aug 24 is 18:30 UTC Aug 23). Fixed with proper `Date.UTC()` construction on the backend, and the same landmine fixed on the frontend's date display.
- **Scheduler reliability rebuilt.** Replaced the exact-minute string match with "time has arrived or passed today, not yet sent" — immune to event-loop delay or a missed tick, since the existing per-day send-lock makes re-checking a due schedule a harmless no-op.
- **Gate Pass print overflow, root cause found.** The page layout's outer padding wasn't marked `no-print`, adding ~13mm on top of an already-oversized forced Card height — together they exceeded the ~269mm printable area on A4, spilling a sliver onto page 2. Fixed the padding and the height math; also added `thead` repeat + `page-break-inside: avoid` CSS so a genuinely long container list still prints cleanly across multiple pages instead of just overflowing.
- **Removed the "container number already has active stock" restriction** on Inbound entirely, per your reasoning — a container can legitimately return on a later date.
- **Bay is now mandatory** per container.
- **Whitespace-only input is rejected everywhere** (a name of just spaces used to save successfully) — new shared `requiredText()` validator trims and rejects blank-after-trim, applied to every required text field across Masters, Inbound, Outbound, Gate Pass, Users, Roles, Settings, and Auto Report templates.
- **Numbered pagination** (1, 2, 3… with smart "…" collapsing for long lists) added to the shared Pagination component, so it applies to every list screen at once.

## Phase-6 changes (dashboard fix, new reports, menu icons)

- **"Daily Report Status" always showing "Not sent" — real bug found, and it wasn't timezone.** The Dashboard was calling `GET /report-schedule/deliveries`, a route that no longer exists after the phase-4 multi-template rewrite (it's now `/deliveries/all`). The 404 was silently swallowed by a fallback, so it always looked like nothing had ever sent. Fixed the URL — and while in there, also fixed a second layer: that endpoint returns a paginated `{items, total, ...}` shape, not a plain array, so the naive fix would have broken again immediately.
- **New Inbound and Gate Pass reports** added to the Reports section, alongside Stock Summary/Outbound Detail/Consolidated — same importer/CHA/category/date-range filters, same Excel/PDF export.
- **Weight removed from Outbound/Exbond** — entry form, list, and reports. Inbound's per-container Weight is untouched (only Outbound was in scope).
- **Icons added to the sidebar menu** (via `lucide-react`).
- **Loading truck animation fixed** — it wasn't just "add a flip," the keyframes had a real logic bug where both halves of the loop moved the same direction, so the flip was only correct on one half. Rewritten as a proper there-and-back animation. Also rolled the loading indicator out to Outbound's list tabs and the Reports page, which didn't have one before.
- **Fixed a broken menu icon import** — `PackageDown`/`PackageUp` aren't real `lucide-react` exports (that was the syntax error breaking the whole bundle); replaced with verified-valid icons (`Download`, `Upload`, etc.), checked directly against Lucide's own docs this time rather than guessed.
- **Removed the "BALANCE LOGS ACTUAL QTY WISE" column** from the Consolidated report's Excel export, per request — "BALANCE LOGS BE WISE" stays.

## Default login

On first boot, `bootstrap.ts` creates:
- Roles: **Superadmin**, **Yard User**, **Viewer** (permissions per the LLD's role table)
- Superadmin user from `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` in `.env`
- Default masters: Stock Categories (Bonding, Non Bonding, Section-49), Container Sizes (20 ft, 40 ft)

**Change the default superadmin password immediately after first login** —
there's no forced-reset flow yet, so this is a manual step.
