import { redirect } from "next/navigation";
import { sessionFromCookies } from "@/lib/auth";
import DashboardClient from "../dashboard/DashboardClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Usage Logs — UnoRouter",
  description: "View your API request history, token usage, and spending details.",
};

export default async function UsageLogsPage() {
  const user = await sessionFromCookies();
  if (!user) redirect("/login");
  return <DashboardClient user={user} initialMenu="logs" />;
}
