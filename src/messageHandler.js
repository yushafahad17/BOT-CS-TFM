const connectedUsers = new Map();
let io;

function setSocketIO(socketIo) {
    io = socketIo;
}

function addUser(username, socket) {
    connectedUsers.set(username, socket);
    console.log(`User ${username} added to connected users. Total users: ${connectedUsers.size}`);
}

function removeUser(socket) {
    for (const [username, userSocket] of connectedUsers.entries()) {
        if (userSocket === socket) {
            connectedUsers.delete(username);
            console.log(`User ${username} removed from connected users. Total users: ${connectedUsers.size}`);
            return;
        }
    }
}

function sendMessageToUser(username, message) {
    const userSocket = connectedUsers.get(username);
    if (userSocket) {
        userSocket.emit('new message', { sender: 'CS-TFM', message });
        console.log(`Message sent to user ${username}`);
    } else {
        console.log(`User ${username} not found or not connected`);
        io.emit('new message', { sender: 'CS-TFM', username, message });
    }
}

module.exports = {
    setSocketIO,
    addUser,
    removeUser,
    sendMessageToUser
};
