import { getSocket } from "./socket";
import Room from "./room";
import frontendMemoryRoom from "./store/room.store";
import { Device } from "mediasoup-client";
import type { FrontendRoom, ProducerKind } from "./types/room.types";
import { iceServers } from "./utils/iceServer.util";
import type { AckResponse } from "./utils/ack.util";
import type { RtpCapabilities, IceCandidate , IceParameters, DtlsParameters } from "mediasoup-client/types";
import type { Socket } from "socket.io-client";

let socket: Socket;

type CreateRoomAck = AckResponse<{
  roomId: string
}>

type RouterCapabilitesAck = AckResponse<{
  rtpCapabilites: RtpCapabilities 
}>

type CreateTransportAck = AckResponse<{
  id: string;
  iceParameters: IceParameters;
  iceCandidates: IceCandidate[];
  dtlsParameters: DtlsParameters;
}>;

type ProducerAck = AckResponse<{
  producerId: string; 
  producerKind: ProducerKind
}>

class Broadcaster {
  private room: FrontendRoom | null = null;

  //Creates the room
  async createRoom(): Promise<Room> {
    console.log("[Broadcaster] Room creation started");
    socket = getSocket()
      
    const response: CreateRoomAck = await socket.timeout(5000).emitWithAck('createRoom')

    if(!response.success){
      throw new Error(response.code)
    }
    const roomId = response.data.roomId; 
    const room: FrontendRoom = {
      id: roomId, 
      broadcasters: new Map(), 
      viewers: new Map()
    }

    const socketId = socket.id; 
    if(!socketId){
      throw new Error('SocketId not found')
    }

    room.broadcasters.set(socketId, {
      device: null,
      transports: new Map(), 
      producers: new Map(), 
      joinedAt: new Date(), 
      role: 'host'
    })

    this.room = room;

    frontendMemoryRoom.set(roomId, room)

    console.log("[Broadcaster] Room saved to frontend memory:", room);
  
    return room;
  }

  async getRouterCapabilities(roomId: string) {
    console.log('[Broadcaster] router capabilites started')
    
    const response:RouterCapabilitesAck = await socket.timeout(5000).emitWithAck('getRouterRtpCapabilities', roomId)

    if(!response.success){
      throw new Error(response.code); 
    }

    const socketId  = socket.id; 
    if(!socketId){
      throw new Error('SocketId not found')
    }

    const room = frontendMemoryRoom.get(roomId);
    
    const broadcaster = room?.broadcasters.get(socketId); 
    if(!broadcaster){
      throw new Error(`Broadcaster not found with socketId: ${socketId}`)
    }

    broadcaster.rtpCapabilities = response.data.rtpCapabilites

    console.log("[Broadcaster] router capabilities executed");

    return response.data.rtpCapabilites;
  }


  async loadDevice(routerRtpCapabilities: any) {
    console.log("[Broadcaster] device loading");
    if (!this.room){
      throw new Error('Room not created')
    }

    const room = frontendMemoryRoom.get(this.room.id);
    if (!room){
      throw new Error('Room not found')
    }

    const socketId = socket.id; 
    if(!socketId){
      throw new Error('SocketId not found')
    }
    const broadcaster = room.broadcasters.get(socketId)
    if(!broadcaster){
      throw new Error('Broadcaster not found')
    }

    const device = new Device()
    await device.load({ routerRtpCapabilities });
    broadcaster.device = device

    console.log("[Broadcaster] device loaded.");
  }

  async createBroadcasterTransport(roomId: string){
    console.log('[Broadcaster] Requesting broadcaster transport')

    const room = frontendMemoryRoom.get(roomId)
    if(!roomId){
      throw new Error('Room not found')
    }

    const socketId = socket.id 
    if(!socketId){
      throw new Error('SocketId not found')
    }
    const broadcaster = room?.broadcasters.get(socketId)
    if(!broadcaster){
      throw new Error('Broadcaster not found')
    }

    const broadcasterDevice = broadcaster.device; 
    if(!broadcasterDevice){
      throw new Error('Broadcaster device not loaded')
    }

    const response: CreateTransportAck = await socket.timeout(5000).emitWithAck('createBroadcasterTransport', roomId)

    if (!response.success) {
      throw new Error(response.code);
    }

    console.log("[Broadcaster] Transport params received");

    const {id, iceParameters,iceCandidates,dtlsParameters} = response.data;

    //Create browser transport
    const sendTransport = broadcasterDevice!.createSendTransport({
      id, 
      iceParameters,
      iceCandidates,
      dtlsParameters,
      iceServers,
      iceTransportPolicy: "all" 
    })

    broadcaster.transports.set('producer', sendTransport)

    //DTLS Handshake
    sendTransport.on('connect', ({dtlsParameters},cb) => {
      console.log('[Broadcaster] transport connect event')

      this.connectBroadcastersTransport(sendTransport.id, dtlsParameters)
      .then(() => {
        console.log('[Broadcaster] dtls connected')
        cb()
      })
      .catch(console.error)
    })

    //Producer handshake
    sendTransport.on(
      "produce",
      async (
        { kind, rtpParameters, appData },
        callback,
        errback
      ) => {
        try {
          const response: ProducerAck =
            await socket.timeout(5000).emitWithAck(
              "produce",
              {
                transportId: sendTransport.id,
                kind,
                rtpParameters,
                appData
              }
            );

          if (!response.success) {
            throw new Error(response.code);
          }

          const producerId = response.data.producerId; 

          broadcaster.producers.set(producerId,{
            kind, 
            appData
          })

          callback({
            id: response.data.producerId
          });

        } catch (error) {
          errback(error as Error);
        }
      }
    );


    sendTransport.on('connectionstatechange' , (state) => {
      console.log('[Broadcaster] transport state', state)
    })
    
    // sendTransport.on("connect" , () => {
    //   console.log('[Broadcaster] transport connected')
    // })
    
    sendTransport.on('icegatheringstatechange', (state) => {
      console.log('[Broadcaster ice gathering state]', state)
    })
  }

  async connectBroadcastersTransport(
    transportId: string,
    dtlsParameters: any
  ) {
    console.log(
      "[Broadcaster] transport connection started"
    );

    const response =
      await socket.timeout(5000).emitWithAck(
        "connectBroadcasterTransport",
        {
          transportId,
          dtlsParameters
        }
      );

    if (!response.success) {
      throw new Error(response.code);
    }

    console.log(
      "[Broadcaster] transport connected"
    );
  }

  async getUserMedia(){
    console.log('[Broadcaster] getting camera & mic')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video : true, 
        audio : true
      })
      
      return stream; 
    } catch (error) {
      console.error('Error getting media', error)
      throw error
    }

  }


  async startProducing(stream:any){
    const roomId = this.room?.id; 
    if(!roomId){
      throw new Error('RoomId not found')
    }
    const room = frontendMemoryRoom.get(roomId); 
    if(!room){
      throw new Error('Room not found')
    }
    const socketId = socket.id; 
    if(!socketId){
      throw new Error('SocketId not found')
    }

    const broadcaster = room.broadcasters.get(socketId)
    const sendTransport = broadcaster?.transports.get('producer')

    if(!sendTransport){
      return new Error('Transport not ready')
    } 

    console.log('Stream audio', stream?.getAudioTracks())

    if(!stream){
      throw new Error('Media not found')
    }

    const videoTrack = stream.getVideoTracks()[0]; 
    const audioTrack = stream.getAudioTracks()[0]; 

    console.log('[Broadcaster] producing video')
    await sendTransport.produce({track : videoTrack})

    console.log('[Broadcaster] producing audio')
    await sendTransport.produce({track : audioTrack}); 
  }
}

export default Broadcaster;
