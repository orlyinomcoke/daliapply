import Link from "next/link";

export function SeekerNav() {
  return (
    <nav className="flex flex-wrap gap-2 text-sm">
      <Link className="btn-ghost" href="/seeker">Jobs</Link>
      <Link className="btn-ghost" href="/matches">Matches</Link>
      <Link className="btn-ghost" href="/seeker/verify">Verify ID</Link>
      <Link className="btn-ghost" href="/seeker/profile">Profile</Link>
    </nav>
  );
}

export function CompanyNav() {
  return (
    <nav className="flex flex-wrap gap-2 text-sm">
      <Link className="btn-ghost" href="/company">Jobs</Link>
      <Link className="btn-ghost" href="/company/jobs/new">Post a job</Link>
      <Link className="btn-ghost" href="/matches">Matches</Link>
    </nav>
  );
}
