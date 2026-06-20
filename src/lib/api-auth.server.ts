// Server-only helpers for API-key authenticated REST + MCP endpoints.
// Filename ends with .server.ts so the bundler refuses to ship it to the client.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type ApiAuth = {
  organization_id: string;
  key_id: string;
  scopes: string[];
};

export type AdminClient = ReturnType<typeof getAdmin>;

export function getAdmin() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

export function generateApiKey() {
  const prefix = randomBytes(4).toString("hex"); // 8 chars
  const secret = randomBytes(24).toString("base64url"); // ~32 chars
  const plain = `vdnx_${prefix}_${secret}`;
  return { plain, key_prefix: prefix, key_hash: sha256(secret) };
}

export function parseBearer(header: string | null): string | null {
  if (!header) return null;
  const m = header.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export async function verifyApiKey(token: string): Promise<ApiAuth | null> {
  const m = token.match(/^vdnx_([a-f0-9]{8})_(.+)$/);
  if (!m) return null;
  const [, key_prefix, secret] = m;
  const admin = getAdmin();
  const { data, error } = await admin
    .from("org_api_keys")
    .select("id, organization_id, key_hash, scopes, revoked_at")
    .eq("key_prefix", key_prefix)
    .maybeSingle();
  if (error || !data || data.revoked_at) return null;
  const got = Buffer.from(sha256(secret), "hex");
  const want = Buffer.from(data.key_hash, "hex");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  void admin
    .from("org_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {});
  return { organization_id: data.organization_id, key_id: data.id, scopes: data.scopes ?? [] };
}

export async function requireApiAuth(
  request: Request,
  requiredScopes: string[] = [],
): Promise<ApiAuth | Response> {
  const token = parseBearer(request.headers.get("authorization"));
  if (!token) return jsonError(401, "Missing bearer token");
  const auth = await verifyApiKey(token);
  if (!auth) return jsonError(401, "Invalid or revoked API key");
  for (const s of requiredScopes) {
    if (!auth.scopes.includes(s)) return jsonError(403, `Missing scope: ${s}`);
  }
  return auth;
}

export function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function jsonOk<T>(data: T, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Naive in-memory rate limit (best-effort; per-instance only).
const buckets = new Map<string, { count: number; reset: number }>();
export function rateLimit(key: string, limit = 100, windowMs = 60_000): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}
