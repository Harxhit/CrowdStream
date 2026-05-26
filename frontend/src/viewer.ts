import Room from "./room";
import { socket } from "./socket";
import { Device } from "mediasoup-client";
import frontendMemoryRoom from "./store/room.store";


class Viewer{
    private room:Room | null = null;

    async joinRoom(roomId:string){
        console.log('[Viewer] join room started',roomId)
        const data = await new Promise<any>((resolve,reject) => {
            socket.emit('joinRoom',{roomId} , (response:any) => {
                console.log('Response',response)
                if(response?.error){
                    reject(new Error(response.error))
                }else{
                    resolve(response)
                }
            })
        })
        let room = frontendMemoryRoom.get(roomId)
        if(!room){
            room = new Room(roomId); 
            frontendMemoryRoom.set(roomId, room)
            }
        
        room!.rtpCapabilities = data.rtpCapabilities
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

        const params  = await new Promise<any>((resolve , reject) => {    
            const timeOut = setTimeout(() => {
                reject(new Error('Transport timeout'))
            },5000)

            socket.once('viewerTransportCreated' , (data) => {
                clearTimeout(timeOut); 
                resolve(data)
            })

            socket.emit('createViewerTransport', {roomId})
        })

        console.log('[Viewer] transport recieved', params)


        const {id,iceParameters,iceCandidates,dtlsParameters} = params;

        
        //Create browser rec transport 
        this.room.recTransport = this.room.device.createRecvTransport({
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

    return new Promise<void>((resolve,reject) => {
      const timeOut = setTimeout(() => {
        reject(new Error('Transport connection error'))
      },5000)

      socket.once('consumerTransportConnected', () => {
        clearTimeout(timeOut)
        resolve()
      })


      socket.emit('connectConsumerTransport', {
        transportId, dtlsParameters
      })

      console.log('[Broadcaster] transport connection executed')

    })
    }

    async consumeMedia(roomId: string , rtpCapabilities:any){
        
        const data = await new Promise<any>((resolve,reject) => {
            const timeOut = setTimeout(() => {
                reject('Consume timeout')
            }, 5000);

            socket.once('consumerCreated' , (params) => {
                clearTimeout(timeOut)
                console.log("Params" ,params)
                resolve(params)
            })

            socket.emit('consume', {roomId, rtpCapabilities})
        })
        

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

        return new Promise<void>((resolve,reject) => {
            const timeOut = setTimeout(() => {
                reject(new Error('Resume consumer timeout'))
            },5000)
            if(!room) return reject(new Error('Room not found'))

            if(room.consumers.size === 0) return reject(new Error('Consumer not found'))

            socket.once('resumed', () => {
                clearTimeout(timeOut)
                resolve()
            })

            socket.emit('resumeConsumer', {roomId})
    

        })

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