const mongoose = require('mongoose');

const accessSchema = new mongoose.Schema({
    phoneNumber: { type: String, unique: true, required: true },
    name: { type: String, required: true },
    addedBy: { type: String, required: true },
    addedAt: { type: Date, default: Date.now }
});

const Access = mongoose.model('Access', accessSchema);

module.exports = Access;
