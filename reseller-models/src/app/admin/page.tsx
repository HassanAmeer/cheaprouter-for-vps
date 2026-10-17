import { redirect } from "next/navigation";
import { sessionFromCookies } from "@/lib/auth";
import AdminClient from "./AdminClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Console — UnoRouter",
  description: "Manage plans, users, quotas, models catalog, and site branding.",
};

export default async function AdminPage() {
  const user = await sessionFromCookies();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  return <AdminClient user={user} />;
}
