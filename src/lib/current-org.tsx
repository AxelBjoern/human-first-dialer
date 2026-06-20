import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Membership = {
  organization_id: string;
  role: "owner" | "admin" | "team_lead" | "agent";
  organizations: { id: string; name: string; slug: string; source_app: string | null };
};

interface Ctx {
  currentOrgId: string | null;
  memberships: Membership[];
  loading: boolean;
  setCurrentOrg: (orgId: string) => Promise<void>;
  refresh: () => void;
}

const CurrentOrgContext = createContext<Ctx | null>(null);

export function CurrentOrgProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["my-memberships"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return { memberships: [], defaultOrgId: null as string | null };
      const [{ data: members, error: e1 }, { data: prof }] = await Promise.all([
        supabase
          .from("org_members")
          .select("organization_id, role, organizations(id,name,slug,source_app)")
          .eq("user_id", u.user.id),
        supabase
          .from("profiles")
          .select("default_organization_id")
          .eq("id", u.user.id)
          .maybeSingle(),
      ]);
      if (e1) throw e1;
      return {
        memberships: (members as unknown as Membership[]) ?? [],
        defaultOrgId: prof?.default_organization_id ?? null,
      };
    },
  });

  useEffect(() => {
    if (!data) return;
    if (currentOrgId && data.memberships.some((m) => m.organization_id === currentOrgId)) return;
    const next =
      (data.defaultOrgId &&
        data.memberships.find((m) => m.organization_id === data.defaultOrgId)?.organization_id) ||
      data.memberships[0]?.organization_id ||
      null;
    setCurrentOrgId(next);
  }, [data, currentOrgId]);

  const setCurrentOrg = async (orgId: string) => {
    setCurrentOrgId(orgId);
    const { data: u } = await supabase.auth.getUser();
    if (u.user) {
      await supabase
        .from("profiles")
        .update({ default_organization_id: orgId })
        .eq("id", u.user.id);
    }
    qc.invalidateQueries();
  };

  return (
    <CurrentOrgContext.Provider
      value={{
        currentOrgId,
        memberships: data?.memberships ?? [],
        loading: isLoading,
        setCurrentOrg,
        refresh: () => refetch(),
      }}
    >
      {children}
    </CurrentOrgContext.Provider>
  );
}

export function useCurrentOrg() {
  const ctx = useContext(CurrentOrgContext);
  if (!ctx) throw new Error("useCurrentOrg must be inside CurrentOrgProvider");
  return ctx;
}

export function useRequireOrgId(): string {
  const { currentOrgId } = useCurrentOrg();
  if (!currentOrgId) throw new Error("No organization selected");
  return currentOrgId;
}
