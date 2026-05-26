import {io} from 'socket.io-client'

const socket = io("http://65.0.239.130:3000")


socket.on('connect', () => {
    console.log('Connected', socket.id)
})

socket.on('connect_error',(error) => {
    console.log('Error', error.message)
})

export {socket}
