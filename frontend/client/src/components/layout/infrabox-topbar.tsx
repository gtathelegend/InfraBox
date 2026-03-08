import * as React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Bell, LogOut, Menu, Search, Settings2, Sparkles, UserRound } from "lucide-react";
import { useLocation } from "wouter";

import { InfraboxLogo } from "@/components/brand/infrabox-logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { RippleButton } from "@/components/ui/ripple-button";
import { useWorkspace } from "@/context/workspace-context";
import { clearGitHubTokenFromStorage } from "@/lib/auth-token";

const topLeftMenuItems = [
  { label: "Dashboard", path: "/dashboard" },
  { label: "Repositories", path: "/repositories" },
  { label: "Architecture", path: "/architecture" },
  { label: "Pipeline", path: "/pipeline" },
  { label: "Simulations", path: "/simulations" },
  { label: "Predictions", path: "/predictions" },
  { label: "Deployments", path: "/deployments" },
  { label: "Cost Insights", path: "/cost-insights" },
  { label: "AI Assistant", path: "/ai-assistant" },
  { label: "Settings", path: "/settings" },
] as const;

export function InfraboxTopbar() {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth0();
  const { selectedRepo, setSelectedRepo } = useWorkspace();
  const repoIndicator = selectedRepo ?? {
    fullName: "No repository selected",
    branch: "-",
    lastCommitAgo: "-",
  };

  const userInitials = React.useMemo(() => {
    const source = user?.name?.trim() || user?.nickname?.trim() || user?.email?.trim();
    if (!source) return "U";
    return source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  }, [user?.email, user?.name, user?.nickname]);

  const handleLogout = () => {
    setSelectedRepo(null);
    clearGitHubTokenFromStorage();
    logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    });
  };

  return (
    <header className="fixed inset-x-0 top-0 z-30 h-16 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex h-full items-center gap-4 px-8">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-white text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
              aria-label="Open main menu"
            >
              <Menu className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 border-slate-200 bg-white">
            <DropdownMenuLabel>Main Menu</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {topLeftMenuItems.map((item) => (
              <DropdownMenuItem key={item.path} onClick={() => navigate(item.path)}>
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="hidden items-center gap-2 lg:flex">
          <InfraboxLogo className="h-9 w-9 rounded-lg" />
          <span className="text-sm font-semibold text-slate-900">Infrabox</span>
        </div>

        <div className="relative max-w-xl flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search repositories, services, deployments..."
            className="h-10 rounded-xl border-border bg-white pl-9"
          />
        </div>

        <div className="hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 xl:block">
          <p>
            Repository: <span className="font-semibold text-slate-900">{repoIndicator.fullName}</span>
          </p>
          <p>
            Branch: <span className="font-semibold text-slate-900">{repoIndicator.branch}</span> | Last commit:{" "}
            <span className="font-semibold text-slate-900">{repoIndicator.lastCommitAgo}</span>
          </p>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <RippleButton
            variant="outline"
            className="h-10 border-slate-300 bg-white text-xs"
            onClick={() => navigate("/connect-repository")}
          >
            Change Repository
          </RippleButton>

          <button className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-white text-slate-600 transition hover:text-slate-900">
            <Bell className="h-4 w-4" />
          </button>

          <button className="hidden items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 lg:flex">
            <Sparkles className="h-4 w-4 text-accent" />
            AI Queue
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded-full outline-none ring-offset-2 transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Open profile menu"
              >
                <Avatar className="h-10 w-10 border border-border">
                  <AvatarImage src={user?.picture} alt={user?.name ?? "User"} />
                  <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 border-slate-200 bg-white">
              <DropdownMenuLabel className="space-y-0.5">
                <p className="text-sm font-semibold text-slate-900">{user?.name ?? "User"}</p>
                <p className="text-xs font-normal text-slate-500">{user?.email ?? "No email"}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/profile")}>
                <UserRound className="h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/settings")}>
                <Settings2 className="h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-red-600 focus:bg-red-50 focus:text-red-700"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
