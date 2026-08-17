import ffmpegPath from "ffmpeg-static";
import {spawn} from 'node:child_process'
import { activeRecordings } from "../stores/maps";
import logger from "../utils/logging";


export const startFfmpegRecording = (roomId: string, socketId: string) => {
  const sdpPath = `src/recording/${roomId}.sdp`
  const recordingPath = `recording${roomId}${Date.now()}.mp4`
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
    recordingPath
  ])

  ffmpeg.stderr.on("data", (data) => {
    console.log(`[FFmpeg] ${data}`);
  });
  
  ffmpeg.on("error", (error) => {
    console.error("Failed to start FFmpeg:", error);
  });
  
  ffmpeg.on("close", (code) => {
    console.log(`FFmpeg exited with code ${code}`);
  });

  return {ffmpeg , recordingPath}; 
}


export const stopFfmpegRecording = async(socketId:string) => {
  const ffmpeg = activeRecordings.get(socketId); 
  if (!ffmpeg?.ffmpeg) {
    logger.warn(`No active recording for room ${socketId}`);
    return; 
  }

  await new Promise<void>((resolve) => {
    ffmpeg.ffmpeg.once("close", () => resolve());
    ffmpeg.ffmpeg.kill("SIGINT");
  });
}