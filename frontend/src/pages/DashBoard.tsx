import { useState } from "react";
import { ArrowRight, Video, Radio, Zap } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

export default function DashboardPage() {
  const navigate = useNavigate();

  const [roomId, setRoomId] = useState("");

  function handleJoinRoom(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!roomId.trim()) return;

    navigate(`/viewer?roomId=${encodeURIComponent(roomId)}`);
  }

  return (
    <main className="min-h-screen bg-[#0a0f0c] text-white">
      {/* ambient signal glow, off-center like a transmitter, not a centered hero glow */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[560px] w-[560px] rounded-full bg-[#3fcf9e]/[0.07] blur-[120px]" />
        <div className="absolute -right-20 top-1/3 h-[420px] w-[420px] rounded-full bg-[#3fcf9e]/[0.04] blur-[100px]" />
      </div>

      {/* top bar */}
      <header className="flex items-center justify-between px-6 py-6 sm:px-10">
        <Link to="/" className="text-lg font-bold tracking-tight">
          Crowd<span className="text-[#3fcf9e]">Stream</span>
        </Link>

        <div className="flex items-center gap-2 text-xs text-white/35">
          <span className="h-1.5 w-1.5 rounded-full bg-[#3fcf9e]" />
          <span className="font-mono">SYSTEM READY</span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 pb-24 pt-6 sm:px-10">
        {/* headline */}
        <div className="max-w-2xl">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#3fcf9e]/70">
            Control Room
          </span>
          <h1 className="mt-3 text-4xl font-bold leading-[1.1] sm:text-5xl">
            Go live, or find
            <br />
            a room already streaming.
          </h1>
          <p className="mt-4 text-white/40">
            Every room here runs on real-time video and chat. Start
            broadcasting in one click, or drop in a Room ID to join someone
            else's stream instantly.
          </p>
        </div>

        {/* main split: broadcast is the dominant, oversized action.
            join is a compact secondary panel — not a mirrored twin card,
            because starting a stream and joining one aren't equal-weight
            actions for this product. */}
        <div className="mt-14 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          {/* GO LIVE — primary */}
          <Link
            to="/broadcaster"
            className="group relative flex flex-col justify-between overflow-hidden rounded-3xl bg-[#3fcf9e] p-8 text-[#04241a] transition hover:bg-[#5fdcb2] sm:p-10"
          >
            {/* signature: faint concentric broadcast rings, bleeding off the corner */}
            <svg
              className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 opacity-[0.15]"
              viewBox="0 0 200 200"
              fill="none"
            >
              <circle cx="100" cy="100" r="40" stroke="#04241a" strokeWidth="2" />
              <circle cx="100" cy="100" r="65" stroke="#04241a" strokeWidth="2" />
              <circle cx="100" cy="100" r="90" stroke="#04241a" strokeWidth="2" />
            </svg>

            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#04241a]/10">
                <Radio size={22} />
              </div>

              <h2 className="mt-6 text-3xl font-bold">Go Live</h2>
              <p className="mt-3 max-w-sm text-[#04241a]/70">
                Open your broadcast console, turn on your camera, and start
                streaming to anyone with your Room ID.
              </p>
            </div>

            <div className="mt-10 flex items-center gap-2 text-sm font-semibold">
              Create room
              <ArrowRight
                size={16}
                className="transition group-hover:translate-x-1"
              />
            </div>
          </Link>

          {/* JOIN ROOM — secondary, styled like a tuner/receiver */}
          <div className="flex flex-col rounded-3xl bg-white/[0.03] p-8 ring-1 ring-white/10">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-white/60">
              <Zap size={20} />
            </div>

            <h2 className="mt-6 text-xl font-semibold">Join a Room</h2>
            <p className="mt-2 text-sm text-white/40">
              Enter the Room ID a broadcaster shared with you.
            </p>

            <form onSubmit={handleJoinRoom} className="mt-6 flex flex-1 flex-col justify-end gap-3">
              <input
                type="text"
                placeholder="ROOM-ID"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="w-full rounded-xl bg-black/40 px-4 py-3.5 font-mono text-sm uppercase tracking-widest text-white outline-none ring-1 ring-white/10 transition placeholder:text-white/20 focus:ring-[#3fcf9e]"
              />

              <button
                type="submit"
                disabled={!roomId.trim()}
                className="flex items-center justify-center gap-2 rounded-xl bg-white/10 py-3.5 font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-30"
              >
                Join Room
                <ArrowRight size={16} />
              </button>
            </form>
          </div>
        </div>

        {/* quick facts strip — grounds the product without inventing fake stats/history */}
        <div className="mt-6 grid gap-px overflow-hidden rounded-2xl bg-white/5 sm:grid-cols-3">
          <div className="flex items-center gap-3 bg-[#0a0f0c] p-5">
            <Video size={16} className="text-[#3fcf9e]" />
            <div>
              <p className="text-sm font-medium">Low-latency video</p>
              <p className="text-xs text-white/35">Powered by WebRTC + MediaSoup</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-[#0a0f0c] p-5">
            <Radio size={16} className="text-[#3fcf9e]" />
            <div>
              <p className="text-sm font-medium">Instant rooms</p>
              <p className="text-xs text-white/35">No setup, share an ID and go</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-[#0a0f0c] p-5">
            <Zap size={16} className="text-[#3fcf9e]" />
            <div>
              <p className="text-sm font-medium">Live chat & reactions</p>
              <p className="text-xs text-white/35">Built in, no extra setup</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}