import { Router } from 'express';
import { signIn, signUp } from '../controllers/user.controller';

export const userRouter = Router(); 

userRouter.route('/signUp').post(signUp)
userRouter.route('/signIn').post(signIn)
