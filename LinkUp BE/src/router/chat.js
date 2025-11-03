const express = require('express');
const userAuth = require('../middleware/auth');
const { Chat } = require('../models/chat');

const chatRouter = express.Router();

chatRouter.get('/chat/:userId', userAuth, async (req, res) => {
    try {
        const senderId = req.user._id;
        const receiverId = req.params.userId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        let chat = await Chat.findOne({
            participants: { $all: [senderId, receiverId] }
        }).populate({
            path: 'messages.senderId',
            select: 'firstName lastName'
        });
        if (!chat) {
            chat = new Chat({
                participants: [senderId, receiverId],
                messages: []
            });
            await chat.save();
        }

        const totalMessages = chat.messages.length;
        const totalPages = Math.ceil(totalMessages / limit);
        const skip = (page - 1) * limit;

        const paginatedMessages = chat.messages
            .slice()
            .reverse() // Reverse to get newest first
            .slice(skip, skip + limit)
            .reverse(); // Reverse back to chronological order

        res.status(200).json({
            messages: paginatedMessages,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalMessages: totalMessages,
                hasMore: page < totalPages,
                limit: limit
            }
        });
    } catch (error) {
        console.error("Error fetching chat:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

chatRouter.get('/chats', userAuth, async (req, res) => {
    try {
        const userId = req.user._id;

        // Find chats where the logged-in user is a participant, sort by recent activity
        const chats = await Chat.find({ participants: userId })
            .sort({ updatedAt: -1 })
            .populate({
                path: 'participants',
                select: 'firstName lastName profileImage isOnline lastSeen'
            })
            .populate({
                path: 'messages.senderId',
                select: 'firstName lastName profileImage'
            });

        const result = chats.map(chat => {
            const others = (chat.participants || []).filter(p => String(p._id) !== String(userId));
            const lastMessage = (chat.messages && chat.messages.length) ? chat.messages[chat.messages.length - 1] : null;

            let unread = 0;
            if (chat.unreadCount) {
                if (typeof chat.unreadCount.get === 'function') {
                    unread = chat.unreadCount.get(String(userId)) || 0;
                } else {
                    unread = chat.unreadCount[String(userId)] || chat.unreadCount[userId] || 0;
                }
            }

            return {
                chatId: chat._id,
                participants: others,
                lastMessage,
                unreadCount: unread,
                updatedAt: chat.updatedAt,
                createdAt: chat.createdAt
            };
        });

        res.status(200).json({ chats: result });
    } catch (error) {
        console.error('Error fetching user chats:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = chatRouter;