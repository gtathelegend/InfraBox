import { redirect } from "next/navigation";
import { auth0 } from "@/lib/auth0";
import DashboardClient from "./DashboardClient";

export const metadata = {
  title: "InfraBox | Predict. Protect. Deploy.",
  description: "Predict. Protect. Deploy.",
};

export default async function DashboardPage() {
  const session = await auth0.getSession();
  if (!session?.user) {
    redirect("/");
  }

  return <DashboardClient />;
}
