import { KeyRound, Link2, Bell, Settings2, FolderCog } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          Configure workspace, integrations, API keys, and notifications.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass-card rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings2 className="h-4 w-4 text-primary" />
              Workspace settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="workspace">Workspace name</Label>
              <Input id="workspace" defaultValue="Infrabox Production" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="region">Default region</Label>
              <Input id="region" defaultValue="ap-south-1" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Link2 className="h-4 w-4 text-primary" />
              Cloud integrations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              AWS: Connected
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              Vercel: Connected
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              Kubernetes: Pending setup
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FolderCog className="h-4 w-4 text-primary" />
              Repository management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              Connected repositories: 12
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              Auto-resync interval: 30 minutes
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              Branch protection checks: Enabled
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <KeyRound className="h-4 w-4 text-primary" />
              API keys
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              Publishable key: `infrabox_pk_live_...`
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              Secret key rotation: every 30 days
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              Last rotated: 2026-02-20
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-4 w-4 text-primary" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {[
            "Failure predictions",
            "Deployment approvals",
            "Cost anomaly alerts",
          ].map((item) => (
            <div
              key={item}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4"
            >
              <span className="text-sm font-medium text-slate-700">{item}</span>
              <Switch defaultChecked />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
