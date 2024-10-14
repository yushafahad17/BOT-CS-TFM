const express = require('express');
const router = express.Router();
const { Chat } = require('../database');
const { sendMessageToOwner } = require('../whatsapp');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const path = require('path');
const fs = require('fs').promises;

router.get('/history/:username', async (req, res) => {
    const { username } = req.params;
    const chat = await Chat.findOne({ username });
    res.json(chat ? chat.messages : []);
});

router.post('/send', async (req, res) => {
    const { username, message } = req.body;
    console.log(`Received message from ${username}: ${message}`);

    let chat = await Chat.findOne({ username });
    if (!chat) {
        chat = new Chat({ username, status: 'active' });
    } else if (chat.status !== 'active') {
        chat.status = 'active';
    }

    chat.messages.push({ sender: username, message, timestamp: new Date() });
    await chat.save();

    try {
        await sendMessageToOwner(username, message);
        console.log(`Message sent to owner for ${username}`);
        res.sendStatus(200);
    } catch (error) {
        console.error('Error sending message to owner:', error);
        res.status(500).json({ error: 'Failed to send message to owner' });
    }
});

router.post('/end/:username', async (req, res) => {
    const { username } = req.params;
    const chat = await Chat.findOne({ username });
    if (chat) {
        chat.status = 'ended';
        await chat.save();
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

router.delete('/delete/:username', async (req, res) => {
    const { username } = req.params;
    await Chat.deleteOne({ username });
    res.sendStatus(200);
});

router.get('/new-messages/:username', async (req, res) => {
    const { username } = req.params;
    const { since } = req.query;
    const chat = await Chat.findOne({ username });
    
    if (chat) {
        const newMessages = chat.messages.filter(msg => msg.timestamp > since);
        res.json(newMessages);
    } else {
        res.json([]);
    }
});

router.get('/status/:username', async (req, res) => {
    const { username } = req.params;
    const chat = await Chat.findOne({ username });
    res.json({ status: chat ? chat.status : 'not found' });
});

router.post('/upload-image', upload.single('image'), async (req, res) => {
    const { username } = req.body;
    if (!req.file) {
        console.error('No file uploaded');
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const tempPath = req.file.path;
    const targetDir = path.join(__dirname, '..', '..', 'public', 'uploads');
    const targetPath = path.join(targetDir, req.file.filename);

    try {
        // Pastikan direktori target ada
        await fs.mkdir(targetDir, { recursive: true });

        // Pindahkan file dari lokasi temporary ke lokasi target
        await fs.rename(tempPath, targetPath);

        console.log(`File successfully moved to: ${targetPath}`);

        const imageUrl = `/uploads/${req.file.filename}`;
        
        // Kirim pesan ke owner dengan gambar
        await sendMessageToOwner(username, { 
            text: 'User mengirim gambar', 
            image: imageUrl 
        });

        res.json({ success: true, imageUrl });
    } catch (error) {
        console.error('Error handling uploaded file:', error);
        res.status(500).json({ error: 'Failed to process uploaded file' });
    }
});

module.exports = router;
