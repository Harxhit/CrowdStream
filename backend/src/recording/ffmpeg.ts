import ffmpegPath from "ffmpeg-static";
import {spawn} from 'node:child_process'
import { activeRecordings } from "../stores/maps";
import logger from "../utils/logging";


export const startFfmpegRecording = (roomId: string, socketId: string) => {
  const sdpPath = `src/recording/${roomId}.sdp`
  
  const ffmpeg = spawn(ffmpegPath!, [
    "-protocol_whitelist",
    "file,udp,rtp",
    "-i",
    sdpPath,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-c:a",
    "copy",
    `recording${roomId}${Date.now()}.mp4`
  ])

  ffmpeg.stderr.on("data", (data) => {
    console.log(`[FFmpeg] ${data}`);
  });
  
  ffmpeg.on("error", (error) => {
    console.error("Failed to start FFmpeg:", error);
  });
  
  ffmpeg.on("close", (code) => {
    console.log(`FFmpeg exited with code ${code}`);
    activeRecordings.delete(socketId)
  });

  return ffmpeg; 
}


export const stopFfmpegRecording = async(socketId:string) => {
  const ffmpeg = activeRecordings.get(socketId); 
  if (!ffmpeg?.ffmpeg) {
    logger.warn(`No active recording for room ${socketId}`);
    return; 
  }

  await new Promise<void>((resolve) => {
    ffmpeg.ffmpeg.once("close", () => {
      activeRecordings.delete(socketId);
      resolve();
    });

    ffmpeg.ffmpeg.kill("SIGINT");
  });
}