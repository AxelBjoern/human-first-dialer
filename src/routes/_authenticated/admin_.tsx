import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { platformOverview } from "@/lib/platform.functions";
import { Card } from "@/components/ui/card";
import { AdminShell } from "@/components/admin-shell";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "VDNX Admin" }] }),
  component: OverviewRoute,
});

function OverviewRoute() {
  return (
    <AdminShell>
      <Overview />
    </AdminShell>
  );
}

function Overview() {
  const fn = useServerFn(platformOverview);
  const { data } = useQuery({ queryKey: ["platform-overview"], queryFn: () => fn() });

  if (!data) return <div className="p-6 text-muted-foreground">Loading…</div>;

  const mrr = (data.mrr_cents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "EUR",
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Platform overview</h1>
        <p className="text-sm text-muted-foreground">All VDNX customers at a glance.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Workspaces" value={String(data.total_orgs)} />
        <Stat label="Active + trialing" value={String((data.by_status.active ?? 0) + (data.by_status.trialing ?? 0))} />
        <Stat label="Suspended" value={String(data.by_status.suspended ?? 0)} />
        <Stat label="MRR (plan list)" value={mrr} />
      </div>

      <Card className="p-4">
        <div className="text-sm font-semibold mb-3">Last 30 days · calls</div>
        <div className="flex items-end gap-1 h-32">
          {data.trend.length === 0 && (
            <div className="text-sm text-muted-foreground">No usage rolled up yet.</div>
          )}
          {data.trend.map((d) => {
            const max = Math.max(...data.trend.map((t) => t.calls), 1);
            const h = Math.round((d.calls / max) * 100);
            return (
              <div
                key={d.day}
                className="flex-1 bg-primary/30 hover:bg-primary/60 rounded-sm"
                style={{ height: `${h}%` }}
                title={`${d.day}: ${d.calls} calls`}
              />
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="font-display text-2xl font-semibold mt-1">{value}</div>
    </Card>
  );
}
