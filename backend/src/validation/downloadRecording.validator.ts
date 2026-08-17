import Joi from "joi";

export const recordingValidator = Joi.object({
  recordingId: Joi.string()
    .required()
    .min(1)
    .max(128)
    .messages({
      "string.guid": "Recording ID must be a valid UUID v4",
      "any.required": "Recording ID is required",
      "string.empty": "Recording ID cannot be empty",
    }),

  socketId: Joi.string()
    .trim()
    .min(1)
    .max(128)
    .required()
    .messages({
      "any.required": "Socket ID is required",
      "string.empty": "Socket ID cannot be empty",
      "string.min": "Socket ID cannot be empty",
      "string.max": "Socket ID is too long",
    }),

  roomId: Joi.string()
    .trim()
    .min(1)
    .max(128)
    .required()
    .messages({
      "any.required": "Room ID is required",
      "string.empty": "Room ID cannot be empty",
      "string.min": "Room ID cannot be empty",
      "string.max": "Room ID is too long",
    }),
})
 
