import type { RefObject } from "react";
import { CameraOff } from "lucide-react";

interface VideoPreviewProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  isLive: boolean;
}

export default function VideoPreview({
  videoRef,
  isLive,
}: VideoPreviewProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 shadow-xl">
      <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold">Live Preview</h2>

          <p className="text-sm text-neutral-400">
            Camera preview before broadcasting
          </p>
        </div>

        <span className="rounded-full border border-neutral-700 bg-neutral-800 px-3 py-1 text-xs text-neutral-300">
          {isLive ? "LIVE" : "Preview"}
        </span>
      </div>

      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="h-full w-full object-cover"
        />

        {!isLive && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40">
            <div className="rounded-xl border border-neutral-700 bg-neutral-900/90 px-6 py-5 text-center backdrop-blur">
              <CameraOff className="mx-auto mb-3 h-10 w-10 text-neutral-500" />

              <h3 className="font-semibold">Camera Preview</h3>

              <p className="mt-2 max-w-xs text-sm text-neutral-400">
                Click{" "}
                <span className="font-medium text-white">
                  Start Streaming
                </span>{" "}
                to initialize your camera and begin broadcasting.
              </p>
            </div>
          </div>
        )}

        <div className="absolute left-4 top-4 rounded-full bg-black/70 px-3 py-1 text-xs font-medium backdrop-blur">
          Local Preview
        </div>
      </div>
    </section>
  );
}