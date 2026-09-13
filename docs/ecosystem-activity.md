# Ecosystem activity

Atlas has no service backend. Its catalog and review requests go through the
Oxy SDK to the central Oxy API, where the ecosystem collector observes their
actual requests and responses. The SDK update refreshes the browser's
Cloudflare PoP metadata after a network change; this is edge location, not
IP-derived visitor geography.

There is no invented Atlas infrastructure node. The separate server-side
Cloudflare observer below covers static asset requests and visits without an API
request once its dedicated credentials are enabled in the deployed Pages project.

## Cloudflare edge requests

Every deployed frontend request, including static files, runs the shared `@oxy.so/telemetry/edge` observer. Workers use `run_worker_first = true`; Pages builds emit a bundled Advanced Mode `_worker.js` with `_routes.json` including `/*`. The original asset handler still owns responses, redirects, streams, MIME handling and cache headers. This increases Worker/Functions invocations for static requests.

Configure **server-only** bindings `OXY_EDGE_ACTIVITY_ENABLED=true`, `OXY_EDGE_ACTIVITY_API_KEY`, `OXY_EDGE_ACTIVITY_API_SECRET`, and optionally `OXY_EDGE_ACTIVITY_API_URL` (default `https://api.oxy.so`). Use a dedicated activity credential, separate from the backend application credential. Never place these bindings in public Expo/Vite variables or committed files. Enabled publication failures emit a fixed error while preserving website availability. Deployment and valid credentials are required before this is live; a code merge alone does not enable coverage.

Each completed response publishes a batch with incoming and outgoing counters through `ctx.waitUntil`. Failed handlers count only the incoming request. Health, collector and authentication control requests are excluded. No URLs, payloads, IP addresses, user identifiers or query strings are sent. Cloudflare `request.cf.colo` identifies the serving PoP; the visitor endpoint stays unknown, so external static activity is a PoP pulse, not a fabricated geographic arc. Credentials and counters never enter frontend bundles.
