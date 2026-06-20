import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Phone,
  Users,
  History,
  BellRing,
  LogOut,
  Settings,
  KeyRound,
  Link2,
  BookOpen,
  Bot,
  Headphones,
  BarChart3,
  PhoneCall,
  UsersRound,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/lib/current-org";
import { usePlatformStaff } from "@/lib/use-platform-staff";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

const items = [
  { title: "Clients", url: "/clients", icon: Users },
  { title: "Call history", url: "/history", icon: History },
  { title: "Reminders", url: "/reminders", icon: BellRing },
  { title: "AI Campaigns", url: "/campaigns", icon: Bot },
  { title: "Supervisor", url: "/supervisor", icon: Headphones },
  { title: "Activity", url: "/activity", icon: BarChart3 },
];

const settings = [
  { title: "Workspace", url: "/settings/organization", icon: Settings },
  { title: "Teams", url: "/settings/teams", icon: UsersRound },
  { title: "Telephony", url: "/settings/telephony", icon: PhoneCall },
  { title: "API keys", url: "/settings/api-keys", icon: KeyRound },
  { title: "Connections", url: "/settings/connections", icon: Link2 },
  { title: "API & MCP docs", url: "/settings/api-docs", icon: BookOpen },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { memberships, loading } = useCurrentOrg();
  const { data: staff } = usePlatformStaff();
  const locked = !loading && memberships.length === 0;
  const [settingsOpen, setSettingsOpen] = useState(pathname.startsWith("/settings"));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Phone className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="font-display text-base font-semibold leading-none">VDNX</span>
            <span className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60">
              Dialer
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = pathname === item.url || pathname.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild={!locked}
                      isActive={active}
                      aria-disabled={locked}
                      className={locked ? "pointer-events-none opacity-50" : undefined}
                    >
                      {locked ? (
                        <span>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </span>
                      ) : (
                        <Link to={item.url}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => !locked && setSettingsOpen((v) => !v)}
                  isActive={pathname.startsWith("/settings")}
                  aria-disabled={locked}
                  className={locked ? "pointer-events-none opacity-50" : undefined}
                >
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </SidebarMenuButton>
                {settingsOpen && !locked && (
                  <SidebarMenuSub>
                    {settings.map((s) => (
                      <SidebarMenuSubItem key={s.url}>
                        <SidebarMenuSubButton asChild isActive={pathname === s.url}>
                          <Link to={s.url}>
                            <s.icon className="h-3.5 w-3.5" />
                            <span>{s.title}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                )}
              </SidebarMenuItem>
            </SidebarMenu>
            {locked && (
              <p className="px-3 pt-2 text-[11px] leading-snug text-sidebar-foreground/60">
                Create or join a workspace to unlock these.
              </p>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => supabase.auth.signOut()}>
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
