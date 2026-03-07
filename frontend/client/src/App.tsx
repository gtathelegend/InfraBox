import * as React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Route, Switch, useLocation } from "wouter";

import { AppLayout } from "@/components/layout/infrabox-shell";
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
import IncidentsPage from "@/pages/incidents";
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
      <Route path="/incidents" component={IncidentsPage} />
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
  const { isAuthenticated, isLoading } = useAuth0();

  const isLandingRoute = location === "/";
  const isAuthRoute = location === "/auth";
  const isRepoConnectRoute = location === "/connect-repository";
  const isPublicRoute = isLandingRoute || isAuthRoute;

  React.useEffect(() => {
    if (isLoading) return;

    if (!isPublicRoute && !isAuthenticated) {
      navigate("/auth");
      return;
    }

    if (isAuthenticated && isAuthRoute) {
      navigate(selectedRepo ? "/dashboard" : "/connect-repository");
      return;
    }

    if (isAuthenticated && !isLandingRoute && !isAuthRoute && !isRepoConnectRoute && !selectedRepo) {
      navigate("/connect-repository");
    }
  }, [
    isAuthenticated,
    isAuthRoute,
    isLandingRoute,
    isLoading,
    isPublicRoute,
    isRepoConnectRoute,
    navigate,
    selectedRepo,
  ]);

  if (location === "/") return <LandingPage />;
  if (location === "/auth") return <AuthPage />;
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <p className="text-sm text-slate-600">Loading authentication...</p>
      </div>
    );
  }
  if (!isAuthenticated) return <AuthPage />;
  if (location === "/connect-repository") return <ConnectRepositoryPage />;

  if (!selectedRepo) {
    return <ConnectRepositoryPage />;
  }

  return (
    <AppLayout routeKey={location}>
      <PrivateRoutes />
    </AppLayout>
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
