# VDNX Sales → Dialer Integration Prompt (for project `vdnx.app`)

Understood. The Dialer's stable production URL is `https://vdnxdialer.com`, so the secret VDNX must set is:

```
DIALER_BASE_URL = https://vdnxdialer.com
```

All four secrets for VDNX to add:

| Secret | Value / Source |
| --- | --- |
| `DIALER_BASE_URL` | `https://vdnxdialer.com` |
| `DIALER_API_KEY` | Issued from Dialer → Settings → API Keys (scopes: `clients:read`, `clients:write`, `calls:initiate`, `calls:read`, `activity:read`) |
| `DIALER_WEBHOOK_SECRET` | Shared secret — Dialer signs outbound webhooks to VDNX with this (HMAC-SHA256 over raw body) |
| `VDNX_OUTBOUND_WEBHOOK_SECRET` | Shared secret — VDNX signs outbound `client.*` webhooks to Dialer with this |

## Integration prompt to paste into the VDNX project

> VDNX is the system of record for clients. The Dialer (`https://vdnxdialer.com`) is a downstream consumer that pulls clients from VDNX, places human + AI calls, and pushes call/transcript events back.
>
> **Secrets (add via Lovable Cloud secrets, never commit):**
> - `DIALER_BASE_URL` = `https://vdnxdialer.com`
> - `DIALER_API_KEY` (Bearer token for all calls to Dialer REST + MCP)
> - `DIALER_WEBHOOK_SECRET` (verifies inbound webhooks FROM Dialer)
> - `VDNX_OUTBOUND_WEBHOOK_SECRET` (signs outbound webhooks TO Dialer)
>
> **REST that VDNX exposes for Dialer** under `src/routes/api/public/v1/*`, all gated by `Authorization: Bearer DIALER_API_KEY`:
> - `GET /clients` (paginated, stable cursor)
> - `GET /clients/:vdnx_client_id`
> - `PATCH /clients/:vdnx_client_id` (Dialer-writable allowlist: `dnc`, `last_call_outcome`, `last_call_at`, `notes_append`)
> - `POST /clients` (only when `source=dialer`)
> - `GET /segments`, `GET /segments/:id/clients`
> - `GET /health`
>
> **MCP that VDNX consumes from Dialer** at `${DIALER_BASE_URL}/api/mcp`:
> - Transport: HTTP POST, headers `Authorization: Bearer ${DIALER_API_KEY}`, `Accept: application/json, text/event-stream`, `Content-Type: application/json`.
> - Tools namespaced `dialer_*`; mutative tools (`dialer_place_call`, `dialer_enqueue_ai_call`, `dialer_cancel_call_job`, `dialer_set_dnc`) require `needsApproval`.
>
> **Inbound webhook** `POST /api/public/v1/webhooks/dialer` — verify HMAC-SHA256 over raw body with `DIALER_WEBHOOK_SECRET` using `timingSafeEqual` BEFORE `JSON.parse`. Dispatch:
> - `call.started` → insert `vdnx_calls`
> - `call.ended` / `call.completed` / `call.failed` → finalize row + `PATCH` mirror to client
> - `transcript.ready` → insert `vdnx_transcripts`
> - `ai_job.completed` → close call row
> Idempotent on `(event_id, vdnx_call_log_id)`.
>
> **Outbound webhooks** from VDNX → Dialer (`webhooks/outbound.server.ts`): `client.created`, `client.updated`, `client.merged`, `client.dnc_set`. Signed with `VDNX_OUTBOUND_WEBHOOK_SECRET`, exponential backoff up to 6 attempts, persisted in `vdnx_webhook_deliveries`.
>
> **Migration** creates: `vdnx_calls`, `vdnx_transcripts`, `vdnx_outbound_webhooks`, `vdnx_webhook_deliveries` (each with `GRANT`s + `ENABLE RLS` + per-org policies).
>
> **UI**:
> - Settings → Dialer: shows base URL (`https://vdnxdialer.com`), connection status, key rotation, outbound webhook list.
> - Client detail → "Call history" tab + "Call" split button (Human / AI / Schedule AI).
> - `/campaigns`: live segment count → human/AI mode → streaming `dialer_enqueue_ai_call`.
>
> **Bench** (`/admin/dialer-bench`): `clients_read` (10rps×30s, p95<300ms), `mcp_tools_list` (p95<1.5s), `webhook_replay` (tampered must 401), `chat_loop` with `dialer_get_transcript`.
>
> **Acceptance**: inbound call → webhook <5s; transcript ready <60s; `client.dnc_set` webhook <2s; tampered webhook returns 401.

## Open items to confirm with Dialer

- Confirm Dialer emits `transcript.ready` and `ai_job.completed` (only `call.started` / `call.ended` are visible today in this codebase).
- Confirm Dialer's `POST /calls` accepts `vdnx_client_id` as a vendor string or requires its own UUID.
- Confirm `dialer_cancel_call_job` is exposed on the Dialer MCP.

No code changes to this Dialer project — this plan is the prompt that goes into VDNX.
