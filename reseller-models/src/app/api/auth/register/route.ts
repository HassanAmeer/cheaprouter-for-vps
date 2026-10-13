import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSession, createUser, findUser, SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !email.includes("@") || password.length < 4) {
    return NextResponse.json(
      { error: "A valid email and a 4+ character password are required" },
      { status: 400 }
    );
  }
  if (findUser(email)) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }
  try {
    const user = createUser(email, name, password);
    const token = createSession(user.id);
    cookies().set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return NextResponse.json(
      { user: { id: user.id, email: user.email, name: user.name, role: user.role } },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
