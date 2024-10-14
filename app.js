require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const { connectToWhatsApp, sendMessageToOwner, sendMessageToGroup, downloadMediaMessage, getGroups } = require('./src/whatsapp');
const authRoutes = require('./src/routes/auth');
const chatRoutes = require('./src/routes/chat');
require('./src/models/Access'); // Tambahkan ini
const path = require('path');
const messageHandler = require('./src/messageHandler');
const fs = require('fs').promises;

mongoose.set('strictQuery', false);

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
  }
});

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

app.use('/auth', authRoutes);
app.use('/chat', chatRoutes);

// Tambahkan ini di awal file
app.get('/', (req, res) => {
    console.log('Root route accessed');
    res.send('Hello from Yaudah-mas!');
});

// Tambahkan route fallback untuk SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Simpan riwayat chat untuk setiap user
const chatHistory = new Map();

// Pastikan folder uploads ada
const uploadsDir = path.join(__dirname, 'uploads');
fs.mkdir(uploadsDir, { recursive: true }).catch(console.error);

io.on('connection', (socket) => {
    console.log('New client connected');

    socket.on('join', (username) => {
        console.log(`User ${username} joined`);
        messageHandler.addUser(username, socket);

        // Kirim riwayat chat ke user yang baru bergabung
        const userHistory = chatHistory.get(username) || [];
        socket.emit('chat history', userHistory);
    });

    socket.on('chat message', async (data) => {
        console.log('Received message from client:', data);
        try {
            let imagePath = null;
            if (data.image) {
                const imageBuffer = Buffer.from(data.image.split(',')[1], 'base64');
                imagePath = path.join(__dirname, '..', 'uploads', `${Date.now()}.png`);
                await fs.writeFile(imagePath, imageBuffer);
            }

            console.log('Sending message to WhatsApp:', {
                username: data.username,
                message: data.message,
                imagePath: imagePath
            });

            await sendMessageToGroup(data.username, {
                text: data.message,
                image: imagePath ? { url: imagePath } : undefined
            });

            console.log('Message sent to WhatsApp successfully');

            socket.emit('message sent', { success: true });

            // Hapus file gambar setelah dikirim
            if (imagePath) {
                await fs.unlink(imagePath);
            }
        } catch (error) {
            console.error('Error sending message to group:', error);
            socket.emit('message sent', { success: false, error: error.message });
        }
    });

    socket.on('clear chat', (username) => {
        chatHistory.delete(username);
        socket.emit('chat cleared');
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
        messageHandler.removeUser(socket);
    });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

connectToWhatsApp();

function sendMessageToUser(username, message) {
    const userSocket = connectedUsers.get(username);
    if (userSocket) {
        userSocket.emit('new message', { sender: 'CS-TFM', message });
        console.log(`Message sent to user ${username}`);
    } else {
        console.log(`User ${username} not found or not connected`);
    }
}

module.exports = { sendMessageToUser };

// Fungsi untuk menghapus gambar yang telah diproses setelah 1 jam
async function cleanupProcessedImages() {
    const directory = path.join(__dirname, 'processed_images');
    const files = await fs.readdir(directory);
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    for (const file of files) {
        const filePath = path.join(directory, file);
        const stats = await fs.stat(filePath);
        if (now - stats.mtime.getTime() > oneHour) {
            await fs.unlink(filePath);
            console.log(`Deleted old processed image: ${file}`);
        }
    }
}

// Jalankan pembersihan setiap jam
setInterval(cleanupProcessedImages, 60 * 60 * 1000);

app.get('/groups', async (req, res) => {
    try {
        const groups = await getGroups();
        res.json(groups);
    } catch (error) {
        console.error('Error fetching groups:', error);
        res.status(500).json({ error: 'Failed to fetch groups' });
    }
});

app.use((req, res, next) => {
    console.log(`Request received: ${req.method} ${req.url}`);
    next();
});

app.get('/test', (req, res) => {
  res.send('Test endpoint working!');
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).send('Something went wrong!');
});

console.log('Application starting...');
