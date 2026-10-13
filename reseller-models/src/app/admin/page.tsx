import { redirect } from "next/navigation";
import { sessionFromCookies } from "@/lib/auth";
import AdminClient from "./AdminClient";

export default async function AdminPage() {
  const user = await sessionFromCookies();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");
  return (
    <div className="wrap">
      <nav className="nav">
        <a href="/" className="brand">Reseller Gateway</a>
        <span className="spacer" />
        <span className="muted" style={{ fontSize: 13 }}>{user.email} · admin</span>
        <a href="/dashboard" className="link">Dashboard</a>
        <a href="/login" className="link">Switch user</a>
      </nav>
      <AdminClient />
    </div>
  );
}
