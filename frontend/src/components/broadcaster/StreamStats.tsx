import {
  Users,
  Radio,
  Timer,
  Wifi,
  Monitor,
} from "lucide-react";
import { useEffect, useState } from "react";
import { getSocket } from "../../socket";


interface StreamStatsProps {
  roomId: string | null;
  isLive: boolean;
  duration?: string;
}

export default function StreamStats({
  roomId,
  isLive,
  duration = "00:00",
}: StreamStatsProps) {

  const socket = getSocket(); 
  const [viewers , setViewers] = useState(0)

  useEffect(() => {
    setViewers(0);
    if (!roomId) return;

    const handlePresence = (count: number) => {
      setViewers(count);
    };

    setViewers(0)

    socket.on("room:presence", handlePresence);

    socket.emit("room:presence", roomId);

    return () => {
      socket.off("room:presence", handlePresence);
    };
  }, [socket, roomId]);

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900 shadow-lg">
      <div className="border-b border-neutral-800 px-6 py-4">
        <h2 className="text-lg font-semibold">
          Stream Statistics
        </h2>

        <p className="mt-1 text-sm text-neutral-400">
          Live stream information
        </p>
      </div>

      <div className="space-y-4 p-6">
        <Stat
          icon={<Users className="h-5 w-5" />}
          label="Viewers"
          value={viewers.toString()}
        />

        <Stat
          icon={<Radio className="h-5 w-5" />}
          label="Status"
          value={isLive ? "LIVE" : "OFFLINE"}
          valueColor={
            isLive
              ? "text-red-400"
              : "text-neutral-400"
          }
        />

        <Stat
          icon={<Timer className="h-5 w-5" />}
          label="Duration"
          value={duration}
        />

        <Stat
          icon={<Monitor className="h-5 w-5" />}
          label="Resolution"
          value="1280 × 720"
        />

        <Stat
          icon={<Wifi className="h-5 w-5" />}
          label="Connection"
          value={isLive ? "Connected" : "Waiting"}
          valueColor={
            isLive
              ? "text-green-400"
              : "text-neutral-400"
          }
        />

        {/*
          TODO:
          Calculate the stream duration dynamically.

          Suggested implementation:
          - Record the broadcast start time when streaming begins.
          - Update the duration every second.
          - Format the elapsed time as HH:MM:SS (or MM:SS).

          Example:
          const startTime = Date.now();
          const duration = formatDuration(Date.now() - startTime);
        */}
      </div>
    </section>
  );
}

interface StatProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColor?: string;
}

function Stat({
  icon,
  label,
  value,
  valueColor = "text-white",
}: StatProps) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-neutral-950 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="text-blue-400">
          {icon}
        </div>

        <span className="text-neutral-300">
          {label}
        </span>
      </div>

      <span className={`font-semibold ${valueColor}`}>
        {value}
      </span>
    </div>
  );
}