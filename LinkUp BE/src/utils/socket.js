const socket = require('socket.io');
const crypto = require('crypto');
const { Chat } = require('../models/chat');
const User = require('../models/user');

const getSecretRoomId = (loggedInUserId, userId) => {
    return crypto.createHash('sha256').update([loggedInUserId, userId].sort().join('_')).digest('hex');
}

const initializeSocket = (server) => {
    const io = socket(server, {
        cors: {
            origin: 'http://localhost:5173'
        }
    });

    io.on('connection', (socket) => {
        socket.on('user-online', async ({ userId }) => {
            try {
                socket.userId = userId;
                await User.findByIdAndUpdate(userId, {
                    isOnline: true,
                    lastSeen: new Date()
                });
                io.emit('user-status-changed', {
                    userId,
                    isOnline: true,
                    lastSeen: new Date()
                });
            } catch (error) {
                console.error('Error setting user online:', error);
            }
        });

        socket.on('user-offline', async ({ userId }) => {
            try {
                await User.findByIdAndUpdate(userId, {
                    isOnline: false,
                    lastSeen: new Date()
                });
                io.emit('user-status-changed', {
                    userId,
                    isOnline: false,
                    lastSeen: new Date()
                });
            } catch (error) {
                console.error('Error setting user offline:', error);
            }
        });

        socket.on('joinChat', ({ loggedInUserId, userId }) => {
            const roomId = getSecretRoomId(loggedInUserId, userId);
            socket.join(roomId);
        });

        socket.on('sendMessage', async ({ senderId, senderName, receiverId, receiverName, text, timeStamp }) => {
            try {
                const roomId = getSecretRoomId(senderId, receiverId);
                let chat = await Chat.findOne({
                    participants: { $all: [senderId, receiverId] }
                });
                if (!chat) {
                    chat = new Chat({
                        participants: [senderId, receiverId],
                        messages: []
                    })
                }
                chat.messages.push({ senderId, text });
                await chat.save();

                const lastMessage = chat.messages[chat.messages.length - 1];
                io.to(roomId).emit('receiveMessage', {
                    senderId,
                    senderName,
                    receiverId,
                    receiverName,
                    text,
                    timeStamp,
                    createdAt: lastMessage.createdAt
                });
            } catch (error) {
                console.error("Error emitting message:", error);
            }
        });

        // socket.on('disconnect', () => { });
        socket.on('disconnect', async () => {
            if (socket.userId) {
                try {
                    await User.findByIdAndUpdate(socket.userId, {
                        isOnline: false,
                        lastSeen: new Date()
                    });
                    io.emit('user-status-changed', {
                        userId: socket.userId,
                        isOnline: false,
                        lastSeen: new Date()
                    });
                } catch (error) {
                    console.error('Error updating user status on disconnect:', error);
                }
            }
        })
    });
};

const emitUserStatusChange = (userId, isOnline) => {
    if (io) {
        io.emit('user-status-changed', {
            userId,
            isOnline,
            lastSeen: new Date()
        });
    }
};

module.exports = { initializeSocket, emitUserStatusChange };