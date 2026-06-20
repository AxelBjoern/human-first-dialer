import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Phone, Users, History, BellRing, LogOut, Settings, KeyRound, Link2, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
];

const settings = [
  { title: "Workspace", url: "/settings/organization", icon: Settings },
  { title: "API keys", url: "/settings/api-keys", icon: KeyRound },
  { title: "Connections", url: "/settings/connections", icon: Link2 },
  { title: "API & MCP docs", url: "/settings/api-docs", icon: BookOpen },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
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
            <span className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60">Dialer</span>
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
                    <SidebarMenuButton asChild isActive={active}>
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setSettingsOpen((v) => !v)} isActive={pathname.startsWith("/settings")}>
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </SidebarMenuButton>
                {settingsOpen && (
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
