import { redirect } from "react-router";
import { auth } from "./auth.server";

export async function getSession(request: Request) {
  return auth.api.getSession({ headers: request.headers });
}

export async function requirePageUser(request: Request) {
  const session = await getSession(request);
  if (!session) throw redirect("/login");
  return session.user;
}

export async function requireResourceUser(request: Request) {
  const session = await getSession(request);
  if (!session) {
    throw Response.json({ code: "UNAUTHENTICATED", message: "Please sign in to continue." }, { status: 401 });
  }
  return session.user;
}
