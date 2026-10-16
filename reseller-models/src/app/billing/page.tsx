import { redirect } from "next/navigation";
import { sessionFromCookies } from "@/lib/auth";
import DashboardClient from "../dashboard/DashboardClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Billing & Subscriptions — UnoRouter",
  description: "Manage subscription plans, top-up balance, and payment methods.",
};

export default async function BillingPage() {
  const user = await sessionFromCookies();
  if (!user) redirect("/login");
  return <DashboardClient user={user} initialMenu="billing" />;
}
