import Joi from "joi";

const ALLOWED_REACTIONS = [
  "👍",
  "❤️",
  "😂",
  "🎉",
  "👏",
  "🔥",
  "😮",
];

export const reactionSchema = Joi.object({
  roomId: Joi.string().min(1).max(50).trim().required(),
  emoji: Joi.string().valid(...ALLOWED_REACTIONS).trim().required(),
});