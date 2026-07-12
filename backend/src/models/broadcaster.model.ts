import { Schema, model } from "mongoose";

export const BROADCASTER_ROLE = Object.freeze({
  HOST: "host",
  CO_HOST: "co_host",
} as const);

const broadcasterSchema = new Schema(
  {
    roomId: {
      type: String,
      required: true,
      index: true,
    },

    broadcasterId: {
      type: String,
      required: true,
      index: true,
    },

    socketId: {
      type: String,
      required: true,
      index: true,
    },

    ipHash: {
      type: String,
      required: true,
    },

    userAgentHash: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: Object.values(BROADCASTER_ROLE),
      default: BROADCASTER_ROLE.HOST,
      index: true,
    },

    transportIds: {
      type: [String],
      default: [],
    },

    producerIds: {
      type: [String],
      default: [],
    },

    joinedAt: {
      type: Date,
      default: Date.now,
    },

    leftAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "broadcasters",
  }
);

broadcasterSchema.index({ roomId: 1 });
broadcasterSchema.index({ broadcasterId: 1 });
broadcasterSchema.index({ roomId: 1, broadcasterId: 1 });
broadcasterSchema.index({ roomId: 1, role: 1 });

const Broadcaster = model("Broadcaster", broadcasterSchema);

export default Broadcaster;