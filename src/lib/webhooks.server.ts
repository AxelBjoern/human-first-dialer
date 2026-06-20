// Outbound org_webhooks dispatch (server-only). Fires HMAC-signed POSTs to each
// enabled subscriber for a matching event. Best-effort: never throws, never
// blocks the call path.
import { createHmac } from "node:crypto";
import { getAdmin } from "@/lib/api-auth.server";

export async function fireOrgWebhooks(
  orgId: string,
  event: string,
  payload: unknown,
): Promise<void> {
  try {
    const admin = getAdmin();
    const { data: hooks } = await admin
      .from("org_webhooks")
      .select("id, target_url, secret, event, enabled")
      .eq("organization_id", orgId)
      .eq("enabled", true);
    if (!hooks?.length) return;
    const body = JSON.stringify({ event, data: payload, ts: new Date().toISOString() });
    await Promise.allSettled(
      hooks
        .filter((h) => h.event === event || h.event === "*")
        .map((h) => {
          const sig = createHmac("sha256", h.secret).update(body).digest("hex");
          return fetch(h.target_url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-vdnx-event": event,
              "x-vdnx-signature": sig,
            },
            body,
          }).catch(() => undefined);
        }),
    );
  } catch {
    // swallow — outbound webhooks are best-effort
  }
}
