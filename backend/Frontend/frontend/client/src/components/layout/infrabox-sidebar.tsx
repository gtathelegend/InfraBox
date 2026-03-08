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
  WalletCards,
  Workflow,
} from "lucide-react";

import { InfraboxLogo } from "@/components/brand/infrabox-logo";
import { RippleButton } from "@/components/ui/ripple-button";
import { useWorkspace } from "@/context/workspace-context";

export const APP_SIDEBAR_WIDTH = 260;

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, aliases: [] },
  { title: "Repositories", url: "/repositories", icon: FolderGit2, aliases: [] },
  { title: "Architecture", url: "/architecture", icon: Network, aliases: [] },
  { title: "Pipeline", url: "/pipeline", icon: Workflow, aliases: ["/pipelines"] },
  { title: "Simulations", url: "/simulations", icon: FlaskConical, aliases: [] },
  {
    title: "Predictions",
    url: "/predictions",
    icon: ShieldAlert,
    aliases: ["/incidents"],
  },
  { title: "Deployments", url: "/deployments", icon: Rocket, aliases: [] },
  {
    title: "Cost Insights",
    url: "/cost-insights",
    icon: WalletCards,
    aliases: ["/cost", "/costs"],
  },
  { title: "AI Assistant", url: "/ai-assistant", icon: Bot, aliases: [] },
  { title: "Settings", url: "/settings", icon: Settings, aliases: [] },
];

const isActiveRoute = (
  currentPath: string,
  itemPath: string,
  aliases: string[],
) =>
  currentPath === itemPath ||
  currentPath.startsWith(`${itemPath}/`) ||
  aliases.some(
    (alias) => currentPath === alias || currentPath.startsWith(`${alias}/`),
  );

export function InfraboxSidebar() {
  const [location] = useLocation();
  const { selectedRepo, runFullAnalysis, isAnalyzing } = useWorkspace();

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-200 bg-white shadow-sm"
      style={{ width: APP_SIDEBAR_WIDTH }}
    >
      <div className="flex h-16 items-center border-b border-slate-200 px-4">
        <div className="flex items-center gap-3">
          <InfraboxLogo className="h-10 w-10 rounded-xl shadow-sm" />
          <div>
            <p className="text-base font-semibold text-slate-900">Infrabox</p>
            <p className="text-xs text-slate-500">Predict. Protect. Deploy.</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <p className="px-2 pb-2 text-[11px] uppercase tracking-[0.14em] text-slate-500">
          Workspace
        </p>
        <nav>
          <ul className="space-y-1.5">
            {navItems.map((item) => {
              const active = isActiveRoute(location, item.url, item.aliases);
              return (
                <li key={item.title}>
                  <Link
                    href={item.url}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-all ${
                      active
                        ? "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_rgba(37,99,235,0.18)]"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <div className="border-t border-slate-200 p-3">
        <RippleButton
          className="w-full rounded-xl bg-slate-900 text-white hover:bg-slate-800"
          disabled={!selectedRepo || isAnalyzing}
          onClick={() => runFullAnalysis()}
        >
          {isAnalyzing ? "Running Analysis..." : "Run Full Analysis"}
        </RippleButton>
      </div>
    </aside>
  );
}
