import Joi from "joi";

export const reactionSchema = Joi.object({
  roomId: Joi.string().min(1).max(50).trim().required(),
  emoji: Joi.string().trim().min(1).max(8).required(),
});