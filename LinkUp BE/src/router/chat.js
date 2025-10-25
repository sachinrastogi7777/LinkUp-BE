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
})

module.exports = chatRouter;