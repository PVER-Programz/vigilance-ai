const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./middleware/config/db');
const authRoutes = require('./routes/auth');
const os = require('os');
const socketHandler = require('./sockets/socketHandler');

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

app.use(cors({
    origin: true, // This reflects the request origin, helpful for multi-device LAN
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);

// Socket.IO Logic
socketHandler(io);

const PORT = process.env.PORT || 5000;

server.listen(PORT, "0.0.0.0", () => {
    const networkInterfaces = os.networkInterfaces();

    console.log("Server running at:");

    // Localhost
    console.log(`  ➜ http://localhost:${PORT}`);

    // LAN IPs
    for (const interfaceName in networkInterfaces) {
        networkInterfaces[interfaceName].forEach((iface) => {
            if (iface.family === "IPv4" && !iface.internal) {
                console.log(`  ➜ http://${iface.address}:${PORT}`);
            }
        });
    }
});