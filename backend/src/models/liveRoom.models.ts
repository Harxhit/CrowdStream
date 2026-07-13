import { Schema, model, Types } from "mongoose";

export const LIVE_ROOM_STATUS = Object.freeze({
  LIVE: "live",
  ENDED: "ended",
} as const);

const liveRoomSchema = new Schema(
  {
    experienceRoomId: {
      type: String,
      ref: "ExperienceRoom",
      required: true,
    },

    hostUserId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["live", "ended"],
      default: "live",
    },

    sfuNodeId: {
      type: String,
      required: true,
      index: true,
    },

    totalViewersJoined: {
      type: Number,
      default: 0,
      min: 0,
    },

    startedAt: {
      type: Date,
      default: Date.now,
    },

    endedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

liveRoomSchema.index({ experienceRoomId: 1, status: 1 });
liveRoomSchema.index({ hostUserId: 1, status: 1 });

const LiveRoom = model("LiveRoom", liveRoomSchema);

export default LiveRoom;