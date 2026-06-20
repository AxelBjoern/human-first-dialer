## Diagnosis

The `createApiKey` server function calls `supabaseAdmin` (service-role client), which reads `process.env.SUPABASE_SERVICE_ROLE_KEY` at first use. The secret IS listed in the project secrets panel, but the running dev server's `process.env` doesn't have it — likely because the secret was added/rotated after the dev server started, so the worker is holding stale env.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` both appear in `fetch_secrets`, so this isn't a missing-secret problem — it's a stale-process problem.

## Fix

1. Restart the dev server so the Worker picks up `SUPABASE_SERVICE_ROLE_KEY` from the current secret store.
2. Re-open the "New API key" dialog, enter a name, and click Generate to verify the server function succeeds (returns the one-time plaintext key).
3. If the same error still appears after restart, the secret value is empty in the store — re-set `SUPABASE_SERVICE_ROLE_KEY` via Secrets (paste the service-role key from Supabase → Project Settings → API), then restart again.

No code changes are needed — `client.server.ts` already handles the missing-env case correctly; the bug is purely env propagation.
