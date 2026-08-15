import ffmpegPath from "ffmpeg-static";
import {spawn} from 'node:child_process'
import { activeRecordings } from "../stores/maps";
import logger from "../utils/logging";


export const startFfmpegRecording = (roomId: string) => {
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
    activeRecordings.delete(roomId)
  });

  return ffmpeg; 
}


export const stopFfmpegRecording = async(roomId: string) => {
  const ffmpeg = activeRecordings.get(roomId); 
  if (!ffmpeg?.ffmpeg) {
    logger.warn(`No active recording for room ${roomId}`);
  }

  ffmpeg?.ffmpeg.once("exit", () => {
    activeRecordings.delete(roomId);
  });

  ffmpeg?.ffmpeg.kill("SIGINT");
}