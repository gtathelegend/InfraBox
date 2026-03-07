import { redirect } from "next/navigation";
import { auth0 } from "@/lib/auth0";
import DevOpsAssistantChat from "@/app/components/DevOpsAssistantChat";

export const metadata = {
  title: "InfraBox | DevOps Assistant",
  description: "Conversational DevOps assistant for infrastructure and deployment insights.",
};

export default async function AssistantPage() {
  const session = await auth0.getSession();
  if (!session?.user) {
    redirect("/");
  }

  return <DevOpsAssistantChat />;
}
