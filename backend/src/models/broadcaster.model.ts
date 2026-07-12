import { Schema, model } from "mongoose";

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

const Broadcaster = model("Broadcaster", broadcasterSchema);

export default Broadcaster;