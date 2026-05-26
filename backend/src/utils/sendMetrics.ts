// export const sendMetrics = async () => {
//   //Return brandwidth array also bytes recieved(by using it can calculate latest or average)
//   const bandWidth = async (myPeerConnection: RTCPeerConnection) => {
//     const stats = await myPeerConnection.getStats();
//     const result: any[] = [];

//     stats.forEach((report) => {
//       if (report.type === "inbound-rtp" && report.kind === "video") {
//         console.log(
//           report.timestamp,
//           report.bytesReceived,
//           report.framesDecoded,
//           report.framesDropped
//         );
//         result.push({
//           id: report.id,
//           timestamp: report.timestamp,
//           bytesReceived: report.bytesReceived,
//           framesDecoded: report.framesDecoded,
//           framesDropped: report.framesDropped,
//           packetLost: report.packetsLost,
//         });
//       }
//     });

//     let brandWidth: any[] = [];

//     for (let i = 1; i < result.length; i++) {
//       const newBytes = result[i].bytesReceived;
//       const oldBytes = result[i - 1].bytesReceived;

//       const newTimestamp = result[i].timestamp;
//       const oldTimestamp = result[i - 1].timestamp;

//       const timeDiff = (newTimestamp - oldTimestamp) / 1000;
//       const bytesDiff = newBytes - oldBytes;

//       const bandwidthBps = (bytesDiff * 8) / timeDiff;
//       brandWidth.push(bandwidthBps);
//     }
//     const bytesReceived = result[result.length - 1].bytesReceived;
//     return { result, bytesReceived, brandWidth };
//   };
//   //Returns rountrip time for server array
//   const latency = async (myPeerConnection: RTCPeerConnection) => {
//     const dataChannel = await myPeerConnection.getStats();
//     const result: any[] = [];

//     dataChannel.forEach((report) => {
//       if (report.type === "candidate-pair" && report.state === "succeeded") {
//         result.push({
//           id: report.id,
//           rttMs: report.currentRoundTripTime * 1000,
//         });
//       }
//     });
//     return result;
//   };

//   //Returns packetLoss
//   const packetLoss = async (myPeerConnection: RTCPeerConnection) => {
//     const packetLoss = await myPeerConnection.getStats();
//     const result: any[] = [];
//     packetLoss.forEach((report) => {
//       if (report.type === "inbound-rtp" && report.kind === "video") {
//         const packetsReceived = report.packetsReceived;
//         const packetsLost = report.packetsLost;

//         const packetLossPercentage =
//           (packetsLost / (packetsReceived + packetsLost)) * 100;

//         result.push(packetLossPercentage);
//       }
//     });
//     return result;
//   };

//   //Returns variation in time between packet arrivals.
//   const jitter = async (myPeerConnection: RTCPeerConnection) => {
//     const jitter = await myPeerConnection.getStats();
//     const result: any[] = [];

//     jitter.forEach((report) => {
//       if (report.type === "inbound-rtp" && report.kind === "video") {
//         const jittterMiliseconds = report.jitter * 1000;
//         result.push(jittterMiliseconds);
//       }
//     });
//     return result;
//   };

//   // Returns number of video frames decoded or rendered per second also frame dropped
//   const frameRate = async (myPeerConnection: RTCPeerConnection) => {
//     const frameRate = await myPeerConnection.getStats();
//     const result: any[] = [];

//     frameRate.forEach((report) => {
//       if (report.type === "inbound-rtp" && report.kind === "video") {
//         result.push({
//           id: report.id,
//           timestamp: report.timestamp,
//           framesDecoded: report.framesDecoded,
//           framesDropped: report.framesDropped,
//         });
//       }
//     });
//     return result;
//   };

//   //Returns (width , height)
//   const resolution = (videoTrack: MediaStreamTrack) => {
//     const settings = videoTrack.getSettings();
//     const width = settings.width;
//     const height = settings.height;
//     return { width, height };
//   };

//   //Return the current audio level (RMS) of the track.
//   const audioLevel = async (audioTrack: MediaStreamTrack) => {
//     const audioContext = new AudioContext();
//     const source = audioContext.createMediaStreamSource(
//       new MediaStream([audioTrack])
//     );
//     const analyzer = audioContext.createAnalyser();
//     analyzer.fftSize = 2048;
//     source.connect(analyzer);

//     const dataArray = new Uint8Array(analyzer.fftSize);
//     analyzer.getByteTimeDomainData(dataArray);

//     let sum = 0;
//     for (let i = 0; i < dataArray.length; i++) {
//       const normalized = (dataArray[i] - 128) / 128;
//       sum += normalized * normalized;
//     }
//     const rms = Math.sqrt(sum / dataArray.length);
//     return rms;
//   };
// };
