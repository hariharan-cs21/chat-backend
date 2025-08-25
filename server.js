require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});


const fs = require('fs');
// Ensure upload directories exist
['uploads', 'uploads/profile_photos', 'uploads/files'].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/messages', require('./routes/messages'));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
    .catch(err => console.log(err));


const User = require('./models/User');
const Message = require('./models/Message');

// Store online users: { userId: socketId }
let onlineUsers = {};

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // User joins with their userId
    socket.on('user-online', async (userId) => {
        onlineUsers[userId] = socket.id;
        await User.findByIdAndUpdate(userId, { online: true });
        io.emit('online-users', Object.keys(onlineUsers));
    });

    // Send message event
    socket.on('send-message', async (data) => {
        // data: { sender, receiver, content, fileUrl }
        const { sender, receiver, content, fileUrl } = data;
        const message = new Message({ sender, receiver, content, fileUrl });
        await message.save();
        // Emit to receiver if online
        if (onlineUsers[receiver]) {
            io.to(onlineUsers[receiver]).emit('receive-message', message);
        }
        // Optionally emit to sender for confirmation
        socket.emit('message-sent', message);
    });

    // User disconnects
    socket.on('disconnect', async () => {
        // Remove user from onlineUsers
        const userId = Object.keys(onlineUsers).find(
            key => onlineUsers[key] === socket.id
        );
        if (userId) {
            delete onlineUsers[userId];
            await User.findByIdAndUpdate(userId, { online: false });
        }
        io.emit('online-users', Object.keys(onlineUsers));
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
