const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    text: {
        type: String,
        default: ''
    },
    messageType: {
        type: String,
        enum: ['text', 'image'],
        default: 'text'
    },
    imageUrl: {
        type: String,
        default: null
    },
    status: {
        type: String,
        enum: ['sent', 'delivered', 'seen'],
        default: 'sent',
        index: true
    },
    deliveredAt: {
        type: Date,
        default: null
    },
    seenAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

messageSchema.index({ senderId: 1, createdAt: -1 });
messageSchema.index({ status: 1, createdAt: -1 });

const chatSchema = new mongoose.Schema({
    participants: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: 'User',
        required: true
    },
    messages: [messageSchema],
    unreadCount: {
        type: Map,
        of: Number,
        default: {}
    }
}, { timestamps: true });

chatSchema.index({ participants: 1 });
chatSchema.index({ 'participants.0': 1, 'participants.1': 1 });
chatSchema.index({ updatedAt: -1 });
chatSchema.index({ participants: 1, updatedAt: -1 });

const Chat = mongoose.model('Chat', chatSchema);

module.exports = { Chat };