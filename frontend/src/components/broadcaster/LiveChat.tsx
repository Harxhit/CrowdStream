import { Send } from "lucide-react";
import { useState } from "react";

type Message = {
  id: number;
  user: string;
  message: string;
};

export default function LiveChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      user: "System",
      message: "Live chat is ready.",
    },
  ]);

  const [text, setText] = useState("");

  function sendMessage(e: React.FormEvent) {
    e.preventDefault();

    if (!text.trim()) return;

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        user: "You",
        message: text,
      },
    ]);

    setText("");
  }

  return (
    <section className="flex h-[500px] flex-col rounded-2xl border border-neutral-800 bg-neutral-900 shadow-lg">
      <div className="border-b border-neutral-800 px-6 py-4">
        <h2 className="text-lg font-semibold">
          Live Chat
        </h2>

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
          messages.map((message) => (
            <div
              key={message.id}
              className="rounded-xl bg-neutral-950 p-3"
            >
              <p className="text-sm font-semibold text-blue-400">
                {message.user}
              </p>

              <p className="mt-1 text-sm text-neutral-300">
                {message.message}
              </p>
            </div>
          ))
        )}
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
    </section>
  );
}