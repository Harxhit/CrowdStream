import { ArrowRight, ExternalLink, Radio, Users, Code2 } from "lucide-react";
import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#0a0f0c] text-white">
      {/* Background Glow */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,#3fcf9e15,transparent_50%)]" />

      {/* Navbar */}
      <header className="border-b border-white/5 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="text-2xl font-bold tracking-tight">
            Crowd<span className="text-[#3fcf9e]">Stream</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              to="/signin"
              className="rounded-lg px-4 py-2 text-sm text-white/60 transition hover:bg-white/5 hover:text-white"
            >
              Sign In
            </Link>

            <Link
              to="/signup"
              className="rounded-lg bg-[#3fcf9e] px-4 py-2 text-sm font-semibold text-[#04241a] transition hover:bg-[#5fdcb2]"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto flex max-w-5xl flex-col items-center px-6 py-28 text-center">
        <span className="flex items-center gap-2 rounded-full border border-[#3fcf9e]/25 bg-[#3fcf9e]/10 px-4 py-1 text-sm text-[#3fcf9e]">
          <Radio size={14} />
          Open Source Live Streaming Platform
        </span>

        <h1 className="mt-8 text-6xl font-black tracking-tight md:text-7xl">
          Crowd<span className="text-[#3fcf9e]">Stream</span>
        </h1>

        <p className="mt-8 max-w-3xl text-lg leading-8 text-white/45">
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
            className="flex items-center gap-2 rounded-xl bg-[#3fcf9e] px-6 py-3 font-semibold text-[#04241a] transition hover:bg-[#5fdcb2]"
          >
            GitHub Repository
            <ExternalLink size={18} />
          </a>

          <a
            href="https://github.com/Harxhit"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl border border-white/10 px-6 py-3 font-semibold text-white transition hover:border-white/25"
          >
            Developer
            <ArrowRight size={18} />
          </a>
        </div>
      </section>

      {/* Cards */}
      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-24 md:grid-cols-3">
        <div className="rounded-2xl bg-white/[0.03] p-6 ring-1 ring-white/10 transition hover:ring-[#3fcf9e]/40">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#3fcf9e]/10 text-[#3fcf9e]">
            <Radio size={18} />
          </div>
          <h3 className="mt-4 text-xl font-semibold">Broadcast</h3>

          <p className="mt-3 text-sm leading-7 text-white/40">
            Go live with high-quality audio and video while managing your
            audience from a single platform.
          </p>
        </div>

        <div className="rounded-2xl bg-white/[0.03] p-6 ring-1 ring-white/10 transition hover:ring-[#3fcf9e]/40">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#3fcf9e]/10 text-[#3fcf9e]">
            <Users size={18} />
          </div>
          <h3 className="mt-4 text-xl font-semibold">Watch</h3>

          <p className="mt-3 text-sm leading-7 text-white/40">
            Join streams instantly, watch in real time, and interact with
            broadcasters as the stream unfolds.
          </p>
        </div>

        <div className="rounded-2xl bg-white/[0.03] p-6 ring-1 ring-white/10 transition hover:ring-[#3fcf9e]/40">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#3fcf9e]/10 text-[#3fcf9e]">
            <Code2 size={18} />
          </div>
          <h3 className="mt-4 text-xl font-semibold">Open Source</h3>

          <p className="mt-3 text-sm leading-7 text-white/40">
            Explore the codebase, contribute features, report issues, or use
            CrowdStream as a foundation for your own streaming platform.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-white/35 md:flex-row">
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