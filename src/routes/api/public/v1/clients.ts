import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireApiAuth, getAdmin, jsonError, jsonOk, rateLimit } from "@/lib/api-auth.server";

const ClientInput = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  investment_status: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  external_id: z.string().optional().nullable(),
  source_app: z.enum(["vdnx", "energy", "executive"]).optional().nullable(),
});

export const Route = createFileRoute("/api/public/v1/clients")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireApiAuth(request, ["clients:read"]);
        if (auth instanceof Response) return auth;
        if (!rateLimit(`k:${auth.key_id}`)) return jsonError(429, "Rate limit");
        const url = new URL(request.url);
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);
        const q = url.searchParams.get("q");
        let query = getAdmin()
          .from("clients")
          .select("*")
          .eq("organization_id", auth.organization_id)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
        const { data, error } = await query;
        if (error) return jsonError(500, error.message);
        return jsonOk({ data });
      },
      POST: async ({ request }) => {
        const auth = await requireApiAuth(request, ["clients:write"]);
        if (auth instanceof Response) return auth;
        if (!rateLimit(`k:${auth.key_id}`)) return jsonError(429, "Rate limit");
        let body: unknown;
        try { body = await request.json(); } catch { return jsonError(400, "Invalid JSON"); }
        const parsed = ClientInput.safeParse(body);
        if (!parsed.success) return jsonError(400, parsed.error.message);
        const insert = { ...parsed.data, organization_id: auth.organization_id };
        const { data, error } = await getAdmin()
          .from("clients")
          .upsert(insert as never, parsed.data.external_id ? { onConflict: "organization_id,external_id" as never } : undefined)
          .select()
          .single();
        if (error) return jsonError(500, error.message);
        return jsonOk({ data }, 201);
      },
    },
  },
});
