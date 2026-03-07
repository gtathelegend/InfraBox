import * as React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Route, Switch, useLocation } from "wouter";

import { InfraboxShell } from "@/components/layout/infrabox-shell";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WorkspaceProvider, useWorkspace } from "@/context/workspace-context";
import { queryClient } from "@/lib/queryClient";
import ArchitecturePage from "@/pages/architecture";
import AssistantPage from "@/pages/assistant";
import AuthPage from "@/pages/auth";
import ConnectRepositoryPage from "@/pages/connect-repository";
import CostInsightsPage from "@/pages/cost-insights";
import DashboardPage from "@/pages/dashboard";
import DeploymentsPage from "@/pages/deployments";
import LandingPage from "@/pages/landing";
import MonitoringPage from "@/pages/monitoring";
import NotFound from "@/pages/not-found";
import PipelineStageDetailPage from "@/pages/pipeline-stage-detail";
import PredictionDetailPage from "@/pages/prediction-detail";
import PredictionsPage from "@/pages/predictions";
import PipelinePage from "@/pages/pipeline";
import RepositoriesPage from "@/pages/repositories";
import SettingsPage from "@/pages/settings";
import SimulationsPage from "@/pages/simulations";

function PrivateRoutes() {
  return (
    <Switch>
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/repositories" component={RepositoriesPage} />
      <Route path="/architecture" component={ArchitecturePage} />
      <Route path="/pipeline/:stage" component={PipelineStageDetailPage} />
      <Route path="/pipeline" component={PipelinePage} />
      <Route path="/pipelines" component={PipelinePage} />
      <Route path="/simulations" component={SimulationsPage} />
      <Route path="/predictions/:service" component={PredictionDetailPage} />
      <Route path="/predictions" component={PredictionsPage} />
      <Route path="/incidents" component={PredictionsPage} />
      <Route path="/deployments" component={DeploymentsPage} />
      <Route path="/cost-insights" component={CostInsightsPage} />
      <Route path="/cost" component={CostInsightsPage} />
      <Route path="/costs" component={CostInsightsPage} />
      <Route path="/monitoring" component={MonitoringPage} />
      <Route path="/ai-assistant" component={AssistantPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppRouter() {
  const [location, navigate] = useLocation();
  const { selectedRepo } = useWorkspace();

  const isPublicRoute = location === "/" || location === "/auth";
  const isRepoConnectRoute = location === "/connect-repository";

  React.useEffect(() => {
    if (!isPublicRoute && !isRepoConnectRoute && !selectedRepo) {
      navigate("/connect-repository");
    }
  }, [isPublicRoute, isRepoConnectRoute, selectedRepo, navigate]);

  if (location === "/") return <LandingPage />;
  if (location === "/auth") return <AuthPage />;
  if (location === "/connect-repository") return <ConnectRepositoryPage />;

  if (!selectedRepo) {
    return <ConnectRepositoryPage />;
  }

  return (
    <InfraboxShell routeKey={location}>
      <PrivateRoutes />
    </InfraboxShell>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WorkspaceProvider>
          <AppRouter />
        </WorkspaceProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
