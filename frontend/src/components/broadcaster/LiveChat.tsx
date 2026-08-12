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

function moderationMessage(reason?: string): string {
  switch (reason) {
    case 'PROFANITY':
      return "Message blocked: contains inappropriate language.";
    case 'SPAM_REPEATED_CHARS':
    case 'SPAM_EXCESSIVE_CAPS':
      return "Message blocked: looks like spam.";
    case 'MESSAGE_TOO_LONG':
      return "Message blocked: too long.";
    case 'LINK_NOT_ALLOWED':
      return "Message blocked: links aren't allowed in chat.";
    default:
      return "Your message couldn't be sent.";
  }
}

export default function LiveChat({ roomId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [chatRateLimitedUntil, setChatRateLimitedUntil] = useState<number | null>(null);
  const [reactionRateLimitedUntil, setReactionRateLimitedUntil] = useState<number | null>(null);
  const [moderationNotice, setModerationNotice] = useState<string | null>(null);
  const socket = getSocket();

  useEffect(() => {
    setMessages([]);
  }, [roomId]);

  useEffect(() => {
    const handleMessage = (message: Message) => {
      if (message.roomId !== roomId) return;
      setMessages((prev) => [...prev, message]);
    };

    const handleRateLimited = (data: { retryAt: number; action: 'chat' | 'reactions' }) => {
      const until = Date.now() + data.retryAt;
      if (data.action === 'chat') {
        setChatRateLimitedUntil(until);
        setTimeout(() => setChatRateLimitedUntil(null), data.retryAt);
      } else {
        setReactionRateLimitedUntil(until);
        setTimeout(() => setReactionRateLimitedUntil(null), data.retryAt);
      }
    };

    const handleModerated = (data: { reason?: string }) => {
      setModerationNotice(moderationMessage(data.reason));
      setTimeout(() => setModerationNotice(null), 4000);
    };

    socket.on("chat:message", handleMessage);
    socket.on("chat:rateLimited", handleRateLimited);
    socket.on("chat:moderated", handleModerated);

    return () => {
      socket.off("chat:message", handleMessage);
      socket.off("chat:rateLimited", handleRateLimited);
      socket.off("chat:moderated", handleModerated);
    };
  }, [socket, roomId]);

  const isChatRateLimited = chatRateLimitedUntil !== null && Date.now() < chatRateLimitedUntil;
  const isReactionRateLimited = reactionRateLimitedUntil !== null && Date.now() < reactionRateLimitedUntil;

  function sendMessage(e: React.FormEvent) {
    e.preventDefault();

    if (!text.trim()) return;
    if (!roomId) return;
    if (isChatRateLimited) return;

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
    if (isReactionRateLimited) return;

    console.log("LiveChat: Sending reaction", emoji, "to room:", roomId, "via socket:", socket.id);
    socket.emit("chat:reactions", {
      roomId,
      emoji,
    });
  }

  return (
    // No outer card here — this renders inside the unified sidebar panel's
    // "chat" tab, which already supplies the rounded-2xl/ring/bg wrapper.
    // Keeping this section un-boxed avoids nesting a card inside a card.
    <section className="flex h-[420px] flex-col lg:h-full">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="pt-8 text-center text-sm text-white/30">
            No messages yet.
          </p>
        ) : (
          messages.map((msg) => (
            <div key={`${msg.senderId}-${msg.timestamp}`} className="text-sm">
              <span className="font-medium text-[#3fcf9e]">{msg.senderId}</span>
              <span className="text-white/70">
                {" "}
                {msg.message}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-white/5">
        {isReactionRateLimited && (
          <p className="px-4 pt-2 text-xs text-amber-400/90">
            Reactions on cooldown
          </p>
        )}

        <div className="flex flex-wrap gap-1.5 px-4 py-3">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => sendReaction(emoji)}
              disabled={isReactionRateLimited}
              className="rounded-lg px-2 py-1.5 text-lg transition-all duration-150 hover:scale-110 hover:bg-white/5 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100"
            >
              {emoji}
            </button>
          ))}
        </div>

        {isChatRateLimited && (
          <p className="px-4 pb-1 text-xs text-amber-400/90">
            You're sending messages too fast
          </p>
        )}

        {moderationNotice && (
          <p className="px-4 pb-1 text-xs text-[#ff8a8a]">{moderationNotice}</p>
        )}

        <form onSubmit={sendMessage} className="flex gap-2 p-3 pt-0">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={isChatRateLimited ? "Slow down..." : "Send a message..."}
            disabled={isChatRateLimited}
            className="flex-1 rounded-lg bg-white/5 px-3 py-2.5 text-sm text-white outline-none ring-1 ring-transparent transition placeholder:text-white/30 focus:ring-[#3fcf9e]/50 disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={isChatRateLimited}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#3fcf9e] text-[#04241a] transition hover:bg-[#5fdcb2] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </section>
  );
}