import { redirect } from "next/navigation";
import { sessionFromCookies } from "@/lib/auth";
import DashboardClient from "./DashboardClient";

export default function DashboardPage() {
  const user = sessionFromCookies();
  if (!user) redirect("/login");
  return (
    <div className="wrap">
      <nav className="nav">
        <a href="/" className="brand">Reseller Gateway</a>
        <span className="spacer" />
        <span className="muted" style={{ fontSize: 13 }}>{user.email}</span>
        {user.role === "admin" && <a href="/admin" className="link">Admin</a>}
        <a href="/login" className="link">Switch user</a>
      </nav>
      <DashboardClient user={user} />
    </div>
  );
}
