# API, Modules & Functions Reference

This is the single source of truth for every HTTP endpoint, module, and
key function in the hub. Keep it updated when routes change.

- **Base URL:** same origin as the site. All routes are prefixed `/api`.
- **Auth:** admin routes require a JWT, sent either as
  `Authorization: Bearer <token>` or the `token` httpOnly cookie set at login.
- **Content type:** JSON in, JSON out.
- **Module gating:** a module's routes exist **only when the module is
  enabled** (see [Modules](#modules)). Requests to a disabled module's path
  return `404`.

---

## Table of contents

- [Modules](#modules)
- [Core endpoints](#core-endpoints)
- [Auth](#auth-endpoints-core)
- [Links module](#links-module-apilinks)
- [Projects module](#projects-module-apiprojects)
- [About module](#about-module-apiabout)
- [Contact module](#contact-module-apicontact)
- [Health module](#health-module-apihealth)
- [Analytics module](#analytics-module-apianalytics)
- [Server functions](#server-functions)
- [Client functions](#client-functions)

---

## Modules

Each module is a self-contained feature under `server/src/modules/<id>/`.
The registry mounts a module only if its env flag is truthy. A disabled
module contributes **no routes, no tables, no manifest entry** — the
frontend reads the manifest and hides what isn't there.

| id | Name | Public UI | Env flag | Purpose |
|----|------|-----------|----------|---------|
| `tiles` | Dashboard | ✅ | `MODULE_TILES` | **The grid of tiles that makes up the site.** Drag/resize dashboard; service + Minecraft status |
| `analytics` | Analytics | ⛔ (admin only) | `MODULE_ANALYTICS` | Tile/link-click tracking |
| `contact` | Contact | ✅ | `MODULE_CONTACT` | Public form + admin inbox *(legacy, off by default)* |
| `links` | Links | ✅ | `MODULE_LINKS` | *(legacy section — superseded by tiles, off by default)* |
| `projects` | Projects | ✅ | `MODULE_PROJECTS` | *(legacy section — superseded by tiles, off by default)* |
| `about` | About | ✅ | `MODULE_ABOUT` | *(legacy section — superseded by tiles, off by default)* |
| `health` | Health | ⛔ (admin only) | `MODULE_HEALTH` | *(legacy — status now lives on service tiles, off by default)* |

`MODULE_TILES` and `MODULE_ANALYTICS` default **on**; the rest default **off**
(set a flag to `true` to re-enable). `false`/`0`/`off` disables.

---

## Dashboard / tiles module (`/api/tiles`)

The primary content system: a grid of tiles, each with a `type`, a JSON
`config`, a grid position (`x, y, w, h`), and `enabled`. Tile types:
`link`, `banner` (single image/video **or** a cross-fade/Ken-Burns slideshow),
`service`, `project`, `text`, `heading`, `contact`, `icons` (icon-only link row),
`download` (uploaded file with optional server-side password, **or** an
`external_url` linking to a file hosted elsewhere — no size cap, no password),
`embed` (allow-listed
iframe: YouTube/Vimeo/Maps/CodePen/Spotify…), `command` (copy-to-clipboard
snippet), `clock` (live clock or countdown), `weather` (Open-Meteo), `rss`
(RSS/Atom feed). A download tile's `password` is write-only — hashed with bcrypt
into `download_secrets`, never returned; the file lives outside the public
`/uploads` dir and is reachable only through the gated route below.

Any non-banner tile may set `config.bg_image` (a URL, or an uploaded image/video
URL) for a per-tile background — images and MP4/WebM video both work, with
`config.bg_audio` to unmute a video. Banners use `config.image_url` plus
`config.parallax` (JS scroll drift) and `config.audio` (unmute video). `contact`
tiles post to the contact module, so `MODULE_CONTACT` must be enabled (default on).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/tiles` | — | Enabled tiles, ordered for layout. |
| `GET` | `/api/tiles/status` | — | Latest status snapshot for service tiles: `{ statuses: { [tileId]: { status, code, latency_ms, players_online, players_max, motd, version, checked_at } } }`. |
| `GET` | `/api/tiles/all` | ✅ | All tiles incl. disabled. |
| `POST` | `/api/tiles` | ✅ | Create a tile `{ type, config, x, y, w, h, enabled }`. |
| `POST` | `/api/tiles/upload` | ✅ | Upload an image or MP4/WebM video (multipart `file`, ≤64 MB). Returns `{ url }` served from `/uploads/…` (stored on the volume). |
| `POST` | `/api/tiles/upload-file` | ✅ | Upload any file for a download tile (multipart `file`, ≤200 MB). Returns `{ file, filename, size }`; stored in a non-public dir. |
| `POST` | `/api/tiles/:id/download` | — | Download a `download` tile's file. Body `{ password }` required when the tile is protected. Streams the file as an attachment. |
| `GET` | `/api/tiles/weather?lat=&lon=` | — | Current conditions via Open-Meteo. |
| `GET` | `/api/tiles/geocode?q=` | ✅ | Place-name → coordinates (Open-Meteo geocoding). |
| `GET` | `/api/tiles/:id/feed` | — | Fetch + parse an `rss` tile's configured feed (5-min cache). |
| `PUT` | `/api/tiles/layout` | ✅ | Bulk-save grid positions: `{ layout: [{ i, x, y, w, h }] }`. |
| `PUT` | `/api/tiles/:id` | ✅ | Update a tile's `config` / `enabled` / position. |
| `DELETE` | `/api/tiles/:id` | ✅ | Delete a tile. |
| `POST` | `/api/tiles/status/refresh` | ✅ | Re-check all service tiles now. |

Uploaded images are served as static files from `/uploads` (path set by
`UPLOADS_PATH`, defaulting next to the database so they persist on the same
Railway volume).

**Service tiles** are polled every `HEALTH_INTERVAL_MS`. `kind: "web"` does an
HTTP probe (up/degraded/down + latency + code); `kind: "minecraft"` does a
native Server List Ping over TCP (`host`, optional `port`, SRV-aware) and
returns online/offline + player count + MOTD + version — no third-party service.

---

## Core endpoints

Always present (not part of any toggleable module).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/healthz` | — | Liveness probe. `{ ok, ts }`. Used by Railway. |
| `GET` | `/api/modules` | — | Manifest of enabled modules: `{ modules: [{ id, name, icon, public }] }`. Drives the frontend. |
| `GET` | `/api/system` | ✅ | Admin diagnostics: database internals (size, WAL, pages, journal mode, per-table row counts), volume/disk usage, uploads + protected-file totals, and runtime info. Powers the admin **System** page. |
| `GET` | `/api/files` | ✅ | Lists every file on the volume (media + protected downloads) with size, type, date, and whether it's referenced by a tile. Powers the admin **Files** page. |
| `GET` | `/api/files/protected/:name` | ✅ | Admin download of a protected file (bypasses the per-tile password gate). |
| `DELETE` | `/api/files/:store/:name` | ✅ | Delete a file. `store` is `uploads` or `protected`. |

---

## Auth endpoints (core)

Mounted at `/api/auth`. Admin account is seeded on first boot from
`ADMIN_USERNAME` / `ADMIN_PASSWORD`.

| Method | Path | Auth | Body | Description |
|--------|------|------|------|-------------|
| `POST` | `/api/auth/login` | — | `{ username, password }` | Returns `{ token, user }` and sets the `token` cookie. `401` on bad credentials. |
| `POST` | `/api/auth/logout` | — | — | Clears the cookie. |
| `GET` | `/api/auth/me` | ✅ | — | Returns `{ user: { sub, username } }` for the current token. |

---

## Links module (`/api/links`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/links` | — | Enabled links, ordered by `sort_order`. |
| `GET` | `/api/links/all` | ✅ | All links incl. disabled. |
| `POST` | `/api/links` | ✅ | Create a link. |
| `PUT` | `/api/links/:id` | ✅ | Partial update. |
| `DELETE` | `/api/links/:id` | ✅ | Delete. |

**Link object:** `{ id, label, url, icon, description, category, sort_order, enabled, created_at }`
(`icon` is a FontAwesome name without the `fa-` prefix.)

---

## Projects module (`/api/projects`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/projects` | — | Enabled projects, ordered. |
| `GET` | `/api/projects/all` | ✅ | All projects incl. disabled. |
| `POST` | `/api/projects` | ✅ | Create a project. |
| `PUT` | `/api/projects/:id` | ✅ | Partial update. |
| `DELETE` | `/api/projects/:id` | ✅ | Delete. |

**Project object:** `{ id, title, description, url, repo_url, tags[], icon, image_url, sort_order, enabled, created_at }`

---

## About module (`/api/about`)

A single record (id = 1).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/about` | — | The about record. |
| `PUT` | `/api/about` | ✅ | Replace the about record. |

**About object:** `{ id, name, headline, bio, avatar_url, socials[], skills[], updated_at }`
where `socials[]` is `{ label, url, icon }`.

---

## Contact module (`/api/contact`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/contact` | — | Submit a message. Rate-limited (10/hour/IP). Includes a `website` honeypot field that must be empty. |
| `GET` | `/api/contact` | ✅ | Inbox: `{ messages[], unread }`. |
| `PATCH` | `/api/contact/:id/read` | ✅ | Mark a message read. |
| `DELETE` | `/api/contact/:id` | ✅ | Delete a message. |

**Message object:** `{ id, name, email, message, read, created_at }`

---

## Health module (`/api/health`)

Admin-defined services are pinged every `HEALTH_INTERVAL_MS` (default 60s).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/health/services` | ✅ | Services with latest status. |
| `POST` | `/api/health/services` | ✅ | Add a service `{ name, url }`. |
| `PUT` | `/api/health/services/:id` | ✅ | Update a service. |
| `DELETE` | `/api/health/services/:id` | ✅ | Remove a service. |
| `POST` | `/api/health/check` | ✅ | Ping all services now and return results. |

**Service object:** `{ id, name, url, enabled, sort_order, last_status, last_code, last_latency_ms, last_checked, created_at }`
where `last_status ∈ { up, degraded, down }`.

---

## Analytics module (`/api/analytics`)

Decoupled from links — stores a numeric `link_id` with no foreign key, so
it works even if the links module is disabled.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/analytics/click` | — | Record a click `{ linkId }`. Fire-and-forget. |
| `GET` | `/api/analytics/summary` | ✅ | `{ total, perLink[], daily[] }` (daily = last 14 days). |

---

## Server functions

Key exported functions, by file.

### `server/src/config.ts`
- `config` — resolved, typed configuration object.
- `assertProductionSafety()` — warns on insecure prod settings (default password / missing secret).

### `server/src/db.ts`
- `getDb()` — opens (once) the SQLite database with WAL + foreign keys.
- `migrateCore(db)` — creates the `admins` table.
- `seedAdmin(db)` — inserts the admin account from config if none exists.

### `server/src/logger.ts`
- `createLogger(scope)` → `{ info, warn, error, debug }`.
- `log` — default app-scoped logger.

### `server/src/auth/auth.ts`
- `createRequireAuth()` → Express middleware enforcing a valid admin JWT.
- `createAuthRouter(db, requireAuth)` → the `/api/auth` router.

### `server/src/modules/registry.ts`
- `registerModules(ctx)` → `{ apiRouter, enabled, manifest }`. Mounts only
  enabled modules; a module that throws while mounting is skipped, not fatal.

### Each module (`server/src/modules/<id>/index.ts`)
Exports a default `HubModule`: `{ id, name, icon, public, isEnabled, migrate?, register, start? }`.
- `isEnabled(config)` — reads the module's env flag.
- `migrate(ctx)` — creates the module's tables.
- `register(ctx)` — returns the module's router.
- `start(ctx)` — optional background work (the health poller).

### `server/src/index.ts`
- `main()` — wires middleware, auth, modules, the SPA fallback, and listens.

---

## Client functions

### `client/src/api.ts`
- `api.get / post / put / patch / del` — typed fetch helpers (attach Bearer token, throw `ApiError` on non-2xx).
- `getToken() / setToken()` — admin token persistence (localStorage, guarded).
- `trackClick(linkId)` — fire-and-forget analytics ping.
- `ApiError` — error with `status` + `message`.

### `client/src/icons.ts`
- `resolveIcon(name)` — maps a stored icon name to a FontAwesome definition (brands → solid → fallback). **FontAwesome is the only icon source.**

### `client/src/App.tsx`
- `App` — path router: `/admin*` → `AdminApp`, else `PublicSite`.
- `PublicSite` — fetches `/api/modules` and renders only enabled public modules, in a fixed order.

### Module & admin components
- `client/src/modules/*` — `AboutModule`, `LinksModule`, `ProjectsModule`, `ContactModule` (each self-fetches; returns `null` if unreachable).
- `client/src/admin/*` — `AdminApp` (auth + tabs from manifest), `Login`, and per-module editors (`LinksAdmin`, `ProjectsAdmin`, `AboutAdmin`, `ContactAdmin`, `HealthAdmin`, `AnalyticsAdmin`).
