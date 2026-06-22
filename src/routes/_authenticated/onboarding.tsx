import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentOrg } from "@/lib/current-org";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Get started · VDNX Dialer" }] }),
  component: OnboardingPage,
});

function slugify(s: string) {
  return (
    (s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "workspace") +
    "-" +
    Math.random().toString(36).slice(2, 6)
  );
}

function OnboardingPage() {
  const navigate = useNavigate();
  const { refresh } = useCurrentOrg();
  const [name, setName] = useState("");
  const [orgNumber, setOrgNumber] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const createOrg = async () => {
    if (!name.trim()) return toast.error("Company name required");
    if (!orgNumber.trim()) return toast.error("Organization number required");
    setBusy(true);
    try {
      const { error } = await supabase.rpc("create_organization", {
        p_name: name.trim(),
        p_slug: slugify(name),
        p_company_name: name.trim(),
        p_org_number: orgNumber.trim(),
      });
      if (error) throw error;
      refresh();
      toast.success("Workspace created");
      navigate({ to: "/clients" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const acceptInvite = async () => {
    if (!code.trim()) return toast.error("Invite code required");
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { data: invite, error } = await supabase
        .from("org_invites")
        .select("id, organization_id, role, expires_at, accepted_at")
        .eq("code", code.trim())
        .maybeSingle();
      if (error) throw error;
      if (!invite) throw new Error("Invalid invite code");
      if (invite.accepted_at) throw new Error("Invite already used");
      if (new Date(invite.expires_at) < new Date()) throw new Error("Invite expired");
      const { error: me } = await supabase
        .from("org_members")
        .insert({ organization_id: invite.organization_id, user_id: u.user.id, role: invite.role });
      if (me && !/duplicate/.test(me.message)) throw me;
      await supabase
        .from("org_invites")
        .update({ accepted_at: new Date().toISOString(), accepted_by: u.user.id })
        .eq("id", invite.id);
      await supabase
        .from("profiles")
        .update({ default_organization_id: invite.organization_id })
        .eq("id", u.user.id);
      refresh();
      toast.success("Joined workspace");
      navigate({ to: "/clients" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="font-display text-2xl font-semibold">Welcome</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Create a workspace or join one with an invite code.
        </p>
        <Tabs defaultValue="create">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">Create</TabsTrigger>
            <TabsTrigger value="join">Join</TabsTrigger>
          </TabsList>
          <TabsContent value="create" className="space-y-3 mt-4">
            <Label>Company name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VDNX Sales AS"
            />
            <Label>Organization number</Label>
            <Input
              value={orgNumber}
              onChange={(e) => setOrgNumber(e.target.value)}
              placeholder="e.g. 123 456 789"
            />
            <Button className="w-full" onClick={createOrg} disabled={busy}>
              {busy ? "Creating..." : "Create workspace"}
            </Button>
            <p className="text-center text-xs text-muted-foreground pt-2">
              Don't have a VDNX account?{" "}
              <a
                href="https://vdnx.app/auth"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                Create one at vdnx.app
              </a>
            </p>
          </TabsContent>
          <TabsContent value="join" className="space-y-3 mt-4">
            <Label>Invite code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} />
            <Button className="w-full" onClick={acceptInvite} disabled={busy}>
              {busy ? "Joining..." : "Join workspace"}
            </Button>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
