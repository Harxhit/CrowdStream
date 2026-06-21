import { socket } from "./socket";
import Room from "./room";
import frontendMemoryRoom from "./store/room.store";
import { Device } from "mediasoup-client";


class Broadcaster {
  private room: Room | null = null;

  //Creates the room
  async createRoom(): Promise<Room> {
    console.log("[Broadcaster] Room creation started");
      
    const response = await socket.timeout(5000).emitWithAck('createRoom')

    if(!response.success){
      throw new Error(response.code)
    }
    const room = new Room(response.roomId);
  
    frontendMemoryRoom.set(response.roomId, room);
  
    this.room = room;
  
    console.log("[Broadcaster] Room saved to frontend memory:", frontendMemoryRoom);
  
    return room;
  }

  async getRouterCapabilities(roomId: string) {
    console.log('[Broadcaster] router capabilites started')
    
    const response = await socket.timeout(5000).emitWithAck('getRouterRtpCapabilities', roomId)

    if(!response.success){
      throw new Error(response.code); 
    }

    console.log("[Broadcaster] router capabilities executed");

    return response.rtpCapabilites;
  }


  async loadDevice(routerRtpCapabilities: any) {
    if (!this.room){
      throw new Error('Room not created')
    }
    console.log("[Broadcaster] device loading");

    this.room.device = new Device();
    await this.room.device.load({ routerRtpCapabilities });

    const room = frontendMemoryRoom.get(this.room.id);
    if (!room){
      throw new Error('Room not found')
    }
    room.device = this.room.device;

    console.log("[Broadcaster] device loaded.");
  }


  async createBroadcasterTransport(roomId: string){
    if(!this.room || !this.room.device) return new Error('Device not ready')

    console.log('[Broadcaster] Requesting broadcaster transport')

    const params = await new Promise<any>((resolve, reject) => {
      const timeOut = setTimeout(() => reject(new Error('Transport timeout')),5000)

      socket.once('broadcasterTransportCreated', (data) => {
        clearTimeout(timeOut)
        resolve(data)
      })

      socket.emit('createBroadcasterTransport',{roomId})
    })

    console.log("[Broadcaster] Transport params received", params);

    const {id, iceParameters,iceCandidates,dtlsParameters} = params;

    // const iceServers = [
    //   { urls: 'stun:stun.l.google.com:19302' },
    // ];


    //Create browser transport
    this.room.sendTransport = this.room?.device.createSendTransport({
      id, 
      iceParameters,
      iceCandidates,
      dtlsParameters,
      iceServers: [
        {
          urls: [
            "turn:65.0.239.130:3478?transport=udp",
            "turn:65.0.239.130:3478?transport=tcp",
            "turns:65.0.239.130:5349?transport=tcp"
          ],
          username: "myuser",
          credential: "mypassword"
        }
      ],
      iceTransportPolicy: "all" 
    })
    
    const room = frontendMemoryRoom.get(roomId)
    if(!room) return new Error('Room not found')
    room.sendTransport = this.room.sendTransport; 

    //DTLS Handshake
    this.room.sendTransport.on('connect', ({dtlsParameters},cb) => {
      console.log('[Broadcaster] transport connect event')

      this.connectBroadcastersTransport(this.room!.sendTransport!.id, dtlsParameters)
      .then(() => {
        console.log('[Broadcaster] dtls connected')
        cb()
      })
      .catch(console.error)
    })

    //Producer handshake
    this.room.sendTransport.on("produce", ({ kind, rtpParameters, appData }, callback) => {
      console.log('[Broadcaster] producer event',kind)
      socket.emit("produce", {
        transportId: this.room!.sendTransport!.id,
        kind,
        rtpParameters,
        appData
      });

      socket.once(`produced:${kind}`, ({ id }) => {

        this.room?.producer.set(id, {kind, appData})
        const room = frontendMemoryRoom.get(roomId); 
        if(!room) return new Error('Room not found')
        room.producer.set(id, {kind , appData})

        callback({ id });
      });
    });

    this.room.sendTransport.on('connectionstatechange' , (state) => {
      console.log('[Broadcaster] transport state',state)
    })

    this.room.sendTransport.on('icegatheringstatechange', (state) => {
      console.log('[Broadcaster state]',state)
    })
  }

  async connectBroadcastersTransport(transportId:string, dtlsParameters:any){
    console.log('[Broadcaster] transport connection started')

    return new Promise<void>((resolve,reject) => {
      const timeOut = setTimeout(() => {
        reject(new Error('Transport connection error'))
      },5000)

      socket.once('broadcasterTransportConnected', () => {
        clearTimeout(timeOut)
        console.log('[Broadcaster] transport connected')
        resolve()
      })


      socket.emit('connectBroadcasterTransport', {
        transportId, dtlsParameters
      })

      console.log('[Broadcaster] transport connection executed')

    })
  }

  async getUserMedia(){
    console.log('[Broadcaster] getting camera & mic')

    const stream = await navigator.mediaDevices.getUserMedia({
      video : true, 
      audio : true
    })

    return stream; 
  }


  async startProducing(){
    if(!this.room?.sendTransport) return new Error('Transport not ready')

    const stream = await this.getUserMedia()

    const videoTrack = stream.getVideoTracks()[0]; 
    const audioTrack = stream.getAudioTracks()[0]; 

    console.log('[Broadcaster] producing video')
    await this.room?.sendTransport?.produce({track : videoTrack})

    console.log('[Broadcaster] producing audio')
    await this.room!.sendTransport!.produce({track : audioTrack}); 

    console.log('Frontend room', frontendMemoryRoom.get(this.room.id))

  }

}

export default Broadcaster;
