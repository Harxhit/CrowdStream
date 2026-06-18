import {io} from 'socket.io-client'

const socket = io(import.meta.env.VITE_SIGNALING_URL)


socket.on('connect', () => {
    console.log('Connected', socket.id)
})

socket.on('connect_error',(error) => {
    console.log('Error', error.message)
})

export {socket}
