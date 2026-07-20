// Google Meet style screen-wide emoji particle burst overlay
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getSocket } from "../../socket";

type Reaction = {
  roomId: string;
  senderId: string;
  emoji: string;
  timestamp?: number;
  timeStamp?: number;
};

type FloatingReaction = Reaction & {
  id: string;
  left: number;
  duration: number;
  rotation: number;
  drift: number;
  wobble: number;
  size: number;
};

type Props = {
  roomId: string | null;
};

export default function ReactionOverlay({ roomId }: Props) {
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);

  useEffect(() => {
    if (!roomId) {
      console.log("ReactionOverlay: No roomId provided, skipping listener registration");
      return;
    }

    let socket: any;
    try {
      socket = getSocket();
    } catch (e) {
      console.warn("ReactionOverlay: Socket not connected yet", e);
      return;
    }

    console.log("ReactionOverlay: Subscribing to chat:reactions for room:", roomId);

    const handleReaction = (reaction: Reaction) => {
      console.log("ReactionOverlay: Received reaction event:", reaction, "Current room:", roomId);
      if (reaction.roomId !== roomId) {
        console.warn("ReactionOverlay: Room mismatch. Expected:", roomId, "Got:", reaction.roomId);
        return;
      }

      // Safe unique ID generator
      const uniqueId = Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

      const floating: FloatingReaction = {
        ...reaction,
        id: uniqueId,

        // Spawn near the bottom-left corner (similar to Google Meet)
        left: 4 + Math.random() * 8, // 4% to 12% from the left edge

        // Reasonable and elegant size (between 32px and 48px)
        size: 32 + Math.random() * 16,

        // Duration of float up (2s to 2.8s)
        duration: 2000 + Math.random() * 800,

        // Natural movement variables
        rotation: Math.random() * 30 - 15, // -15deg to 15deg
        drift: Math.random() * 40 - 20,    // drift left/right slightly
        wobble: Math.random() * 30 - 15,   // side-to-side sway
      };

      setReactions((prev) => [...prev, floating]);
    };

    socket.on("chat:reactions", handleReaction);

    return () => {
      console.log("ReactionOverlay: Unsubscribing from chat:reactions for room:", roomId);
      socket.off("chat:reactions", handleReaction);
    };
  }, [roomId]);

  const overlay = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 999999,
      }}
    >
      <AnimatePresence>
        {reactions.map((reaction) => (
          <motion.div
            key={reaction.id}
            initial={{
              opacity: 0,
              y: 0,
              x: 0,
              scale: 0,
              rotate: reaction.rotation,
            }}
            animate={{
              opacity: [0, 1, 1, 0],
              y: [0, -100, -220, -380],
              x: [
                0,
                reaction.wobble,
                reaction.drift,
                reaction.drift * 1.5,
              ],
              scale: [0, 1.2, 1.0, 0.8],
              rotate: [
                reaction.rotation,
                reaction.rotation + reaction.wobble,
                reaction.rotation - reaction.wobble,
                reaction.rotation,
              ],
            }}
            exit={{
              opacity: 0,
              scale: 0.5,
            }}
            transition={{
              duration: reaction.duration / 1000,
              ease: "easeOut",
              times: [0, 0.15, 0.6, 1],
            }}
            onAnimationComplete={() => {
              setReactions((prev) =>
                prev.filter((r) => r.id !== reaction.id)
              );
            }}
            style={{
              position: "absolute",
              left: `${reaction.left}%`,
              bottom: 80,

              fontSize: `${reaction.size}px`,

              userSelect: "none",
              willChange: "transform",

              filter: "drop-shadow(0 4px 12px rgba(0, 0, 0, 0.15))",
            }}
          >
            {reaction.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );

  return createPortal(overlay, document.body);
}
