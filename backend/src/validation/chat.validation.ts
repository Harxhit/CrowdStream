import Joi from "joi";

export const chatPayloadValidator = Joi.object({
  roomId: Joi.string()
    .trim()
    .min(3)
    .uuid()
    .max(50)
    .required(),

  message: Joi.string()
    .trim()
    .required()
    .min(1)
    .max(500), 
});
