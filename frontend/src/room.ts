import type { Transport , Consumer , Device , RtpCapabilities } from "mediasoup-client/types";


class Room{

    id:string; 
    device: Device | null = null;
    rtpCapabilities: RtpCapabilities | null = null;
    sendTransport : Transport | null = null
    viewerTransport: Transport | null = null; 
    recTransport : Transport | null = null; 
    producer = new Map<string , {kind: 'audio' | 'video', appData: any}>()
    consumers = new Map<string, Consumer>()

    constructor(id:string){
        this.id = id
    }
}

export default Room