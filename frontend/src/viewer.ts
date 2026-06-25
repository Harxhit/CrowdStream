import Room from "./room";
import { socket } from "./socket";
import { Device } from "mediasoup-client";
import frontendMemoryRoom from "./store/room.store";


class Viewer{
    private room:Room | null = null;

    async joinRoom(roomId:string){
        console.log('[Viewer] join room started', roomId)
        const response = await socket.timeout(5000).emitWithAck('joinRoom',roomId)
        if(!response.success){
            throw new Error(response.code)
        }

        let room = frontendMemoryRoom.get(roomId)
        if(!room){
            room = new Room(roomId); 
            frontendMemoryRoom.set(roomId, room)
        }
        
        room!.rtpCapabilities = response.rtpCapabilities
        this.room  = room
    }
    

  async loadDevice(routerRtpCapabilities: any) {
    if (!this.room) return new Error("Room not created");

    console.log("[Viewer] loading mediasoup device");

    this.room.device = new Device();
    await this.room.device.load({ routerRtpCapabilities });


    const room = frontendMemoryRoom.get(this.room.id);
    if (!room) return new Error("Room not found");
    room.device = this.room.device;

    console.log("[Viewer] device loaded with TURN");
  }

    async createViewerTransport(roomId:string){
        if(!this.room || !this.room.device) return new Error('Room or device not found')

        const response = await socket.timeout(5000).emitWithAck('createViewerTransport',roomId)
        if(!response.sucess){
            throw new Error(response.code)
        }

        console.log('[Viewer] transport recieved', response.data)


        const {id,iceParameters,iceCandidates,dtlsParameters} = response.data;

        
        //Create browser rec transport 
        this.room.recTransport = this.room.device.createRecvTransport({
            id,
            iceParameters,
            iceCandidates,
            dtlsParameters,
            iceServers: [
                {
            urls: [
                import.meta.env.VITE_TURN_UDP_URL,
                import.meta.env.VITE_TURN_TCP_URL,
                import.meta.env.VITE_TURNS_TCP_URL,
            ],
                username: import.meta.env.VITE_TURN_USERNAME,
                credential: import.meta.env.VITE_TURN_CREDENTIAL
                }
            ],
            iceTransportPolicy: "all"
        })

        const room = frontendMemoryRoom.get(roomId); 
        if(!room) return new Error('Room not found')
        room!.recTransport = this.room.recTransport

        //DTLS Handshake
        this.room.recTransport.on('connect' , ({dtlsParameters},cb) => {
            console.log('[Viewer] transport connect event')

            this.connectConsumerTransport(this.room!.recTransport!.id, dtlsParameters)
            .then(() => {
                console.log('[Viewer] dtls connected')
                cb()
            })
            .catch(console.error)
        })

    }

    async connectConsumerTransport(transportId: string, dtlsParameters : any){
        console.log('[Viewer] transport connection started')

        const response = await socket.timeout(5000).emitWithAck('connectConsumerTransport',transportId,dtlsParameters)
        if(!response.success){
            throw new Error(response.code)
        }

        console.log('[Viewer] transport connected')

    }

    async consumeMedia(roomId: string , rtpCapabilities:any){

        const response = await socket.timeout(5000).emitWithAck('consume',roomId,rtpCapabilities)
        if(!response.success){
            throw new Error(response.code)
        }
        const data = response.data; 
        console.log('Type of data',typeof data)
        if(Array.isArray(data)){
            for(const consumer of Object.values(data)){

                const room = frontendMemoryRoom.get(roomId); 
                if(!room)throw new Error('Room not found')

                const msConsumer = await room.recTransport?.consume({
                    id : consumer.id,
                    producerId: consumer.producerId, 
                    kind: consumer.kind, 
                    rtpParameters: consumer.rtpParameters, 
                })
                
                room?.consumers.set(consumer.id , msConsumer!)

            }
        }
    }

    async resumeConsumer(roomId:string){
        const room = frontendMemoryRoom.get(roomId); 

        if(!room || room.consumers.size === 0){
            throw new Error("Consumer not found")
        }

        for(const consumer of room.consumers.values()){
            const response = await socket.timeout(5000).emitWithAck('resumeConsumer', roomId, consumer.id)
            if(!response.success){
                throw new Error(response.code)
            }
        }

    }

    async renderMedia(roomId:string, viewerVideo:any){

        const room = frontendMemoryRoom.get(roomId); 
        if(!room) throw new Error('Room not found'); 
        
        const mediaStream = new MediaStream()
        
        const consumers = room.consumers; 
        consumers.forEach((c) => {
            const track = c.track
            console.log('Consumers track', track)
            mediaStream.addTrack(track)
        })
        viewerVideo.current.srcObject = mediaStream
        if(viewerVideo.current){
            console.log('Viewer started playing')
        }else{
            console.error('Video play error')
        }
    }

    async connectionState(roomId:string){
        const room = frontendMemoryRoom.get(roomId); 
        if(!room){ console.log('Room not found') 
            throw new Error('Room not found')}
        
        room.recTransport?.on('connectionstatechange', (state) => {
            console.log('[ICE State]', state)
        })

        room.recTransport?.on('icegatheringstatechange', (state) => {
            console.log('[Ice gathering] state', state)
        })
    }
    

}


export default Viewer