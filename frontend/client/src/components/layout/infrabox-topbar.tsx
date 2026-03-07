import { Bell, Search, Sparkles } from "lucide-react";
import { useLocation } from "wouter";

import { InfraboxLogo } from "@/components/brand/infrabox-logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { RippleButton } from "@/components/ui/ripple-button";
import { useWorkspace } from "@/context/workspace-context";

export function InfraboxTopbar() {
  const [, navigate] = useLocation();
  const { selectedRepo } = useWorkspace();
  const repoIndicator = selectedRepo ?? {
    fullName: "KartikSharma4448/Auccostic-Ai",
    branch: "main",
    lastCommitAgo: "5 minutes ago",
  };

  return (
    <header className="fixed inset-x-0 top-0 z-30 h-16 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex h-full items-center gap-4 px-8">
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

          <Avatar className="h-10 w-10 border border-border">
            <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
              TR
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
