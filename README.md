# VibeCheck

**Website quality intelligence** — a full-stack SaaS application that turns a public website URL into a visual and technical audit report.

VibeCheck is delivered as a monorepo with a Next.js App Router frontend, a Django REST Framework API, PostgreSQL persistence, Celery/Redis background processing, Playwright browser inspection, Lighthouse performance measurement, and a dedicated SSRF-aware outbound proxy.

## Product capabilities

- Email/password registration and sign-in with short-lived JWT access tokens and rotating refresh tokens held in **HttpOnly, same-origin cookies** by the Next.js API bridge.
- User/admin roles, account isolation, throttled audit creation and configurable daily usage policy.
- Asynchronous website analysis lifecycle: queued → running → completed/failed, with persistent status and report history.
- Public URL validation, DNS/IP checks, HTTP/HTTPS-only policy, standard web ports, and a dedicated outbound proxy that resolves and pins an approved public IP before opening a connection.
- Playwright inspection at desktop (1440 × 1000) and mobile (390 × 844) viewports; screenshots are stored in the shared media volume and served through authenticated or token-scoped endpoints.
- DOM-based checks for title/metadata, heading outline, navigation and main landmarks, accessible names, image alt text, sampled text contrast, mobile overflow, typography variety and color-token variety.
- Lighthouse Performance, Accessibility, Best Practices and SEO category values plus selected timing metrics when Lighthouse completes.
- Optional OpenAI-compatible vision/text analysis. AI findings are explicitly marked as **AI judgments** and do not change numeric category scores.
- Transparent numeric scores: measured rule findings deduct 3 / 6 / 12 / 20 points for low / medium / high / critical issues. Performance is the Lighthouse Performance category. The overall score is the arithmetic mean of available category scores; unavailable measurements are excluded rather than fabricated.
- Persistent saved websites, search/filter/pagination, favorites and side-by-side comparisons of 2–4 completed reports.
- Shareable read-only report links, PDF export and JSON export.
- Admin workspace for operational counters, job review/retry, users/roles, AI provider configuration, usage limits and public-sharing policy.
- English and Persian UI with LTR/RTL switching, localized date/number formatting, responsive desktop/tablet/mobile layouts and reduced-motion handling.
- OpenAPI schema and Swagger UI.

## Architecture

```text
Browser
  │
  ▼
Next.js 16 App Router (port 3000)
  ├── Same-origin /api/session/*  → login/register/logout, HttpOnly cookies
  └── Same-origin /api/backend/*  → Django API bridge + JWT refresh
                                      │
                                      ▼
                            Django 6.1 + DRF 3.18 (port 8000)
                               │          │
                               │          ├── PostgreSQL 17 (persistent records)
                               │          └── Redis 7.4 (Celery broker/results)
                               ▼
                         Celery browser-analysis worker
                               │
                               ▼
                    SSRF-aware egress proxy :8888
                               │
                               ▼
                         Public HTTP/HTTPS sites
```

The Docker `app` network is internal-only. The proxy is the only service attached to the separate outbound `egress` network. The browser is configured to use that proxy without loopback bypasses. The application performs syntax and literal-IP validation before queueing; it deliberately does not perform an independent DNS lookup. The proxy is authoritative for DNS: it accepts HTTPS `CONNECT` only on port 443 and absolute HTTP `GET`/`HEAD` only on port 80, rejects internal/reserved names and addresses, resolves DNS itself, and connects to the validated IP rather than resolving again at connect time. Browser routing independently rejects non-HTTP schemes and obvious local targets, while the proxy enforces the actual destination IP. This materially reduces SSRF and DNS-rebinding risk. Keep the proxy private to the Compose network.

## Repository layout

```text
vibecheck/
├── backend/
│   ├── config/                 # Django project, security, settings, Celery
│   ├── apps/accounts/          # User model, registration, JWT endpoints
│   ├── apps/audits/            # Analyses, reports, comparisons, admin APIs
│   │   ├── services/           # URL guard, browser analysis, scoring, AI adapter
│   │   ├── tasks.py             # Celery tasks
│   │   └── migrations/         # Committed initial migrations
│   ├── Dockerfile
│   └── requirements.txt
├── egress-proxy/               # Dedicated fail-closed outbound proxy
├── frontend/
│   ├── src/app/                # App Router pages and same-origin route handlers
│   ├── src/components/         # Design system and reusable UI
│   ├── src/lib/                # Typed API client, locale, formatting, session
│   └── Dockerfile
├── docker-compose.yml
└── .env.example
```

## Requirements

- Docker Engine and Docker Compose v2.33.1 or later (the Compose file uses network gateway priority to keep the egress proxy's default route explicit).
- For running the frontend outside Docker: Node.js 22 or later and npm.
- For running the backend outside Docker: Python 3.12 or later, PostgreSQL 17-compatible server, Redis 7-compatible server, Node.js 22+ (for Lighthouse), and Playwright Chromium system dependencies.

Framework pins used by this source package:

- Next.js `16.4.4`, React `19.2.0`
- Django `6.1.3`, Django REST Framework `3.18.3`
- Tailwind CSS `4.3.4`
- Playwright Python `>=1.55,<2`; Lighthouse `13.6.0` (Node.js 22+).

Update framework pins through a reviewed dependency update and rebuild the images to pick up security patches.

## Quick start with Docker Compose

1. Copy the example environment file:

   ```bash
   cp .env.example .env
   ```

2. Generate secrets. Use URL-safe passwords for the Compose connection strings, and never commit `.env`:

   ```bash
   python -c "import secrets; print('DJANGO_SECRET_KEY=' + secrets.token_urlsafe(64)); print('POSTGRES_PASSWORD=' + secrets.token_urlsafe(32)); print('REDIS_PASSWORD=' + secrets.token_urlsafe(32))"
   ```

   Copy the three generated values into `.env`. Keep the same `DJANGO_SECRET_KEY` for the lifetime of the installation: the AI provider API key is encrypted using a key derived from it. Changing it without re-encrypting the provider key makes the existing encrypted key unreadable.

3. Build and start the services:

   ```bash
   docker compose up --build -d
   docker compose ps
   ```

4. Create the first administrator:

   ```bash
   docker compose exec api python manage.py createsuperuser
   ```

   Enter the administrator email and a strong password (12+ characters). The custom user manager marks this account as `admin` and `is_staff`.

5. Open the application:

   - Web app: <http://localhost:3000>
   - Django admin: available internally at `/django-admin/` on the API container; do not publish port 8000 in production.
   - OpenAPI schema: `/api/schema/` on the API service.
   - Swagger UI: `/api/docs/` on the API service (requires authentication under the default API permission policy).

6. Follow worker activity when running the first audit:

   ```bash
   docker compose logs -f worker egress-proxy
   ```

The API service applies committed migrations and runs `collectstatic` on startup. The worker shares the same media volume so screenshots written by the analysis task are available to the API service.

## Local development without Docker

Run PostgreSQL and Redis separately, and provide the same environment variables as `.env.example` plus:

```env
DATABASE_URL=postgresql://vibecheck:password@127.0.0.1:5432/vibecheck
CELERY_BROKER_URL=redis://:redis-password@127.0.0.1:6379/0
CELERY_RESULT_BACKEND=redis://:redis-password@127.0.0.1:6379/1
EGRESS_PROXY_URL=http://127.0.0.1:8888
HTTP_PROXY=http://127.0.0.1:8888
HTTPS_PROXY=http://127.0.0.1:8888
DJANGO_DEBUG=true
SECURE_SSL_REDIRECT=false
```

You must run the `egress-proxy` service (or an equivalent SSRF-safe egress proxy) before running browser analysis. Do **not** point the analyzer directly at the public internet or disable its SSRF checks.

Backend:

```bash
cd backend
python -m venv .venv
# Windows PowerShell: .\.venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
playwright install --with-deps chromium
npm install --global lighthouse@13.6.0
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 0.0.0.0:8000
```

In a second terminal:

```bash
cd backend
# Activate the same virtual environment
celery -A config worker --loglevel=INFO --concurrency=2 --prefetch-multiplier=1
```

In another terminal:

```bash
cd frontend
npm install
# Set BACKEND_INTERNAL_URL=http://127.0.0.1:8000 for local non-Docker Next.js.
npm run dev
```

For local non-Docker frontend development, create `frontend/.env.local` with:

```env
BACKEND_INTERNAL_URL=http://127.0.0.1:8000
```

## Useful commands

```bash
# View service state and logs
docker compose ps
docker compose logs -f api worker egress-proxy frontend

# Run backend tests
docker compose exec api python manage.py test apps.accounts.tests apps.audits.tests

# Check Django configuration
docker compose exec api python manage.py check

# Create a new migration after changing models
docker compose exec api python manage.py makemigrations

# Apply migrations explicitly
docker compose exec api python manage.py migrate

# Run frontend type/lint checks from the frontend directory
npm run typecheck
npm run lint

# Stop services without deleting persistent data
docker compose down

# Destructive: remove Postgres, Redis and media volumes
docker compose down -v
```

## API outline

Base path: `/api/v1/`

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `auth/register/` | Create a regular user |
| POST | `auth/token/` | Obtain JWT pair |
| POST | `auth/token/refresh/` | Rotate/refresh JWT |
| GET | `auth/me/` | Current user |
| GET, POST | `analyses/` | List history / enqueue a new audit |
| GET, PATCH | `analyses/{id}/` | Read report / update favorite state |
| POST | `analyses/{id}/retry/` | Retry a failed analysis |
| POST | `analyses/{id}/share/` | Create a public share link |
| GET | `analyses/{id}/screenshot/{desktop\|mobile}/` | Owner-only screenshot |
| GET | `analyses/{id}/export.pdf/` | Download PDF report |
| GET | `analyses/{id}/export.json/` | Download JSON report data |
| GET, POST | `saved-websites/` | List / save websites |
| GET, POST | `comparisons/` | List / create comparisons |
| GET, DELETE | `comparisons/{id}/` | Read / delete a comparison |
| GET | `shared/{token}/` | Read-only public report |
| GET | `shared/{token}/screenshot/{kind}/` | Token-scoped public screenshot |
| GET | `admin/overview/` | Admin operational metrics |
| GET | `admin/analyses/` | Admin job queue / failures |
| POST | `admin/analyses/{id}/retry/` | Admin retry |
| GET | `admin/users/` | Admin user list |
| PATCH | `admin/users/{id}/` | Admin role / activation change |
| GET, PUT | `admin/settings/` | AI provider and usage policy |

Pagination uses DRF page-number pagination (`page`, `page_size`, capped at 100). Analyses support `status`, `is_favorite`, `search`, and ordering filters. API errors use a consistent `error.status` and `error.detail` envelope.

## Scoring model

The score engine is intentionally inspectable. It does not ask a language model to invent numeric grades.

| Category | Source |
|---|---|
| Visual design | Measured sample of computed font-family and color-token variety |
| User experience | Measured navigation landmark presence and accessible control signals |
| Responsiveness | Real 390px viewport layout/overflow measurement |
| Performance | Lighthouse Performance category, scaled to 0–100 |
| Accessibility | DOM checks for accessible names, image alt attributes and sampled contrast risks |
| Content structure | Document title, description, heading outline and content/landmark signals |

For the five rule-based categories, every measured finding applies a documented severity deduction: low 3, medium 6, high 12, critical 20. A category cannot fall below 0. The overall score is the arithmetic mean of category scores that are actually available; Lighthouse performance is omitted from that mean when Lighthouse is unavailable. AI-generated findings and recommendations are labeled separately and never affect scores.

The accessibility checks are useful heuristics, **not a complete WCAG audit or certification**. Contrast is sampled from visible elements and does not cover every state, overlay, image or composited background. Lighthouse and browser results also vary with network conditions, geography, server state and third-party scripts.

## Security notes

- URLs accept HTTP/HTTPS only, scheme-matched standard ports 80/443, and public global IP destinations. Localhost, literal private/reserved addresses and internal suffixes are rejected before enqueue. DNS names are authoritatively checked by the egress proxy before each outbound connection; mixed public/private DNS answers are rejected and the connection is pinned to the verified address.
- The browser uses a private egress proxy. The proxy resolves hostnames itself and connects to an approved IP address, preventing DNS changes between a separate validation lookup and the outbound TCP connection.
- Chromium is headless, runs as an unprivileged container user, uses a per-task browser process, blocks service workers, disables WebRTC and has navigation/resource limits. Browser egress has no direct internet route in the Compose network. The host kernel must permit Chromium's unprivileged user-namespace sandbox; do not solve sandbox failures by adding `--no-sandbox`.
- Only HTTP GET/HEAD and HTTPS CONNECT requests are accepted by the proxy; ports 80 and 443 only. The proxy has connection and transfer caps.
- Passwords use Django's configured password validators. JWTs are held in HttpOnly cookies by the Next.js server route handlers, not `localStorage`; refresh-token rotation uses the SimpleJWT blacklist app. The Docker Compose `AUTH_COOKIE_SECURE` value must be `true` behind HTTPS and may be `false` only for local HTTP development.
- Admin APIs require staff authorization. Analysis and saved-site queries are scoped to the authenticated owner. Public report access requires an unguessable UUID share token.
- AI provider keys are encrypted at rest; only a boolean `api_key_configured` is returned to the admin UI.
- Production must use HTTPS at the public reverse proxy, a strong unique Django secret, strong database/Redis passwords, private media storage, regular backups and restricted admin access.

### Production reverse proxy

Publish only the frontend to the host. Terminate TLS in Caddy, Nginx or a managed ingress and proxy requests to the frontend on `127.0.0.1:3000`. Keep Django, PostgreSQL, Redis and the egress proxy private. Set production environment values:

```env
DJANGO_DEBUG=false
SECURE_SSL_REDIRECT=true
DJANGO_ALLOWED_HOSTS=api,your-domain.example
CSRF_TRUSTED_ORIGINS=https://your-domain.example
CORS_ALLOWED_ORIGINS=https://your-domain.example
AUTH_COOKIE_SECURE=true
```

The Next.js route handlers pass the external forwarded protocol to Django so HTTPS enforcement works while the API call itself remains on the private Docker network. Trust forwarded headers only from your own reverse proxy.

## Operational caveats

- Lighthouse depends on Chromium and the target's ability to load within the configured time budget. A failed Lighthouse run is reported as unavailable; the other measured inspection results can still complete.
- Sites that block automated browsers, require authentication, use bot challenges, or exceed navigation/resource limits may fail. VibeCheck does not attempt to bypass access controls.
- The first implementation analyzes the submitted page and captures its desktop/mobile views. It does not crawl an unlimited site map or authenticate into private member pages.
- Configure an AI provider in **Administration → Settings** to enable optional vision-based design judgments. Without credentials, the measured browser report and rule-based recommendations remain available.
- The worker uses polling on the report page rather than WebSockets; this is sufficient for the current job lifecycle and avoids maintaining a real-time channel that adds no product value yet.

## Testing

The backend test suite covers custom-user password handling, registration role isolation, URL/SSRF validation, score calculation semantics, owner scoping, analysis creation/queueing and daily usage limits. The egress proxy also has an offline standard-library regression suite for loopback denial, internal hostnames, mixed DNS answers and verified-IP pinning:

```bash
python -m unittest discover -s egress-proxy -p 'test_*.py' -v
```

The production browser/Lighthouse path requires Docker and an available outbound proxy, so run an end-to-end smoke test after startup:

1. Register and sign in.
2. Submit a public website URL such as `https://example.com`.
3. Confirm the job transitions from queued/running to completed (or a clear failed state).
4. Open the report and confirm desktop/mobile screenshots, measured findings and Lighthouse availability state.
5. Save the website, favorite the report, compare it with another completed audit, and inspect the share link.
6. Download both PDF and JSON exports.
7. Sign in as the admin and verify job status, user activation, AI settings and usage policy.
8. Try `http://127.0.0.1`, `http://localhost`, `http://10.0.0.1` and an unsupported port; each must be rejected before any browser navigation is queued.

---

**VibeCheck is a deployable application foundation with real persistence and asynchronous browser processing.** Before a public launch, complete the production checklist above, pin/scan all transitive dependencies, run the containerized integration smoke tests in your deployment environment, set up centralized error monitoring, and have the SSRF/egress posture reviewed against your hosting network policy.
