import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCustomers } from "@/lib/platform.functions";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { AdminShell } from "@/components/admin-shell";

export const Route = createFileRoute("/_authenticated/admin/customers")({
  component: () => <AdminShell><Customers /></AdminShell>,
});

function Customers() {
  const fn = useServerFn(listCustomers);
  const [q, setQ] = useState("");
  const { data } = useQuery({
    queryKey: ["platform-customers", q],
    queryFn: () => fn({ data: { q: q || undefined } }),
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Customers</h1>
          <p className="text-sm text-muted-foreground">{data?.length ?? 0} workspaces</p>
        </div>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name…"
          className="max-w-xs"
        />
      </div>
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Workspace</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Seats</TableHead>
              <TableHead>Calls (period)</TableHead>
              <TableHead>AI min (period)</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link
                    to="/admin/customers/$orgId"
                    params={{ orgId: c.id }}
                    className="font-medium hover:underline"
                  >
                    {c.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {c.slug}
                    {c.source_app ? ` · ${c.source_app}` : ""}
                  </div>
                </TableCell>
                <TableCell>{c.plan?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>
                  {c.subscription ? (
                    <Badge variant={c.subscription.status === "active" ? "default" : "secondary"}>
                      {c.subscription.status}
                    </Badge>
                  ) : (
                    <Badge variant="outline">none</Badge>
                  )}
                </TableCell>
                <TableCell>{c.seats}</TableCell>
                <TableCell>{c.usage?.calls_count ?? 0}</TableCell>
                <TableCell>{Number(c.usage?.ai_minutes ?? 0).toFixed(1)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(c.created_at).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
