import { Schema, model, type InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      index: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    passwordHash: {
      type: String,
      required: true,
    },

    roles: {
      type: [String],
      enum: ["user", "admin", "moderator"],
      default: ["user"],
    },

    refreshTokenHash: {
      type: String,
      default: null,
    },

    banned: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);
userSchema.index({email: 1}, {unique: true})

export type User = InferSchemaType<typeof userSchema>;

export default model<User>("User", userSchema);