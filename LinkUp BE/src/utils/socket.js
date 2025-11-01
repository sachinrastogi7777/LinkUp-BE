const socket = require('socket.io');
const crypto = require('crypto');
const { Chat } = require('../models/chat');
const User = require('../models/user');

const getSecretRoomId = (loggedInUserId, userId) => {
    return crypto.createHash('sha256').update([loggedInUserId, userId].sort().join('_')).digest('hex');
}

const userSockets = new Map();
const activeChats = new Map();

let io;

const initializeSocket = (server) => {
    io = socket(server, {
        cors: {
            origin: 'http://localhost:5173',
            credentials: true
        }
    });

    io.on('connection', (socket) => {
        socket.on('user-online', async ({ userId }) => {
            try {
                socket.userId = userId;
                userSockets.set(userId, socket.id);

                await User.findByIdAndUpdate(userId, {
                    isOnline: true,
                    lastSeen: new Date()
                });

                io.emit('user-status-changed', {
                    userId,
                    isOnline: true,
                    lastSeen: new Date()
                });

                const chats = await Chat.find({
                    participants: userId
                });

                for (const chat of chats) {
                    let updated = false;
                    const senderUpdates = {};

                    chat.messages.forEach(msg => {
                        if (msg.senderId.toString() !== userId && msg.status === 'sent') {
                            msg.status = 'delivered';
                            msg.deliveredAt = new Date();
                            updated = true;

                            const senderId = msg.senderId.toString();
                            if (!senderUpdates[senderId]) {
                                senderUpdates[senderId] = [];
                            }
                            senderUpdates[senderId].push({
                                messageId: msg._id.toString(),
                                deliveredAt: msg.deliveredAt
                            });
                        }
                    });

                    if (updated) {
                        await chat.save();
                        Object.keys(senderUpdates).forEach(senderId => {
                            const senderSocketId = userSockets.get(senderId);
                            if (senderSocketId) {
                                senderUpdates[senderId].forEach(({ messageId, deliveredAt }) => {
                                    io.to(senderSocketId).emit('message-delivered', {
                                        messageId,
                                        deliveredAt
                                    });
                                });
                            }
                        });
                    }
                }

                // Send unread counts to user after they come online
                const unreadCounts = {};
                for (const chat of chats) {
                    const unreadCount = chat.unreadCount?.get(userId) || 0;
                    if (unreadCount > 0) {
                        const partnerId = chat.participants.find(p => p.toString() !== userId).toString();
                        unreadCounts[partnerId] = unreadCount;
                    }
                }

                socket.emit('unread-counts', { unreadCounts });

            } catch (error) {
                console.error('❌ Error setting user online:', error);
            }
        });

        socket.on('user-offline', async ({ userId }) => {
            try {
                await User.findByIdAndUpdate(userId, {
                    isOnline: false,
                    lastSeen: new Date()
                });
                userSockets.delete(userId);
                activeChats.delete(socket.id);

                io.emit('user-status-changed', {
                    userId,
                    isOnline: false,
                    lastSeen: new Date()
                });
            } catch (error) {
                console.error('❌ Error setting user offline:', error);
            }
        });

        socket.on('joinChat', async ({ loggedInUserId, userId }) => {
            const roomId = getSecretRoomId(loggedInUserId, userId);
            socket.join(roomId);

            activeChats.set(socket.id, {
                userId: loggedInUserId,
                currentChatRoom: roomId,
                chatPartnerId: userId
            });

            try {
                const chat = await Chat.findOne({
                    participants: { $all: [loggedInUserId, userId] }
                });

                if (chat) {
                    let updated = false;
                    const now = new Date();
                    const messageIds = [];

                    chat.messages.forEach(msg => {
                        if (msg.senderId.toString() === userId && msg.status !== 'seen') {
                            msg.status = 'seen';
                            msg.seenAt = now;
                            messageIds.push(msg._id.toString());
                            updated = true;
                        }
                    });

                    // Reset unread count for this user
                    if (chat.unreadCount?.get(loggedInUserId) > 0) {
                        chat.unreadCount.set(loggedInUserId, 0);
                        updated = true;

                        // Notify the user that unread count is reset
                        // socket.emit('unread-count-reset', { partnerId: userId });
                    }

                    if (updated) {
                        await chat.save();

                        io.to(roomId).emit('messages-seen', {
                            messageIds: messageIds,
                            seenAt: now
                        });
                    }
                }
            } catch (error) {
                console.error('❌ Error marking messages as seen:', error);
            }
        });

        socket.on('leaveChat', async ({ loggedInUserId, userId }) => {
            const roomId = getSecretRoomId(loggedInUserId, userId);
            socket.leave(roomId);
            activeChats.delete(socket.id);
        });

        socket.on('sendMessage', async ({ senderId, senderName, receiverId, receiverName, text, imageUrl, messageType, timeStamp }) => {
            try {
                const roomId = getSecretRoomId(senderId, receiverId);
                let chat = await Chat.findOne({
                    participants: { $all: [senderId, receiverId] }
                });
                if (!chat) {
                    chat = new Chat({
                        participants: [senderId, receiverId],
                        messages: [],
                        unreadCount: new Map()
                    });
                }

                const receiverSocketId = userSockets.get(receiverId);
                const isReceiverOnline = !!receiverSocketId;

                let isReceiverInChat = false;
                if (isReceiverOnline) {
                    for (const [socketId, chatInfo] of activeChats.entries()) {
                        if (chatInfo.userId === receiverId && chatInfo.currentChatRoom === roomId) {
                            isReceiverInChat = true;
                            break;
                        }
                    }
                }

                let initialStatus = 'sent';
                let deliveredAt = null;
                let seenAt = null;

                if (isReceiverInChat) {
                    initialStatus = 'seen';
                    deliveredAt = new Date();
                    seenAt = new Date();
                } else if (isReceiverOnline) {
                    initialStatus = 'delivered';
                    deliveredAt = new Date();

                    // Increment unread count for receiver
                    const currentUnread = chat.unreadCount?.get(receiverId) || 0;
                    chat.unreadCount.set(receiverId, currentUnread + 1);
                } else {
                    initialStatus = 'sent';

                    // Increment unread count for receiver (will be delivered when they come online)
                    const currentUnread = chat.unreadCount?.get(receiverId) || 0;
                    chat.unreadCount.set(receiverId, currentUnread + 1);
                }

                const newMessage = {
                    senderId,
                    text: text || '',
                    messageType: messageType || 'text',
                    imageUrl: imageUrl || null,
                    status: initialStatus,
                    deliveredAt: deliveredAt,
                    seenAt: seenAt
                };

                chat.messages.push(newMessage);
                await chat.save();

                const savedMessage = chat.messages[chat.messages.length - 1];

                const messageData = {
                    messageId: savedMessage._id.toString(),
                    senderId,
                    senderName,
                    receiverId,
                    receiverName,
                    text: savedMessage.text,
                    messageType: savedMessage.messageType,
                    imageUrl: savedMessage.imageUrl,
                    timeStamp,
                    createdAt: savedMessage.createdAt,
                    status: savedMessage.status,
                    deliveredAt: savedMessage.deliveredAt,
                    seenAt: savedMessage.seenAt
                };

                io.to(roomId).emit('receiveMessage', messageData);

                // Send unread count update to receiver if they're online but not in chat
                if (isReceiverOnline && !isReceiverInChat) {
                    const unreadCount = chat.unreadCount?.get(receiverId) || 0;
                    io.to(receiverSocketId).emit('unread-count-update', {
                        partnerId: senderId,
                        unreadCount
                    });
                }

            } catch (error) {
                console.error("❌ Error sending message:", error);
                socket.emit('message-error', { error: error.message });
            }
        });

        socket.on('disconnect', async () => {
            activeChats.delete(socket.id);
            if (socket.userId) {
                try {
                    userSockets.delete(socket.userId);
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
                    console.error('❌ Error updating user status on disconnect:', error);
                }
            }
        });

        socket.on('typing', ({ senderId, receiverId, senderName }) => {
            const roomId = getSecretRoomId(senderId, receiverId);
            socket.to(roomId).emit('user-typing', {
                userId: senderId,
                userName: senderName,
                isTyping: true
            });
        });

        socket.on('stop-typing', ({ senderId, receiverId }) => {
            const roomId = getSecretRoomId(senderId, receiverId);
            socket.to(roomId).emit('user-typing', {
                userId: senderId,
                isTyping: false
            });
        });
    });
    return io;
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