const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    status: { type: String, enum: ['active', 'ended', 'rejected'], default: 'active' },
    messages: [{
        sender: String,
        message: String,
        timestamp: { type: Date, default: Date.now }
    }]
});

const Chat = mongoose.model('Chat', chatSchema);

module.exports = { Chat };
