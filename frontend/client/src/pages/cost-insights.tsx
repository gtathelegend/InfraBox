import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { monthlyCostData } from "@/lib/infrabox-data";

export default function CostInsightsPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Cost Insights</h1>
        <p className="mt-1 text-sm text-slate-600">
          Understand spend behavior and predict monthly cloud costs.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="glass-card rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Monthly Cloud Cost</CardTitle>
          </CardHeader>
          <CardContent className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyCostData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 12 }} />
                <YAxis tick={{ fill: "#64748b", fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="compute" stroke="#2563EB" strokeWidth={2.2} />
                <Line type="monotone" dataKey="storage" stroke="#6366F1" strokeWidth={2.2} />
                <Line
                  type="monotone"
                  dataKey="bandwidth"
                  stroke="#F59E0B"
                  strokeWidth={2.2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-card rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Prediction Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.1em] text-slate-500">
                Estimated monthly cost
              </p>
              <p className="mt-1 text-3xl font-semibold text-slate-900">$2,680</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs uppercase tracking-[0.1em] text-amber-700">
                Cost during traffic spike
              </p>
              <p className="mt-1 text-2xl font-semibold text-amber-800">$3,420</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              <p className="mb-2 font-medium text-slate-900">Optimization suggestions</p>
              <p>1. Rightsize two underutilized worker instances.</p>
              <p>2. Enable object storage lifecycle for logs older than 30 days.</p>
              <p>3. Shift nightly batch jobs to spot nodes.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Cost Distribution by Service</CardTitle>
        </CardHeader>
        <CardContent className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={[
                { service: "API", cost: 610 },
                { service: "Payment", cost: 780 },
                { service: "Auth", cost: 290 },
                { service: "Analytics", cost: 540 },
                { service: "Queue", cost: 210 },
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="service" tick={{ fill: "#64748b", fontSize: 12 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="cost" fill="#2563EB" radius={8} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
