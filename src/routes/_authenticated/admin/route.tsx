import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { LayoutDashboard, Building2, Tags, ShieldCheck, ArrowLeft } from "lucide-react";
import { usePlatformStaff } from "@/lib/use-platform-staff";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  head: () => ({ meta: [{ title: "VDNX Admin" }] }),
  component: AdminLayout,
});

const nav = [
  { url: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { url: "/admin/customers", label: "Customers", icon: Building2 },
  { url: "/admin/plans", label: "Plans", icon: Tags },
  { url: "/admin/staff", label: "Staff", icon: ShieldCheck },
];

function AdminLayout() {
  const { data, isLoading } = usePlatformStaff();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  useEffect(() => {
    if (!isLoading && !data?.isStaff) navigate({ to: "/", replace: true });
  }, [isLoading, data, navigate]);

  if (isLoading || !data?.isStaff) {
    return <div className="p-8 text-muted-foreground">Checking access…</div>;
  }

  return (
    <div className="flex min-h-full">
      <aside className="w-56 border-r border-border bg-card/30 p-3 flex flex-col gap-1">
        <Link
          to="/"
          className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to app
        </Link>
        <div className="px-3 pb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
          VDNX Admin · {data.role}
        </div>
        {nav.map((n) => {
          const active = n.exact ? pathname === n.url : pathname.startsWith(n.url);
          return (
            <Link
              key={n.url}
              to={n.url}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm",
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-foreground/80 hover:bg-muted",
              )}
            >
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          );
        })}
      </aside>
      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
