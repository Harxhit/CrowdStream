import type { RefObject } from "react";
import { Radio, Tv } from "lucide-react";

interface ViewerVideoProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  connected: boolean;
}

export default function ViewerVideo({
  videoRef,
  connected,
}: ViewerVideoProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 shadow-xl">
      <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold">
            Live Stream
          </h2>

          <p className="text-sm text-neutral-400">
            Watch the broadcaster in real time.
          </p>
        </div>

        {connected && (
          <span className="flex items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-xs font-semibold">
            <Radio size={12} />
            LIVE
          </span>
        )}
      </div>

      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          controls={false}
          className="h-full w-full object-cover"
        />

        {!connected && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <div className="rounded-xl border border-neutral-700 bg-neutral-900/90 px-8 py-6 text-center backdrop-blur">
              <Tv className="mx-auto mb-4 h-10 w-10 text-neutral-500" />

              <h3 className="text-lg font-semibold">
                Waiting for Stream
              </h3>

              <p className="mt-2 max-w-sm text-sm text-neutral-400">
                Enter a Room ID and join a live stream to begin watching.
              </p>
            </div>
          </div>
        )}

        <div className="absolute left-4 top-4 rounded-full bg-black/70 px-3 py-1 text-xs font-medium backdrop-blur">
          Viewer
        </div>
      </div>
    </section>
  );
}