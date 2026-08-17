import { Router } from "express";
import { downloadRecording } from "../controllers/recording.controller";
import { authenticate } from "../middlewares/authentication.middleware";

export const recordingRouter = Router()

recordingRouter.post("/download", authenticate, downloadRecording);