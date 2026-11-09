import { LandingSearch } from "@/components/LandingSearch";

export default function Home() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-10 text-center">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Swipe right on your next job.
        </h1>
        <p className="mt-3 text-muted">
          Upload your resume once. No forms, no cover letters. Names, photos and salary stay hidden until both sides
          say yes.
        </p>
      </div>
      <LandingSearch />
    </div>
  );
}
