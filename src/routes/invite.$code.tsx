import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/invite/$code")({
  head: () => ({ meta: [{ title: "Join workspace · VDNX Dialer" }] }),
  component: InvitePage,
});

function InvitePage() {
  const { code } = useParams({ from: "/invite/$code" });
  const navigate = useNavigate();
  const [status, setStatus] = useState<"checking" | "needs-auth" | "ready" | "error">("checking");
  const [info, setInfo] = useState<{ org_name?: string; role?: string }>({});

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        setStatus("needs-auth");
        return;
      }
      const { data, error } = await supabase
        .from("org_invites")
        .select("organization_id, role, expires_at, accepted_at, organizations(name)")
        .eq("code", code)
        .maybeSingle();
      if (error || !data) {
        setStatus("error");
        return;
      }
      if (data.accepted_at || new Date(data.expires_at) < new Date()) {
        setStatus("error");
        return;
      }
      setInfo({
        org_name: (data as { organizations?: { name?: string } }).organizations?.name,
        role: data.role,
      });
      setStatus("ready");
    })();
  }, [code]);

  const accept = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return navigate({ to: "/auth" });
    const { data: invite } = await supabase
      .from("org_invites")
      .select("id, organization_id, role, expires_at, accepted_at")
      .eq("code", code)
      .maybeSingle();
    if (!invite || invite.accepted_at || new Date(invite.expires_at) < new Date()) {
      return toast.error("Invite no longer valid");
    }
    const { error: me } = await supabase.from("org_members").insert({
      organization_id: invite.organization_id,
      user_id: u.user.id,
      role: invite.role,
    });
    if (me && !/duplicate/.test(me.message)) return toast.error(me.message);
    await supabase
      .from("org_invites")
      .update({
        accepted_at: new Date().toISOString(),
        accepted_by: u.user.id,
      })
      .eq("id", invite.id);
    await supabase
      .from("profiles")
      .update({ default_organization_id: invite.organization_id })
      .eq("id", u.user.id);
    toast.success("Joined");
    navigate({ to: "/clients" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm text-center space-y-4">
        <h1 className="font-display text-2xl font-semibold">You've been invited</h1>
        {status === "checking" && <p className="text-muted-foreground">Loading...</p>}
        {status === "error" && (
          <p className="text-destructive">This invite is invalid or expired.</p>
        )}
        {status === "needs-auth" && (
          <>
            <p className="text-sm text-muted-foreground">Sign in or create an account to accept.</p>
            <Button onClick={() => navigate({ to: "/auth" })}>Continue to sign in</Button>
          </>
        )}
        {status === "ready" && (
          <>
            <p>
              Join <strong>{info.org_name}</strong> as{" "}
              <span className="capitalize">{info.role}</span>.
            </p>
            <Button onClick={accept} className="w-full">
              Accept invite
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
