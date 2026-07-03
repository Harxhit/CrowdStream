import {
  Users,
  Radio,
  Wifi,
  Hash,
  User,
} from "lucide-react";

interface StreamInfoProps {
  roomId: string;
  viewers: number;
  connected: boolean;
}

export default function StreamInfo({
  roomId,
  viewers,
  connected,
}: StreamInfoProps) {
  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900 shadow-lg">
      <div className="border-b border-neutral-800 px-6 py-4">
        <h2 className="text-lg font-semibold">
          Stream Information
        </h2>

        <p className="mt-1 text-sm text-neutral-400">
          Current stream details
        </p>
      </div>

      <div className="space-y-4 p-6">

        <InfoRow
          icon={<Hash className="h-5 w-5" />}
          label="Room ID"
          value={
            roomId.length > 0
              ? roomId
              : "Not Connected"
          }
        />

        <InfoRow
          icon={<User className="h-5 w-5" />}
          label="Host"
          value="Unknown"
        />

        <InfoRow
          icon={<Users className="h-5 w-5" />}
          label="Viewers"
          value={viewers.toString()}
        />

        <InfoRow
          icon={<Radio className="h-5 w-5" />}
          label="Status"
          value={connected ? "LIVE" : "OFFLINE"}
          valueColor={
            connected
              ? "text-red-400"
              : "text-neutral-400"
          }
        />

        <InfoRow
          icon={<Wifi className="h-5 w-5" />}
          label="Connection"
          value={
            connected
              ? "Connected"
              : "Waiting"
          }
          valueColor={
            connected
              ? "text-green-400"
              : "text-neutral-400"
          }
        />
      </div>
    </section>
  );
}

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColor?: string;
}

function InfoRow({
  icon,
  label,
  value,
  valueColor = "text-white",
}: InfoRowProps) {
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

      <span
        className={`max-w-[170px] truncate text-right font-semibold ${valueColor}`}
      >
        {value}
      </span>
    </div>
  );
}