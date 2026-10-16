import { redirect } from "next/navigation";
import { sessionFromCookies } from "@/lib/auth";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard — UnoRouter",
  description: "Unified AI router dashboard, analytics, API keys, and model usage.",
};

export default async function DashboardPage() {
  const user = await sessionFromCookies();
  if (!user) redirect("/login");
  return <DashboardClient user={user} />;
}
