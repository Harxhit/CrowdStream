import {io} from 'socket.io-client'

const socket = io(import.meta.env.VITE_SIGNALING_URL)

socket.on('connect', () => {
    console.log('Client connected', socket.id)
})

socket.on("disconnect", (reason) => {
    console.log('Socket disconncted',reason)
})

socket.on('connect_error',(error) => {
    console.log('Error', error.message)
})

export {socket}
