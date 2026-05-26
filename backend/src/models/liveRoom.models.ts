import mongoose , {Schema} from "mongoose";

const liveRoomSchema = new Schema({
  experienceRoomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ExperienceRoom",
    required: true,
  },

  hostUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  status: {
    type: String,
    enum: ["live", "ended"],
    default: "live",
  },

  startedAt: {
    type: Date,
    default: Date.now,
  },

  endedAt: Date,
}, { timestamps: true });

const LiveRoom = mongoose.model(
  "LiveRoom",
  liveRoomSchema
);

export default LiveRoom