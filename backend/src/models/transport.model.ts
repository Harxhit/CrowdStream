import mongoose from "mongoose";

const transportScehma = new mongoose.Schema({
  roomId: { type: String, required: true },
  userId: { type: String, required: true },
  transportId: { type: String, required: true },
  type: { type: String, enum: ["broadcaster", "viewer"], required: true },
  dtlsState: { type: String },
  createdAt: { type: Date, default: Date.now },
  closedAt: { type: Date },
});

export const Transport = mongoose.model("Transport", transportScehma);
