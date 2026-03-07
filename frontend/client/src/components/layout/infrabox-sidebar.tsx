import { Link, useLocation } from "wouter";
import {
  Bot,
  FlaskConical,
  FolderGit2,
  LayoutDashboard,
  Network,
  Rocket,
  Settings,
  ShieldAlert,
  ShieldCheck,
  WalletCards,
  Workflow,
} from "lucide-react";

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
} from "@/components/ui/sidebar";
import { RippleButton } from "@/components/ui/ripple-button";
import { useWorkspace } from "@/context/workspace-context";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Repositories", url: "/repositories", icon: FolderGit2 },
  { title: "Architecture", url: "/architecture", icon: Network },
  { title: "Pipeline", url: "/pipeline", icon: Workflow },
  { title: "Simulations", url: "/simulations", icon: FlaskConical },
  { title: "Predictions", url: "/predictions", icon: ShieldAlert },
  { title: "Deployments", url: "/deployments", icon: Rocket },
  { title: "Cost Insights", url: "/cost-insights", icon: WalletCards },
  { title: "AI Assistant", url: "/ai-assistant", icon: Bot },
  { title: "Settings", url: "/settings", icon: Settings },
];

const isActiveRoute = (currentPath: string, itemPath: string) =>
  currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);

export function InfraboxSidebar() {
  const [location] = useLocation();
  const { selectedRepo, runFullAnalysis, isAnalyzing } = useWorkspace();

  return (
    <Sidebar className="border-r border-border/70 bg-white/90 backdrop-blur-xl">
      <SidebarHeader className="border-b border-border/70 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-sm">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-base font-semibold text-slate-900">Infrabox</p>
            <p className="text-xs text-slate-500">Predict. Protect. Deploy.</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-[11px] uppercase tracking-[0.14em] text-slate-500">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const active = isActiveRoute(location, item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      className={`rounded-xl px-3 py-2.5 transition-all ${
                        active
                          ? "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_rgba(37,99,235,0.18)]"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/70 p-3">
        <RippleButton
          className="w-full bg-slate-900 text-white hover:bg-slate-800"
          disabled={!selectedRepo || isAnalyzing}
          onClick={() => runFullAnalysis()}
        >
          {isAnalyzing ? "Running Analysis..." : "Run Full Analysis"}
        </RippleButton>
      </SidebarFooter>
    </Sidebar>
  );
}
