const express = require('express');
const router = express.Router();
const { Chat } = require('../database');

router.post('/login', async (req, res) => {
    const { username } = req.body;
    try {
        let chat = await Chat.findOne({ username });
        if (!chat) {
            chat = new Chat({ username, status: 'active' });
            await chat.save();
        }
        res.sendStatus(200);
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

module.exports = router;
