import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Phone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Sign in · VDNX Dialer" }] }),
  component: AuthPage,
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

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [orgNumber, setOrgNumber] = useState("");
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/clients" });
  };

  const signUp = async () => {
    if (!firstName || !lastName) return toast.error("First and last name are required");
    if (!companyName.trim()) return toast.error("Company name is required");
    if (!orgNumber.trim()) return toast.error("Organization number is required");
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    if (password !== passwordConfirm) return toast.error("Passwords do not match");

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/clients`,
          data: {
            first_name: firstName,
            last_name: lastName,
            company_name: companyName,
            org_number: orgNumber,
          },
        },
      });
      if (error) throw error;

      // If email confirmation is required, no session yet — stop here.
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        toast.success("Account created. Check your email to confirm, then sign in.");
        return;
      }

      const { error: rpcErr } = await supabase.rpc("create_organization", {
        p_name: companyName.trim(),
        p_slug: slugify(companyName),
        p_company_name: companyName.trim(),
        p_org_number: orgNumber.trim(),
      });
      if (rpcErr) throw rpcErr;

      toast.success("Account and workspace created");
      navigate({ to: "/clients" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Phone className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold">VDNX Dialer</h1>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Agent workspace
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button className="w-full" onClick={signIn} disabled={loading}>
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </TabsContent>

            <TabsContent value="signup" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>First name</Label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Last name</Label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Company name</Label>
                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Organization number</Label>
                <Input
                  value={orgNumber}
                  onChange={(e) => setOrgNumber(e.target.value)}
                  placeholder="e.g. 123 456 789"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Confirm password</Label>
                <Input
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                />
              </div>
              <Button className="w-full" onClick={signUp} disabled={loading}>
                {loading ? "Creating..." : "Create account"}
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
          </Tabs>
        </div>
      </div>
    </div>
  );
}
