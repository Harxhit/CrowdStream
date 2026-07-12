import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function connectSocket() {
    if (socket?.connected) return socket;

    socket = io(window.location.origin);

    socket.on("connect", () => {
        console.log("Client connected", socket?.id);
    });

    socket.on("disconnect", (reason) => {
        console.log("Socket disconnected", reason);
    });

    socket.on("connect_error", (error) => {
        console.log("Error", error.message);
    });

    socket.on("debug:instance", (data) => {
        console.log('Instance Id',data.instanceId)
    })

    return socket;
}

export function disconnectSocket() {
    socket?.disconnect();
    socket = null;
}

export function getSocket() {
    if(!socket){
        throw new Error('Socket not connected')
    }
    return socket;
}
