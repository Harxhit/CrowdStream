import { ArrowRight, LogOut } from "lucide-react";

interface ViewerControlsProps {
  connected: boolean;
  roomId: string;
  setRoomId: React.Dispatch<React.SetStateAction<string>>;
  onJoin: (e: React.FormEvent<HTMLFormElement>) => void;
  onLeave: () => void;
}

export default function ViewerControls({
  connected,
  roomId,
  setRoomId,
  onJoin,
  onLeave,
}: ViewerControlsProps) {
  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900 shadow-lg">
      <div className="border-b border-neutral-800 px-6 py-4">
        <h2 className="text-lg font-semibold">
          Stream Controls
        </h2>

        <p className="mt-1 text-sm text-neutral-400">
          Join or leave a live stream.
        </p>
      </div>

      <div className="p-6">
        {!connected ? (
          <form onSubmit={onJoin} className="space-y-5">
            <div>
              <label
                htmlFor="roomId"
                className="mb-2 block text-sm font-medium"
              >
                Room ID
              </label>

              <input
                id="roomId"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Paste Room ID"
                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 outline-none transition focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={!roomId.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 font-semibold transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ArrowRight size={18} />
              Join Stream
            </button>
          </form>
        ) : (
          <div className="space-y-5">
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
              <p className="text-sm text-green-400">
                Connected to room
              </p>

              <p className="mt-2 break-all font-mono text-white">
                {roomId}
              </p>
            </div>

            <button
              onClick={onLeave}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3 font-semibold transition hover:bg-red-700"
            >
              <LogOut size={18} />
              Leave Stream
            </button>
          </div>
        )}
      </div>
    </section>
  );
}