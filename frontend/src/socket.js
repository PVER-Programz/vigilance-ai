import { io } from 'socket.io-client';

const socket = io(`http://${window.location.hostname}:5000`, {
    autoConnect: false
});

export default socket;
