import { Send } from "lucide-react";
import { useEffect, useState } from "react";
import { getSocket } from "../../socket";

type Message = {
  roomId: string;
  senderId: string;
  message: string;
  timestamp: number;
};

type Props = {
  roomId: string | null;
};

const REACTIONS = [
  "👍",
  "❤️",
  "😂",
  "🎉",
  "👏",
  "🔥",
  "😮",
];

export default function LiveChat({ roomId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const socket = getSocket();

  useEffect(() => {
    setMessages([]);
  }, [roomId]);

  useEffect(() => {
    const handleMessage = (message: Message) => {
      if (message.roomId !== roomId) return;

      setMessages((prev) => [...prev, message]);
    };

    socket.on("chat:message", handleMessage);

    return () => {
      socket.off("chat:message", handleMessage);
    };
  }, [socket, roomId]);

  function sendMessage(e: React.FormEvent) {
    e.preventDefault();

    if (!text.trim()) return;
    if (!roomId) return;

    socket.emit("chat:message", {
      roomId,
      message: text.trim(),
    });

    setText("");
  }

  function sendReaction(emoji: string) {
    if (!roomId) {
      console.warn("LiveChat: Cannot send reaction, roomId is empty/null");
      return;
    }
    console.log("LiveChat: Sending reaction", emoji, "to room:", roomId, "via socket:", socket.id);
    socket.emit("chat:reactions", {
      roomId,
      emoji,
    });
  }

  return (
    <section className="flex h-[500px] flex-col rounded-2xl border border-neutral-800 bg-neutral-900 shadow-lg">
      <div className="border-b border-neutral-800 px-6 py-4">
        <h2 className="text-lg font-semibold">Live Chat</h2>

        <p className="mt-1 text-sm text-neutral-400">
          Messages from viewers
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-neutral-500">
            No messages yet.
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={`${msg.senderId}-${msg.timestamp}`}
              className="rounded-xl bg-neutral-950 p-3"
            >
              <p className="text-sm font-semibold text-blue-400">
                {msg.senderId}
              </p>

              <p className="mt-1 text-sm text-neutral-300 break-words">
                {msg.message}
              </p>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-neutral-800">
        <div className="flex flex-wrap gap-2 px-4 py-3">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => sendReaction(emoji)}
              className="rounded-lg bg-neutral-800 px-3 py-2 text-2xl transition-all duration-200 hover:scale-110 hover:bg-neutral-700 active:scale-95"
            >
              {emoji}
            </button>
          ))}
        </div>

        <form
          onSubmit={sendMessage}
          className="flex gap-3 border-t border-neutral-800 p-4"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Send a message..."
            className="flex-1 rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 outline-none transition focus:border-blue-500"
          />

          <button
            type="submit"
            className="rounded-lg bg-blue-600 p-3 transition hover:bg-blue-700"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </section>
  );
}