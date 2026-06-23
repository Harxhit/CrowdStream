import dotenv from 'dotenv'; 
import logger from '../utils/logging';

dotenv.config(); 

interface Config{
    port: number; 
    rtcMinPort: number; 
    rtcMaxPort: number; 
    announcedIp: string;
    publicIp: string; 
    corsOrigin: string

}

const checkValid = (value:string): boolean => {
    return Number.isNaN(Number(value))
}

function loadConfig():Config{
    const port = process.env.PORT; 
    const rtcMinPort  = process.env.RTC_MIN_PORT; 
    const rtcMaxPort  = process.env.RTC_MAX_PORT
    const announcedIp  = process.env.ANNOUCED_IP
    const corsOrigin  = process.env.CORS_ORIGINS
    const publicIp  = process.env.PUBLIC_IP

    if(!port || !rtcMinPort || !rtcMaxPort || !announcedIp || !corsOrigin || !publicIp){
        logger.error('Enviorment variable missing'); 
        throw new Error('Enviorment variable is missing')
    }

    const numericEnv = [port, rtcMinPort,rtcMaxPort]

    if(numericEnv.some(checkValid)){
        logger.error("Invalid numeric env")
        throw new Error('Invalid numeric env')
    }

    return{
        port: Number(port), 
        rtcMinPort: Number(rtcMinPort),
        rtcMaxPort: Number(rtcMaxPort), 
        announcedIp, 
        corsOrigin, 
        publicIp
    }
}

const config  = loadConfig()
export default config; 