import { Schema, model } from "mongoose";

export const TRANSPORT_TYPE = Object.freeze({
  BROADCASTER: "broadcaster",
  VIEWER: "viewer",
} as const);

const transportSchema = new Schema(
  {
    roomId: {
      type: String,
      required: true,
      index: true,
    },

    userId: {
      type: String,
      required: true,
      index: true,
    },

    transportId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    type: {
      type: String,
      enum: Object.values(TRANSPORT_TYPE),
      required: true,
      index: true,
    },

    dtlsState: {
      type: String,
      enum: [
        "new",
        "connecting",
        "connected",
        "closed",
        "failed",
      ],
      default: "new",
    },

    closedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
    collection: "transports",
  }
);

transportSchema.index({ roomId: 1, type: 1 });
transportSchema.index({ roomId: 1, userId: 1 });
transportSchema.index({ roomId: 1, transportId: 1 });

const Transport = model("Transport", transportSchema);

export default Transport;