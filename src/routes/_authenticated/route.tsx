import { useEffect, useState } from "react";
import { Outlet, createFileRoute, useNavigate, useRouterState, Link } from "@tanstack/react-router";
import { ChevronsUpDown, Check } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppSidebar } from "@/components/app-sidebar";
import { Softphone } from "@/components/softphone";
import { CallEngineProvider } from "@/lib/call-engine";
import { CurrentOrgProvider, useCurrentOrg } from "@/lib/current-org";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      if (!data.user) navigate({ to: "/auth", replace: true });
      else setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") navigate({ to: "/auth", replace: true });
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <CurrentOrgProvider>
      <CallEngineProvider>
        <SidebarProvider>
          <div className="min-h-screen flex w-full">
            <AppSidebar />
            <div className="flex flex-1 min-w-0">
              <div className="flex-1 flex flex-col min-w-0">
                <header className="h-12 flex items-center border-b border-border bg-card/50 px-2 gap-2">
                  <SidebarTrigger />
                  <OrgSwitcher />
                </header>
                <main className="flex-1 overflow-y-auto">
                  <OrgGate>
                    <Outlet />
                  </OrgGate>
                </main>
              </div>
              <Softphone />
            </div>
          </div>
        </SidebarProvider>
      </CallEngineProvider>
    </CurrentOrgProvider>
  );
}

function OrgGate({ children }: { children: React.ReactNode }) {
  const { memberships, loading } = useCurrentOrg();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    if (memberships.length === 0 && pathname !== "/onboarding" && !pathname.startsWith("/admin")) {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [loading, memberships.length, pathname, navigate]);
  if (loading) {
    return <div className="p-8 text-muted-foreground">Loading workspace...</div>;
  }
  return <>{children}</>;
}

function OrgSwitcher() {
  const { currentOrgId, memberships, setCurrentOrg } = useCurrentOrg();
  const current = memberships.find((m) => m.organization_id === currentOrgId);
  if (memberships.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <span className="font-medium">{current?.organizations.name ?? "Select workspace"}</span>
          {current && (
            <span className="text-xs text-muted-foreground capitalize">({current.role})</span>
          )}
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {memberships.map((m) => (
          <DropdownMenuItem
            key={m.organization_id}
            onClick={() => setCurrentOrg(m.organization_id)}
            className="flex items-center justify-between"
          >
            <div className="flex flex-col">
              <span>{m.organizations.name}</span>
              <span className="text-xs text-muted-foreground capitalize">
                {m.role}
                {m.organizations.source_app ? ` · ${m.organizations.source_app}` : ""}
              </span>
            </div>
            {m.organization_id === currentOrgId && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/onboarding">+ New / Join workspace</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
