import { createFileRoute } from "@tanstack/react-router";
import { requireApiAuth, getAdmin, jsonError, jsonOk } from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/public/v1/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireApiAuth(request);
        if (auth instanceof Response) return auth;
        const { data, error } = await getAdmin()
          .from("organizations")
          .select("id, name, slug, source_app")
          .eq("id", auth.organization_id)
          .single();
        if (error) return jsonError(500, error.message);
        return jsonOk({ organization: data, scopes: auth.scopes });
      },
    },
  },
});
