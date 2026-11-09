import "server-only";
import { redirect } from "next/navigation";
import { supabaseServer } from "./supabase/server";

export type Role = "seeker" | "company" | "admin";

export async function getSession() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { supabase, user: null, role: null as Role | null };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  return { supabase, user: data.user, role: (profile?.role ?? null) as Role | null };
}

/** Require a signed-in user with the given role, or send them to sign in. */
export async function requireRole(role: Role) {
  const s = await getSession();
  if (!s.user) redirect(`/signin?as=${role === "admin" ? "seeker" : role}`);
  if (!s.role) redirect(`/onboarding?as=${role}`);
  if (s.role !== role) redirect(s.role === "company" ? "/company" : s.role === "admin" ? "/admin" : "/seeker");
  return { ...s, user: s.user! };
}
