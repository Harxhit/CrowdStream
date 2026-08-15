import config from "../config";
import * as fs from 'fs';
import logger from "../utils/logging";

const generateAudioRecordingSdp = (
  audio: any,
  port: number
) => {
  const codec = audio.codecs[0];

  const payloadType = codec.payloadType;
  const codecName = codec.mimeType.split("/")[1];
  const clockRate = codec.clockRate;
  const channels = codec.channels;
  const parameters = codec.parameters;

  let sdp =
    `m=audio ${port} RTP/AVP ${payloadType}\r\n` +
    `a=rtpmap:${payloadType} ${codecName}/${clockRate}`;

  if (channels) {
    sdp += `/${channels}`;
  }

  sdp += `\r\n`;

  if (parameters && Object.keys(parameters).length > 0) {
    const fmtp = Object.entries(parameters)
      .map(([key, value]) => `${key}=${value}`)
      .join(";");

    sdp += `a=fmtp:${payloadType} ${fmtp}\r\n`;
  }

  return sdp;
};

const generateVideoRecordingSdp = (
  video: any,
  port: number
) => {
  const codec = video.codecs[0];

  const payloadType = codec.payloadType;
  const codecName = codec.mimeType.split("/")[1];
  const clockRate = codec.clockRate;
  const parameters = codec.parameters;

  let sdp =
    `m=video ${port} RTP/AVP ${payloadType}\r\n` +
    `a=rtpmap:${payloadType} ${codecName}/${clockRate}\r\n`;

  if (parameters && Object.keys(parameters).length > 0) {
    const fmtp = Object.entries(parameters)
      .map(([key, value]) => `${key}=${value}`)
      .join(";");

    sdp += `a=fmtp:${payloadType} ${fmtp}\r\n`;
  }

  return sdp;
};

//v=<version> (SDP Version)
//o=<username> <session-id> <session-version> <network-type> <address-type> <address>(SDP Origin field) 
//s=<session_name> (Session Name)
//t=<start-time> <stop-time> (Timing)
const generateRecordingSdp = (
  audioParameter: string,
  videoParameter: string, 
  roomId: string, 
) => {
  try {
    const sessionId = Date.now()
    const sessionVersion = 1; 
    const sessionInformation =
        `v=0\r\n` +
        `o=- ${sessionId} ${sessionVersion} IN IP4 ${config.recordingIp}\r\n` + 
        `s=Crowdstream Recording\r\n` +
        `c=IN IP4 ${config.recordingIp}\r\n` +
        `t=0 0\r\n`;

    const data =  sessionInformation + audioParameter + videoParameter;
    const filePath = `src/recording/${roomId}.sdp`
    
    console.log('File path', filePath)

    fs.writeFileSync(filePath, data, 'utf8')

  }catch (error) {
    logger.error('SDP file creation failed',{
        error: (error as Error).message,
        stack: (error as Error).stack
    })
    throw error
  }
  
};

export {generateAudioRecordingSdp, generateVideoRecordingSdp, generateRecordingSdp}