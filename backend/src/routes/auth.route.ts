import { Router } from "express";
import {me} from '../controllers/auth.controller'
import {authenticate} from "../middlewares/authentication.middleware";

export const authRouter = Router()

authRouter.get("/me", authenticate, me);