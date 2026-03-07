import { redirect } from "next/navigation";
import { auth0 } from "@/lib/auth0";
import PipelineVisualizer from "../components/PipelineVisualizer";

export const metadata = {
  title: "InfraBox | Pipeline Visualizer",
  description: "Interactive CI/CD pipeline graph with metrics",
};

export default async function PipelinePage() {
  const session = await auth0.getSession();
  if (!session?.user) {
    redirect("/");
  }

  return <PipelineVisualizer />;
}
