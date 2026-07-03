import Joi from "joi";

export const signUpSchema = Joi.object({
  username: Joi.string()
    .trim()
    .alphanum()
    .min(3)
    .max(30)
    .required(),

  email: Joi.string()
    .trim()
    .pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid email address.",
    }),

  password: Joi.string()
    .min(8)
    .max(128)
    // Uncomment when enforcing strong passwords
    // .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&^#()[\]{}\-_=+|\\:;"'<>,./`~]).{8,128}$/)
    .required()
    .messages({
      // "string.pattern.base":
      //   "Password must contain uppercase, lowercase, number, and special character.",
    }),
});


export const signInSchema = Joi.object({
  email: Joi.string()
    .trim()
    .email()
    .required(),

  password: Joi.string()
    .min(8)
    .max(128)
    .required()
    // Uncomment when enforcing strong passwords
    // .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&^#()[\]{}\-_=+|\\:;"'<>,./`~]).{8,128}$/)
});