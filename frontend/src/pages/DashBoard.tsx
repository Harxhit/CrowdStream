import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

export default function DashboardPage() {
  const navigate = useNavigate();

  const [roomId, setRoomId] = useState("");

  function handleJoinRoom(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (!roomId.trim()) return;

    navigate(`/viewer?roomId=${encodeURIComponent(roomId)}`);
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,#2563eb20,transparent_50%)]" />

      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-5xl font-bold">
            Crowd<span className="text-blue-500">Stream</span>
          </h1>

          <p className="mt-4 max-w-xl text-neutral-400">
            Create a new live stream or join an existing room using its Room ID.
          </p>
        </div>

        <div className="mt-16 grid w-full gap-8 md:grid-cols-2">
          {/* Create Room */}

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-8 transition hover:border-blue-500">
            <h2 className="text-2xl font-semibold">
              Create Room
            </h2>

            <p className="mt-3 text-neutral-400">
              Start a new live stream and become the broadcaster.
            </p>

            <Link
              to="/broadcaster"
              className="mt-8 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 font-semibold transition hover:bg-blue-700"
            >
              Create Room
              <ArrowRight size={18} />
            </Link>
          </div>

          {/* Join Room */}

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-8 transition hover:border-blue-500">
            <h2 className="text-2xl font-semibold">
              Join Room
            </h2>

            <p className="mt-3 text-neutral-400">
              Enter a Room ID to join an existing live stream.
            </p>

            <form
              onSubmit={handleJoinRoom}
              className="mt-8 space-y-4"
            >
              <input
                type="text"
                placeholder="Room ID"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 outline-none transition focus:border-blue-500"
              />

              <button
                type="submit"
                disabled={!roomId.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 font-semibold transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Join Room
                <ArrowRight size={18} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}