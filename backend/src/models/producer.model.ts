import mongoose from "mongoose";

const ProducerSchema = new mongoose.Schema({
  roomId: { type: String, required: true },
  broadcasterId: { type: String, required: true },
  producerId: { type: String, required: true },
  kind: { type: String },
  rtpParameters: { type: Object },
  createdAt: { type: Date, default: Date.now },
  closedAt: { type: Date },
});

export const Producer = mongoose.model("Producer", ProducerSchema);
