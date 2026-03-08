import { useAuth0 } from "@auth0/auth0-react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, FolderGit2, LogOut, Mail, ShieldCheck, UserRound } from "lucide-react";
import * as React from "react";

import type { Repository, User, Workspace } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RippleButton } from "@/components/ui/ripple-button";
import { useWorkspace } from "@/context/workspace-context";
import { clearGitHubTokenFromStorage } from "@/lib/auth-token";
import { apiRequest } from "@/lib/queryClient";

const formatDate = (value?: string | Date | null) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function ProfilePage() {
  const { user: auth0User, logout } = useAuth0();
  const { selectedRepo, setSelectedRepo } = useWorkspace();

  const { data: userRecord } = useQuery({
    queryKey: ["profile-user"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/users/me");
      return (await response.json()) as User;
    },
  });

  const { data: workspaceRecord } = useQuery({
    queryKey: ["profile-workspace"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/workspaces/current");
      return (await response.json()) as Workspace;
    },
  });

  const { data: repositories = [] } = useQuery({
    queryKey: ["profile-repositories"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/repositories");
      return (await response.json()) as Repository[];
    },
  });

  const initials = React.useMemo(() => {
    const source = auth0User?.name?.trim() || auth0User?.email?.trim() || "User";
    return source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  }, [auth0User?.email, auth0User?.name]);

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
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Profile</h1>
          <p className="mt-1 text-sm text-slate-600">
            Account, workspace, and security session details.
          </p>
        </div>
        <RippleButton
          variant="outline"
          className="border-red-200 text-red-700 hover:bg-red-50"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Logout
        </RippleButton>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="glass-card rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4">
              <Avatar className="h-14 w-14 border border-slate-200">
                <AvatarImage src={auth0User?.picture} alt={auth0User?.name ?? "User"} />
                <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-base font-semibold text-slate-900">
                  {userRecord?.name ?? auth0User?.name ?? "Infrabox User"}
                </p>
                <p className="text-sm text-slate-600">
                  {userRecord?.email ?? auth0User?.email ?? "No email"}
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                <p className="mb-1 flex items-center gap-2 font-medium text-slate-900">
                  <UserRound className="h-4 w-4 text-primary" />
                  Auth0 Subject
                </p>
                <p className="break-all text-xs text-slate-600">{userRecord?.auth0Id ?? "N/A"}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                <p className="mb-1 flex items-center gap-2 font-medium text-slate-900">
                  <Mail className="h-4 w-4 text-primary" />
                  Auth Provider
                </p>
                {userRecord?.authProvider ?? "auth0"}
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                <p className="mb-1 flex items-center gap-2 font-medium text-slate-900">
                  <CalendarClock className="h-4 w-4 text-primary" />
                  Account Created
                </p>
                {formatDate(userRecord?.createdAt)}
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                <p className="mb-1 flex items-center gap-2 font-medium text-slate-900">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Last Update
                </p>
                {formatDate(userRecord?.updatedAt)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Workspace Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.1em] text-slate-500">Workspace Name</p>
              <p className="mt-1 text-base font-semibold text-slate-900">
                {workspaceRecord?.name ?? "Workspace"}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.1em] text-slate-500">Connected Repositories</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{repositories.length}</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              <p className="mb-2 flex items-center gap-2 font-medium text-slate-900">
                <FolderGit2 className="h-4 w-4 text-primary" />
                Active Repository
              </p>
              <p>{selectedRepo?.fullName ?? "No repository selected"}</p>
              <p className="mt-1 text-xs text-slate-500">Branch: {selectedRepo?.branch ?? "-"}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
