import { Copy, Check, Radio } from "lucide-react";
import { useState } from "react";

interface RoomCardProps {
  roomId: string | null;
}

export default function RoomCard({
  roomId,
}: RoomCardProps) {
  const [copied, setCopied] = useState(false);

  async function copyRoomId() {
    if (!roomId) return;

    await navigator.clipboard.writeText(roomId);

    setCopied(true);

    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900 shadow-lg">
      <div className="border-b border-neutral-800 px-6 py-4">
        <h2 className="text-lg font-semibold">
          Stream Information
        </h2>

        <p className="mt-1 text-sm text-neutral-400">
          Share this Room ID with viewers.
        </p>
      </div>

      <div className="space-y-6 p-6">
        <div>
          <p className="mb-2 text-xs uppercase tracking-wider text-neutral-500">
            Room ID
          </p>

          <div className="flex items-center gap-2">
            <input
              readOnly
              value={roomId ?? "Room will be created when you go live"}
              className="flex-1 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none"
            />

            <button
              onClick={copyRoomId}
              disabled={!roomId}
              className="rounded-lg border border-neutral-700 p-3 transition hover:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-400" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div className="rounded-xl bg-neutral-950 p-4">
          <div className="flex items-center justify-between">
            <span className="text-neutral-400">
              Status
            </span>

            <span
              className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
                roomId
                  ? "bg-red-500/20 text-red-400"
                  : "bg-neutral-800 text-neutral-400"
              }`}
            >
              <Radio className="h-4 w-4" />

              {roomId ? "LIVE" : "OFFLINE"}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
          <p className="text-sm leading-7 text-neutral-400">
            Once the stream starts, viewers can join using the Room ID
            shown above.
          </p>
        </div>
      </div>
    </section>
  );
}