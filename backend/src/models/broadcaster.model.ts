import mongoose from "mongoose";

const broadcasterScehma = new mongoose.Schema({
  roomId: { type: String, required: true },
  broadcasterId: { type: String },
  transportIds: [{ type: String }],
  producerIds: [{ type: String }],
  joinedAt: { type: Date, default: Date.now() },
  leftAt: { type: Date, default: Date.now() },
});

export const Broadcaster = mongoose.model("Broadcaster", broadcasterScehma);
