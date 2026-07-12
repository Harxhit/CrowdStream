import { Schema, model } from "mongoose";

const producerSchema = new Schema(
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

    producerId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    kind: {
      type: String,
      enum: ["audio", "video"],
      required: true,
    },

    rtpParameters: {
      type: Schema.Types.Mixed,
      required: true,
    },

    closedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
    collection: "producers",
  }
);

producerSchema.index({ roomId: 1 });
producerSchema.index({ broadcasterId: 1 });
producerSchema.index({ roomId: 1, broadcasterId: 1 });
producerSchema.index({ roomId: 1, kind: 1 });

const Producer = model("Producer", producerSchema);

export default Producer;