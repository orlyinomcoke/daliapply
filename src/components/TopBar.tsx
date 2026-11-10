import Link from "next/link";
import { getSession } from "@/lib/session";

/** The menu shows only the side you're signed in as. */
export async function TopBar() {
  const { user, role } = await getSession();
  const link = "rounded-full px-3 py-1.5 hover:bg-brand-soft";
  return (
    <header className="border-b border-line">
      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="text-[22px] font-extrabold tracking-tight [font-family:var(--font-display)]">
          dali<span className="text-brand">apply</span><span className="ml-0.5 inline-block h-2 w-2 -translate-y-3 rounded-full bg-accent" />
        </Link>
        <div className="flex items-center gap-1 text-sm font-semibold">
          {!user || !role ? (
            <>
              <Link href="/signin?as=seeker" className="rounded-full border border-line px-3 py-1.5">
                <span className="hidden sm:inline">Job seeker</span><span className="sm:hidden">Seeker</span> login
              </Link>
              <Link href="/signin?as=company" className="btn-primary !px-3 !py-1.5">Company login</Link>
            </>
          ) : (
            <>
              {role === "seeker" && <Link className={link} href="/seeker">Jobs</Link>}
              {role === "company" && <Link className={link} href="/company">My jobs</Link>}
              {role === "admin" && <Link className={link} href="/admin">Admin</Link>}
              {role !== "admin" && <Link className={link} href="/matches">Matches</Link>}
              <span className="hidden max-w-40 truncate px-2 text-xs font-normal text-muted sm:inline">{user.email}</span>
              <form action="/auth/signout" method="post"><button className={`${link} text-muted`}>Log out</button></form>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted">
        <span>© Daliapply</span>
        <nav className="flex gap-5 font-semibold text-foreground">
          <Link href="/faq">FAQ</Link>
          <Link href="/support">Support</Link>
        </nav>
      </div>
    </footer>
  );
}
