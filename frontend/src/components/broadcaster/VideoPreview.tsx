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
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3 sm:px-5 sm:py-4">
        <div>
          <h2 className="text-base font-semibold sm:text-lg">Live preview</h2>
          <p className="hidden text-sm text-neutral-400 sm:block">
            Camera preview before broadcasting
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            isLive
              ? "bg-[#E24B4A]/15 text-[#f0a0a0] ring-1 ring-inset ring-[#E24B4A]/30"
              : "border border-neutral-700 bg-neutral-800 text-neutral-300"
          }`}
        >
          {isLive ? "Live" : "Preview"}
        </span>
      </div>

      {/* aspect-video keeps this correct at every width — no fixed height */}
      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="h-full w-full object-cover"
        />

        {!isLive && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 px-4">
            <div className="rounded-xl border border-neutral-700 bg-neutral-900/90 px-5 py-4 text-center backdrop-blur sm:px-6 sm:py-5">
              <CameraOff className="mx-auto mb-3 h-8 w-8 text-neutral-500 sm:h-10 sm:w-10" />
              <h3 className="text-sm font-semibold sm:text-base">Camera preview</h3>
              <p className="mt-2 max-w-xs text-xs text-neutral-400 sm:text-sm">
                Tap <span className="font-medium text-white">Start streaming</span> to
                initialize your camera and begin broadcasting.
              </p>
            </div>
          </div>
        )}

        <div className="absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-xs font-medium backdrop-blur sm:left-4 sm:top-4 sm:px-3">
          Local preview
        </div>
      </div>
    </section>
  );
}