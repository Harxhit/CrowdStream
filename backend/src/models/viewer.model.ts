import {
  Schema,
  model,
  type Document,
  type Model,
} from "mongoose";
import mongoose from "mongoose";

interface ViewerAttrs {
  roomId: string;
  viewerId: string;
  socketId: string;
  ipHash: string;
  userAgentHash: string;
}

interface ViewerDoc extends Document {
  roomId: string;
  viewerId: string;
  socketId: string;
  ipHash: string;
  userAgentHash: string;
  transportIds: string[];
  consumerIds: string[];
  joinedAt: Date;
  leftAt?: Date | null;
  watchDurationSec?: number;
}

interface ViewerModel extends Model<ViewerDoc> {
  build(attrs: ViewerAttrs): ViewerDoc;
}

const viewerSchema = new mongoose.Schema<ViewerDoc>(
  {
    roomId: {
      type: String,
      required: true,
      index: true,
    },

    viewerId: {
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

    transportIds: {
      type: [String],
      default: [],
    },

    consumerIds: {
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

    watchDurationSec: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

viewerSchema.index({ roomId: 1, viewerId: 1 });
viewerSchema.index({ roomId: 1, joinedAt: -1 });

viewerSchema.statics.build = function (attrs: ViewerAttrs) {
  return new this(attrs);
};

const Viewer = model<ViewerDoc, ViewerModel>(
  "Viewer",
  viewerSchema
);

export default Viewer;
