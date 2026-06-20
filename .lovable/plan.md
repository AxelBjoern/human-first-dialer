# Multi-tenancy + MCP/API connectors

Turn the dialer into a true multi-tenant workspace and expose it as both an MCP server and a REST API so VDNX, Energy system, and VDNX Executive Command can each connect as their own tenant and sync data bidirectionally.

## 1. Tenancy model (org-per-customer)

New tables (all RLS-scoped via `has_org_role(_uid, _org, _role)` security-definer):

- `organizations` — id, name, slug, source_app (nullable: `vdnx` | `energy` | `executive` | null for native), created_at
- `org_members` — org_id, user_id, role (`owner|admin|agent`), unique(org_id,user_id)
- `org_invites` — org_id, email, code, role, expires_at, accepted_at
- `org_api_keys` — org_id, name, key_prefix (visible), key_hash (sha256), scopes[], created_by, last_used_at, revoked_at

Existing tables get `org_id uuid not null` + index, RLS rewritten to `has_org_role(auth.uid(), org_id, 'agent')`:
- `clients`, `call_logs`, `call_reminders`, `profiles.default_org_id`

`handle_new_user` trigger updated: no auto-org. New users land on `/onboarding` to **create org** or **accept invite** (via `/invite/:code`).

Drop the global `agent` role grant — `user_roles` becomes superadmin-only (platform staff). Per-org roles live in `org_members`.

## 2. Org switcher + settings

- Sidebar gets an org switcher (writes `profiles.default_org_id`).
- All queries pass current `org_id` (from a `useCurrentOrg()` context backed by `profiles.default_org_id`).
- `/settings/organization` — members list, invite by email (generates code link), role management.
- `/settings/api-keys` — generate/revoke API keys, copy-once on creation, shows scopes.
- `/settings/connections` — manage inbound connections from the 3 source apps (see §4).

## 3. REST API — `src/routes/api/public/v1/*`

Token auth via `Authorization: Bearer vdnx_<prefix>_<secret>`. Middleware hashes secret, looks up `org_api_keys`, sets org context, updates `last_used_at`.

Endpoints (scoped to caller's org):
- `GET/POST /api/public/v1/clients`, `GET/PATCH /clients/:id`
- `POST /api/public/v1/call-logs`
- `GET/POST /api/public/v1/reminders`, `PATCH /reminders/:id`
- `POST /api/public/v1/webhooks/inbound` — receive client/lead pushes from source apps
- `GET /api/public/v1/me` — returns org info (for connection health checks)

Zod validation on every body. Rate-limit token: 100 req/min via in-memory bucket per key_prefix (best-effort).

## 4. MCP server — `src/routes/api/mcp.ts`

Using `mcp-tanstack-start` + `withMcpAuth`. Same bearer token scheme as REST. Tools:
- `list_clients(query?, limit?)`
- `get_client(id)`
- `create_client({first_name,last_name,phone,...})`
- `update_client(id, patch)`
- `log_call({client_id?, phone, direction, duration_s, outcome_code, notes})`
- `create_reminder({client_id, call_time, note})`
- `list_reminders({done?})`
- `click_to_dial(phone, client_id?)` — enqueues a dial intent the agent UI picks up via Realtime

`POST` only; `GET`/`DELETE` → 405 (per mcp-server-v1 guardrail).

## 5. Outbound sync (dialer consumes from VDNX / Energy / Executive)

`/settings/connections` lets an org admin register an outbound source:
- Pick source_app, paste **base URL** + **API token** of remote project.
- Stored in new `org_connections` table (org_id, source_app, base_url, token_encrypted, last_sync_at, enabled).

Server function `syncFromSource(connection_id)`:
- Fetches `/api/clients` on the remote project, upserts into local `clients` with `vdnx_client_id = external id` + `source_app`.
- Triggered manually ("Sync now" button) and on a schedule via pg_cron hitting `/api/public/v1/sync/run` with a cron token.

Webhook inbound (`POST /api/public/v1/webhooks/inbound`) handles real-time pushes from the 3 apps with HMAC signature (`x-vdnx-signature`, per-connection secret).

## 6. Bidirectional outbound webhooks

`org_webhooks` table (org_id, event, target_url, secret). On `call_logs` insert + `clients` update, a trigger-driven server fn POSTs to subscribers with HMAC. Events: `call.logged`, `client.created`, `client.updated`, `reminder.created`.

## 7. Migration of existing data

One-off SQL: create a default "Legacy" org per existing user, backfill `org_id` on `clients`/`call_logs`/`call_reminders`/`profiles`, add NOT NULL after backfill.

## 8. Docs page

`/settings/api-docs` — static page with curl examples, MCP server URL (`https://<host>/api/mcp`), and per-source-app setup notes for VDNX, Energy, Executive (each gets its own API key + connection record).

---

## Technical details

- **Dependencies**: `mcp-tanstack-start`, `@modelcontextprotocol/sdk`, `zod` (already in), `@noble/hashes` for sha256 of API keys.
- **Token format**: `vdnx_<8-char prefix>_<32-char secret>`. Store `key_prefix` + `sha256(secret)`. Lookup by prefix, constant-time compare hash.
- **Auth middleware for `/api/public/v1/*`**: shared helper `requireApiKey(request)` → `{ org_id, key_id, scopes }`. Uses `supabaseAdmin` (loaded inside handler) to read `org_api_keys` and set `org_id` on a per-request server publishable client via PostgREST `request.jwt.claims` is not viable for API keys — instead, queries explicitly filter by `org_id` from the resolved context (RLS still enforced via service role bypass guarded by the middleware).
- **MCP token validator** reuses `requireApiKey` and stuffs `org_id` into `auth` passed to `mcp.handleRequest`. Each tool's `execute` reads `auth.org_id`.
- **`has_org_role` function** (SECURITY DEFINER, search_path=public): `select exists(select 1 from org_members where user_id=_uid and org_id=_org and role::text >= _role)` — implemented with an ordered role enum cast.
- **Outbound HTTP from server fns**: native `fetch`; HMAC via `node:crypto`.
- **Cron**: pg_cron in Supabase calling `https://project--<id>.lovable.app/api/public/v1/sync/run` every 5 min with `x-cron-token` header (stored as secret `CRON_TOKEN`).
- **Cross-project mapping**: the 3 referenced Lovable projects are *external* from this dialer's POV. Each gets one tenant in the dialer + one API key. Their projects will need a tiny outbound integration on their side to push to `/api/public/v1/webhooks/inbound` (not built here, but documented).

## Out of scope

- Building integration code inside the 3 referenced projects (separate work in those projects).
- OAuth flow for end-user-scoped access (API keys only).
- Billing / per-org quotas beyond rate limiting.
- UI for browsing webhook delivery history (table exists, no UI).

## Build order

1. Migration: orgs, members, invites, api_keys, connections, webhooks; backfill `org_id`; new RLS.
2. Org context + switcher + onboarding + invite accept.
3. API key management UI.
4. `requireApiKey` middleware + REST endpoints under `/api/public/v1/*`.
5. MCP server route with same auth.
6. Outbound sync (pull) + connection settings UI.
7. Inbound webhook receiver + outbound webhook dispatcher.
8. API docs page + cron registration.

Approve and I'll start with the migration.
