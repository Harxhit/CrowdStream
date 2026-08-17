import logger from "../utils/logging"
import { createPlainTransport } from "../mediasoup/transport"
import { consume } from "../handlers/viewer.handler";
import { getRoom } from "../rooms/room.store";
import config from "../config";
import { generateRecordingSdp } from "./sdp";
import { allocatePortPair } from "./portAllocator";


export const createAudioAndVideoPlainTranport = async (roomId: string, socketId: string) => {
  const { audioPort, videoPort } = allocatePortPair()
  console.log('Audio port', audioPort)
  console.log('Video port', videoPort)
  const audioTransport = await createPlainTransport(roomId, socketId, "recording-audio")
  const videoTransport = await createPlainTransport(roomId, socketId, "recording-video")

  await audioTransport.connect({
    ip: config.recordingIp,
    port: audioPort
  })

  await videoTransport.connect({
    ip: config.recordingIp,
    port: videoPort
  })

  return { audioTransport, videoTransport, audioPort, videoPort }
}

export const consumePlainTransportMedia = async (
  roomId: string,
  socketId: string,
  audioPort: number,
  videoPort: number
) => {
  try {
    const room = getRoom(roomId)
    const router = room.router;
    if (!router) {
      logger.error('Router not found')
      throw new Error("Router not found")
    }
    const audioResult = await consume(roomId, socketId, router.rtpCapabilities, 'recording-audio', audioPort);
    const videoResult = await consume(roomId, socketId, router.rtpCapabilities, 'recording-video', videoPort);
    generateRecordingSdp(audioResult.audioParameter!, videoResult.videoParameters!, roomId)

    return {
      audioConsumer: audioResult.consumer,
      videoConsumer: videoResult.consumer
    }
  } catch (error) {
    logger.error('Recording pipeline', {
      error: (error as Error).message,
      stack: (error as Error).stack
    })
    throw error
  }
}
