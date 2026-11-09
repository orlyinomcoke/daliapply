import Link from "next/link";

export function TopBar() {
  return (
    <header className="border-b border-line">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-xl font-extrabold tracking-tight">
          dali<span className="text-brand">apply</span>
        </Link>
        <div className="flex items-center gap-5 text-sm font-semibold">
          <Link href="/seeker" className="hover:text-brand">Job seeker</Link>
          <Link href="/company" className="hover:text-brand">Company</Link>
        </div>
      </nav>
    </header>
  );
}
