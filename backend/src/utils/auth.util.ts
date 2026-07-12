import bcrypt from 'bcrypt'; 
import jwt from 'jsonwebtoken'
import config from '../config';

const hashPassword = async(password:string):Promise<string> => {
    const salt = await bcrypt.genSalt(10); 
    const hashedPassword = bcrypt.hash(password, salt)
    return hashedPassword; 
}

const checkPassWordCorrect = (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

const generateAccessToken = (id:string) => {
    const payLoad = {
        sub: id.toString(),
        ver: "v1",
    };
    const secret = config.jwtSecret; 
    const expiresIn = config.accessTokenExpiry as any
    const accessToken = jwt.sign(payLoad, secret, {
        expiresIn: expiresIn
    })
    return accessToken; 
}

const generateRefereshToken = () => {}

export {hashPassword, checkPassWordCorrect, generateAccessToken}