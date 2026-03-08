import * as React from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { api } from "@shared/routes";
import { getAccessToken, getGitHubTokenFromStorage } from "@/lib/auth-token";

async function authHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const token = await getAccessToken();
  const headers: Record<string, string> = { ...(extra ?? {}) };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const githubToken = getGitHubTokenFromStorage();
  if (githubToken) {
    headers["x-github-token"] = githubToken;
  }
  return headers;
}

const infrastructureConfigSchema = z.object({
  repositoryId: z.string().uuid(),
  provider: z.enum(["AWS", "Vercel", "Vultr", "Kubernetes", "Docker Server", "Custom Server", "Render"]),
  cpuAllocation: z.string().min(1),
  memoryAllocation: z.string().min(1),
  replicaCount: z.number().int().positive(),
  autoscalingEnabled: z.boolean(),
  averageUsersPerMinute: z.number().int().positive(),
  peakUsers: z.number().int().positive(),
  growthPercentage: z.number().positive(),
  envVars: z.record(z.string()),
});

type InfrastructureConfig = z.infer<typeof infrastructureConfigSchema>;

const providers = [
  { id: "AWS", name: "AWS", description: "Amazon Web Services" },
  { id: "Vercel", name: "Vercel", description: "Vercel Platform" },
  { id: "Vultr", name: "Vultr", description: "Vultr Cloud" },
  { id: "Kubernetes", name: "Kubernetes", description: "Kubernetes Cluster" },
  { id: "Docker Server", name: "Docker Server", description: "Docker Server" },
  { id: "Custom Server", name: "Custom Server", description: "Custom Server Setup" },
  { id: "Render", name: "Render", description: "Render Cloud Platform" },
] as const;

export default function ConfigureInfrastructurePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Get repositoryId from query params or context
  const searchParams = new URLSearchParams(window.location.search);
  const repositoryId = searchParams.get("repositoryId");

  const form = useForm<InfrastructureConfig>({
    resolver: zodResolver(infrastructureConfigSchema),
    defaultValues: {
      repositoryId: repositoryId || "",
      provider: "AWS",
      cpuAllocation: "2 vCPU",
      memoryAllocation: "4GB",
      replicaCount: 3,
      autoscalingEnabled: true,
      averageUsersPerMinute: 2000,
      peakUsers: 10000,
      growthPercentage: 15,
      envVars: {},
    },
  });

  const configureMutation = useMutation({
    mutationFn: async (data: InfrastructureConfig) => {
      const response = await fetch(api.infrastructure.configure.path, {
        method: api.infrastructure.configure.method,
        headers: await authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Configuration failed");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Infrastructure configured successfully" });
      // Start analysis
      startAnalysisMutation.mutate({ repositoryId: form.getValues("repositoryId") });
    },
    onError: (error) => {
      toast({ title: "Configuration failed", description: error.message, variant: "destructive" });
    },
  });

  const startAnalysisMutation = useMutation({
    mutationFn: async (data: { repositoryId: string }) => {
      const response = await fetch(api.analysis.start.path, {
        method: api.analysis.start.method,
        headers: await authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Analysis start failed");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Analysis and simulation started" });
      navigate("/simulations");
    },
    onError: (error) => {
      toast({ title: "Analysis start failed", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: InfrastructureConfig) => {
    configureMutation.mutate(data);
  };

  if (!repositoryId) {
    return <div>Repository ID required</div>;
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Infrastructure Configuration</h1>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Deployment Platform */}
            <Card>
              <CardHeader>
                <CardTitle>Deployment Platform</CardTitle>
                <CardDescription>Select your deployment environment</CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="provider"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="grid grid-cols-2 gap-4">
                          {providers.map((provider) => (
                            <Card
                              key={provider.id}
                              className={`cursor-pointer transition-colors ${
                                field.value === provider.id ? "ring-2 ring-primary" : ""
                              }`}
                              onClick={() => field.onChange(provider.id)}
                            >
                              <CardContent className="p-4">
                                <h3 className="font-semibold">{provider.name}</h3>
                                <p className="text-sm text-muted-foreground">{provider.description}</p>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Infrastructure Resources */}
            <Card>
              <CardHeader>
                <CardTitle>Infrastructure Resources</CardTitle>
                <CardDescription>Configure your deployment resources</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="cpuAllocation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPU Allocation</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., 2 vCPU" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="memoryAllocation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Memory Allocation</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., 4GB" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="replicaCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Replica Count</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="autoscalingEnabled"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel>Autoscaling Enabled</FormLabel>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Traffic Profile */}
            <Card>
              <CardHeader>
                <CardTitle>Traffic Profile</CardTitle>
                <CardDescription>Configure expected traffic patterns</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="averageUsersPerMinute"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Average Users/Min</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="peakUsers"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Peak Users</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="growthPercentage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Growth %</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Environment Variables */}
            <Card>
              <CardHeader>
                <CardTitle>Environment Variables</CardTitle>
                <CardDescription>Optional secure environment configuration</CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="envVars"
                  render={({ field }) => (
                    <FormItem>
                      <FormDescription>
                        Add key-value pairs for environment variables. One per line in KEY=VALUE format.
                      </FormDescription>
                      <FormControl>
                        <Textarea
                          placeholder="DATABASE_URL=postgres://...&#10;REDIS_URL=redis://...&#10;API_KEY=your-api-key"
                          value={Object.entries(field.value || {}).map(([k, v]) => `${k}=${v}`).join('\n')}
                          onChange={(e) => {
                            const lines = e.target.value.split('\n');
                            const envVars: Record<string, string> = {};
                            lines.forEach(line => {
                              const [key, ...valueParts] = line.split('=');
                              if (key && valueParts.length > 0) {
                                envVars[key.trim()] = valueParts.join('=').trim();
                              }
                            });
                            field.onChange(envVars);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={configureMutation.isPending || startAnalysisMutation.isPending}
              >
                {configureMutation.isPending || startAnalysisMutation.isPending
                  ? "Configuring..."
                  : "Configure & Run Real Simulation"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
