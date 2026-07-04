import { ArrowRight, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      {/* Background Glow */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,#2563eb20,transparent_50%)]" />

      {/* Navbar */}
      <header className="border-b border-neutral-800/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="text-2xl font-bold tracking-tight">
            Crowd<span className="text-blue-500">Stream</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              to="/signin"
              className="rounded-lg px-4 py-2 text-sm text-neutral-300 transition hover:bg-neutral-900 hover:text-white"
            >
              Sign In
            </Link>

            <Link
              to="/signup"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium transition hover:bg-blue-700"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto flex max-w-5xl flex-col items-center px-6 py-28 text-center">
        <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1 text-sm text-blue-300">
          Open Source Live Streaming Platform
        </span>

        <h1 className="mt-8 text-6xl font-black tracking-tight md:text-7xl">
          Crowd<span className="text-blue-500">Stream</span>
        </h1>

        <p className="mt-8 max-w-3xl text-lg leading-8 text-neutral-400">
          CrowdStream combines the collaborative experience of Google Meet
          with the audience reach of Instagram Live, allowing creators to
          broadcast live while viewers join, interact, and experience
          real-time communication through a modern streaming platform.
        </p>

        <div className="mt-12 flex flex-wrap justify-center gap-4">
          <a
            href="https://github.com/Harxhit/CrowdStream"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold transition hover:bg-blue-700"
          >
            GitHub Repository
            <ExternalLink size={18} />
          </a>

          <a
            href="https://github.com/Harxhit"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl border border-neutral-700 px-6 py-3 font-semibold transition hover:border-neutral-500"
          >
            Developer
            <ArrowRight size={18} />
          </a>
        </div>
      </section>

      {/* Cards */}
      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-24 md:grid-cols-3">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 transition hover:border-blue-500/50">
          <h3 className="text-xl font-semibold">Broadcast</h3>

          <p className="mt-3 text-sm leading-7 text-neutral-400">
            Go live with high-quality audio and video while managing your
            audience from a single platform.
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 transition hover:border-blue-500/50">
          <h3 className="text-xl font-semibold">Watch</h3>

          <p className="mt-3 text-sm leading-7 text-neutral-400">
            Join streams instantly, watch in real time, and interact with
            broadcasters as the stream unfolds.
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 transition hover:border-blue-500/50">
          <h3 className="text-xl font-semibold">Open Source</h3>

          <p className="mt-3 text-sm leading-7 text-neutral-400">
            Explore the codebase, contribute features, report issues, or use
            CrowdStream as a foundation for your own streaming platform.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-800">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-neutral-500 md:flex-row">
          <p>© {new Date().getFullYear()} CrowdStream</p>

          <div className="flex gap-6">
            <a
              href="https://github.com/Harxhit/CrowdStream"
              className="transition hover:text-white"
            >
              Repository
            </a>

            <a
              href="https://github.com/Harxhit"
              className="transition hover:text-white"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}