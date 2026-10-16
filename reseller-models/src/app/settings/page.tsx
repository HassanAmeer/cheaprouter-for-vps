import { redirect } from "next/navigation";
import { sessionFromCookies } from "@/lib/auth";
import DashboardClient from "../dashboard/DashboardClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Account Settings — UnoRouter",
  description: "Manage your UnoRouter account settings and preferences.",
};

export default async function SettingsPage() {
  const user = await sessionFromCookies();
  if (!user) redirect("/login");
  return <DashboardClient user={user} initialMenu="settings" />;
}
