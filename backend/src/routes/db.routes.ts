import { Router } from "express";
import { dbReadinessCheck } from "../controllers/db.controller";

export const dbRouter = Router(); 

dbRouter.get('/__ping', dbReadinessCheck)