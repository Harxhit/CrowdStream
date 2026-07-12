import { Schema, model, Types } from "mongoose";

export const LIVE_ROOM_STATUS = Object.freeze({
  LIVE: "live",
  ENDED: "ended",
} as const);

const liveRoomSchema = new Schema(
  {
    experienceRoomId: {
      type: Types.ObjectId,
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
      enum: Object.values(LIVE_ROOM_STATUS),
      default: LIVE_ROOM_STATUS.LIVE,
      index: true,
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