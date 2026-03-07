import { Bell, Search, Sparkles } from "lucide-react";
import { useLocation } from "wouter";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { RippleButton } from "@/components/ui/ripple-button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useWorkspace } from "@/context/workspace-context";

export function InfraboxTopbar() {
  const [, navigate] = useLocation();
  const { selectedRepo } = useWorkspace();

  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-white/90 backdrop-blur-xl">
      <div className="flex min-h-16 flex-wrap items-center gap-3 px-4 py-3 md:px-6">
        <SidebarTrigger className="md:hidden" />

        <div className="relative hidden max-w-xl flex-1 md:flex">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search repositories, services, deployments..."
            className="h-10 rounded-xl border-border bg-white pl-9"
          />
        </div>

        {selectedRepo ? (
          <div className="hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 lg:block">
            <p>
              Repository: <span className="font-semibold text-slate-900">{selectedRepo.fullName}</span>
            </p>
            <p>
              Branch: <span className="font-semibold text-slate-900">{selectedRepo.branch}</span> | Last commit:{" "}
              <span className="font-semibold text-slate-900">{selectedRepo.lastCommitAgo}</span>
            </p>
          </div>
        ) : null}

        <div className="ml-auto flex items-center gap-3">
          {selectedRepo ? (
            <RippleButton
              variant="outline"
              className="hidden h-10 border-slate-300 bg-white text-xs md:inline-flex"
              onClick={() => navigate("/connect-repository")}
            >
              Change Repository
            </RippleButton>
          ) : null}

          <button className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-white text-slate-600 transition hover:text-slate-900">
            <Bell className="h-4 w-4" />
          </button>

          <button className="hidden items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 md:flex">
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
