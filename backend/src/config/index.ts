import dotenv from 'dotenv'; 
import logger from '../utils/logging';

dotenv.config(); 

interface Config{
    port: number; 
    rtcMinPort: number; 
    rtcMaxPort: number; 
    announcedIp: string;
    publicIp: string; 
    corsOrigin: string;
    mongoUrl: string; 
    jwtSecret:string;
    accessTokenExpiry: string; 
    databaseName: string; 
    turnSecret: string;
    turnTtl: number; 
    mediasoupWorkers: number; 
    MEDIASOUP_MAX_WORKERS: number; 
    WORKER_THRESHOLD: number;
    redisHost: string
    redisPort1: number
    redisPort2: number
    redisPort3: number

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
    const mongoUrl = process.env.MONGO_DB_URL
    const jwtSecret = process.env.JWT_SECRET
    const accessTokenExpiry = process.env.ACCESS_TOKEN_EXPIRY; 
    const databaseName = process.env.DATABASE_NAME
    const turnSecret = process.env.TURN_SECRET; 
    const turnTtl = process.env.TURN_TTL; 
    const mediaSoupWorker = process.env.MEDIASOUP_WORKER; 
    const mediaSoupMaxWorker = process.env.MEDIASOUP_MAX_WORKERS; 
    const workerThreshold = process.env.WORKER_THRESHOLD; 
    const redisHost = process.env.REDIS_HOST
    const redisPort1 = process.env.REDIS_PORT1
    const redisPort2 = process.env.REDIS_PORT2
    const redisPort3 = process.env.REDIS_PORT3

    if(!port || !rtcMinPort || !rtcMaxPort || !announcedIp || !corsOrigin || !publicIp || !mongoUrl || !jwtSecret || !accessTokenExpiry || !databaseName || !turnSecret || !turnTtl || !mediaSoupWorker || !mediaSoupMaxWorker || !workerThreshold || !redisHost || !redisPort1 || !redisPort2 || !redisPort3){
        logger.error('Enviorment variable missing'); 
        throw new Error('Enviorment variable is missing')
    }

    const numericEnv = [port, rtcMinPort,rtcMaxPort, turnTtl, mediaSoupWorker, workerThreshold, mediaSoupMaxWorker, redisPort1, redisPort2, redisPort3]

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
        publicIp,
        mongoUrl, 
        jwtSecret, 
        accessTokenExpiry,
        databaseName, 
        turnSecret, 
        turnTtl: Number(turnTtl), 
        mediasoupWorkers: Number(mediaSoupWorker), 
        MEDIASOUP_MAX_WORKERS: Number(mediaSoupMaxWorker), 
        WORKER_THRESHOLD: Number(workerThreshold),
        redisHost,
        redisPort1: Number(redisPort1),
        redisPort2: Number(redisPort2),
        redisPort3: Number(redisPort3)
    }
}

const config  = loadConfig()
export default config; 