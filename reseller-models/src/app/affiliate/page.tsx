import { redirect } from "next/navigation";
import { sessionFromCookies } from "@/lib/auth";
import DashboardClient from "../dashboard/DashboardClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Affiliate Program — UnoRouter",
  description: "Earn commissions by referring new users to UnoRouter.",
};

export default async function AffiliatePage() {
  const user = await sessionFromCookies();
  if (!user) redirect("/login");
  return <DashboardClient user={user} initialMenu="affiliate" />;
}
