import Room from "./room";
import { getSocket } from "./socket";
import { Device } from "mediasoup-client";
import frontendMemoryRoom from "./store/room.store";
import type { FrontendViewer , FrontendRoom} from "./types/room.types";
import type { AckResponse } from "./utils/ack.util";
import type { RtpCapabilities, IceParameters, IceCandidate, DtlsParameters, Consumer } from "mediasoup-client/types";
import { getIceServers } from "./utils/iceServer.util";
import { Socket } from "socket.io-client";

let socket: Socket; 

type BroadcasterInfo = {
  socketId: string;
  role: "host" | "co-host";
};

type JoinRoomAck = AckResponse<{
  rtpCapabilities: RtpCapabilities;
  broadcasters: BroadcasterInfo[];
}>;

type CreateTransportAck = AckResponse<{
  id: string;
  iceParameters: IceParameters;
  iceCandidates: IceCandidate[];
  dtlsParameters: DtlsParameters;
}>;


type ConsumerAck = AckResponse<{
    consumers: Consumer
}>

class Viewer{
    private room:Room | null = null;

    async joinRoom(roomId:string){
        socket = getSocket()
        console.info('[Viewer] join room started', roomId)

        const response:JoinRoomAck = await socket.timeout(5000).emitWithAck('joinRoom', roomId)
        if(!response.success){
            throw new Error(response.code)
        }

        const room: FrontendRoom = {
            id: roomId, 
            broadcasters: new Map(), 
            viewers: new Map()
        }
        if(!room){
            throw new Error('Room not found')
        }
        const socketId = socket.id; 
        if(!socketId){
            throw new Error('SocketId not found')
        }
        const rtpCapabilities = response.data.rtpCapabilities; 

        const viewer: FrontendViewer = {
            device: null,
            joinedAt: new Date(),
            consumers: new Map(),
            transports: new Map(),
            role: "viewer",
            rtpCapabilities: rtpCapabilities,
        };

        for (const broadcaster of response.data.broadcasters) {
            room.broadcasters.set(broadcaster.socketId, {
                device: null,
                transports: new Map(),
                producers: new Map(),
                joinedAt: new Date(),
                role: broadcaster.role,
                rtpCapabilities: undefined,
            });
        }

        room?.viewers.set(socketId, viewer)
        
        frontendMemoryRoom.set(roomId, room);
        this.room = room
        console.info('[Viewer] joined room',socketId)
        return response.data.rtpCapabilities
    }
    
    async loadDevice(routerRtpCapabilities: any) {
    console.log("[Viewer] device loading started");

    if (!this.room) throw new Error("Room not created");
    const roomId = this.room.id; 
    console.log('roomId',roomId)
    const room = frontendMemoryRoom.get(roomId)
    if(!room){
        throw new Error('Room not found')
    }
    const device = new Device();
    await device.load({ routerRtpCapabilities });

    const socketId = socket.id; 
    if(!socketId){
        throw new Error('SocketId not found')
    }

    const viewer = room.viewers.get(socketId); 
    if(!viewer){
        throw new Error('Viewer not found')
    }
    viewer.device = device; 
    console.log("[Viewer] device loaded");
    }

    async createViewerTransport(roomId:string){
        if(!this.room) return new Error('Room not found')

        const iceServers = await getIceServers()
        const response:CreateTransportAck = await socket.timeout(5000).emitWithAck('createViewerTransport',roomId)
        if(!response.success){
            throw new Error(response.code)
        }
        const room = frontendMemoryRoom.get(roomId); 
        if(!room){
            throw new Error('Room not found')
        }
        const socketId = socket.id; 
        if(!socketId){
            throw new Error('SocketId not found')
        }
        const viewer = room.viewers.get(socketId)
        if(!viewer){
            throw new Error('Viewer not found')
        }
        const viewerDevice = viewer.device;   
        if(viewerDevice === null){
            throw new Error("Viewer device not found")
        }     
        const {id,iceParameters,iceCandidates,dtlsParameters} = response.data;
        //Create browser rec transport 
        const recTransport = viewerDevice.createRecvTransport({
            id,
            iceParameters,
            iceCandidates,
            dtlsParameters,
            iceServers,
            iceTransportPolicy: "all"
        })  

        if(!recTransport){
            throw new Error('Error creating recv transport')
        }

        viewer.transports.set('consumer', recTransport)

        //DTLS Handshake
        recTransport.on('connect' , ({dtlsParameters},cb) => {
            console.log('[Viewer] transport connect event')

            this.connectConsumerTransport(recTransport.id, dtlsParameters)
            .then(() => {
                console.log('[Viewer] dtls connected')
                cb()
            })
            .catch(console.error)
        })

    }

    async connectConsumerTransport(transportId: string, dtlsParameters : any){
        console.log('[Viewer] transport connection started')

        const response = await socket.timeout(5000).emitWithAck('connectConsumerTransport', { transportId, dtlsParameters })
        if(!response.success){
            throw new Error(response.code)
        }

        console.log('[Viewer] transport connected')

    }

    async consumeMedia(roomId: string , rtpCapabilities:any){
        console.info('[Viewer] consume media started')

        const room = frontendMemoryRoom.get(roomId); 
        if(!room){
            throw new Error('Room not found')
        }
        const socketId = socket.id; 
        if(!socketId){
            throw new Error('SocketId not found')
        }
        const viewer = room.viewers.get(socketId); 
        if(!viewer){
            throw new Error('Viewer not found')
        }
        const recvTransport = viewer.transports.get('consumer'); 
        if(!recvTransport){
            throw new Error('Recv transport not found')
        }

        const response:ConsumerAck = await socket.timeout(5000).emitWithAck('consume', roomId , rtpCapabilities)
        if(!response.success){
            throw new Error(response.code)
        }

        const data = response.data.consumers;
        console.info('Type of data',typeof data)
        if(Array.isArray(data)){
            for(const consumer of Object.values(data)){

                const room = frontendMemoryRoom.get(roomId); 
                if(!room)throw new Error('Room not found')

                const msConsumer = await recvTransport.consume({
                    id : consumer.id,
                    producerId: consumer.producerId, 
                    kind: consumer.kind, 
                    rtpParameters: consumer.rtpParameters, 
                })
                
                viewer.consumers.set(consumer.id , msConsumer!)
            }
        }

        console.info('[Viewer] consume media completed')
    }

    async resumeConsumer(roomId:string){
        console.info('[Viewer] resume consumer started')

        const room = frontendMemoryRoom.get(roomId); 
        if(!room){
            throw new Error('Room not found')
        }
        const socketId = socket.id; 
        if(!socketId){
            throw new Error('SocketId not found')
        }
        const viewer = room.viewers.get(socketId)
        if(!viewer){
            throw new Error('Viewer not found')
        }

        if(!room || viewer.consumers.size === 0){
            throw new Error("Consumer not found")
        }

        for(const consumer of viewer.consumers.values()){
            const response = await socket.timeout(5000).emitWithAck('resumeConsumer', roomId, consumer.id)
            if(!response.success){
                throw new Error(response.code)
            }
        }

        console.info('[Viewer] resume completed')

    }

    async renderMedia(roomId:string, viewerVideo:any){
        console.info('[Viewer] render media')

        const room = frontendMemoryRoom.get(roomId); 
        if(!room) throw new Error('Room not found'); 
        const socketId = socket.id; 
        if(!socketId){
            throw new Error('SocketId not found')
        }
        const viewer = room.viewers.get(socketId); 
        if(!viewer){
            throw new Error('Viewer not found')
        }

        const mediaStream = new MediaStream()
        
        const consumers = viewer.consumers; 
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
        console.info('[Viewer] render media')
    }

    async connectionState(roomId:string){
        const room = frontendMemoryRoom.get(roomId); 
        if(!room) throw new Error('Room not found') 
        const socketId = socket.id;
        if(!socketId){
            throw new Error('SocketId not found')
        }
        const viewer = room.viewers.get(socketId); 
        if(!viewer){
            throw new Error('Viewer not found')
        }
        const recvTransport = viewer.transports.get('consumer')
        if(!recvTransport){
            throw new Error('Transport not found')
        }
        recvTransport?.on('connectionstatechange', (state) => {
            console.log('[ICE State]', state)
        })

        recvTransport?.on('icegatheringstatechange', (state) => {
            console.log('[Ice gathering] state', state)
        })

    }

}


export default Viewer