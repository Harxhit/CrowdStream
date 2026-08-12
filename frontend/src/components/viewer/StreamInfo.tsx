import { Users, Radio, Wifi, Hash, User } from "lucide-react";
import { useEffect, useState } from "react";
import { getSocket } from "../../socket";

interface StreamInfoProps {
  roomId: string;
  connected: boolean;
}

export default function StreamInfo({ roomId, connected }: StreamInfoProps) {
  const socket = getSocket();
  const [viewers, setViewers] = useState(0);

  useEffect(() => {
    const handlePresence = (count: number) => {
      setViewers(count);
    };

    socket.on("room:presence", handlePresence);

    if (connected && roomId) {
      socket.emit("room:presence", roomId);
    }

    return () => {
      socket.off("room:presence", handlePresence);
    };
  }, [socket, roomId, connected]);

  return (
    <div className="space-y-2">
      <InfoRow
        icon={<Hash size={16} />}
        label="Room ID"
        value={roomId.length > 0 ? roomId : "Not connected"}
      />

      <InfoRow icon={<User size={16} />} label="Host" value="Unknown" />

      <InfoRow icon={<Users size={16} />} label="Viewers" value={viewers.toString()} />

      <InfoRow
        icon={<Radio size={16} />}
        label="Status"
        value={connected ? "LIVE" : "OFFLINE"}
        valueColor={connected ? "text-[#ff5c5c]" : "text-white/40"}
      />

      <InfoRow
        icon={<Wifi size={16} />}
        label="Connection"
        value={connected ? "Connected" : "Waiting"}
        valueColor={connected ? "text-[#3fcf9e]" : "text-white/40"}
      />
    </div>
  );
}

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColor?: string;
}

function InfoRow({ icon, label, value, valueColor = "text-white/85" }: InfoRowProps) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3.5 py-2.5">
      <div className="flex items-center gap-2.5">
        <div className="text-[#3fcf9e]">{icon}</div>
        <span className="text-sm text-white/50">{label}</span>
      </div>

      <span className={`max-w-[150px] truncate text-right text-sm font-medium ${valueColor}`}>
        {value}
      </span>
    </div>
  );
}