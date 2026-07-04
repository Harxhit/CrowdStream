import { Router } from "express";
import { authenticate } from "../middlewares/authentication.middleware";
import { getTurnCreds } from "../controllers/turn.controller";

export const turnRouter = Router()

turnRouter.get("/credentials", authenticate, getTurnCreds);