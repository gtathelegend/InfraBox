import { getSession } from "@auth0/nextjs-auth0";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";

export const metadata = {
  title: "Dashboard | InfraBox",
  description: "Manage your DevOps workspaces, pipelines, and deployments",
};

export default async function DashboardPage() {
  // Server-side session guard — unauthenticated users are redirected
  const session = await getSession();
  if (!session?.user) {
    redirect("/");
  }

  return <DashboardClient />;
}
