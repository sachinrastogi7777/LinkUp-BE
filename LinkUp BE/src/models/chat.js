// const mongoose = require('mongoose');

// const messageSchema = new mongoose.Schema({
//     senderId: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'User',
//         required: true
//     },
//     text: {
//         type: String,
//         required: true
//     }
// }, { timestamps: true });

// const chatSchema = new mongoose.Schema({
//     participants: {
//         type: [mongoose.Schema.Types.ObjectId],
//         ref: 'User',
//         required: true
//     },
//     messages: [messageSchema]
// });

// const Chat = mongoose.model('Chat', chatSchema);

// module.exports = { Chat };

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    text: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['sent', 'delivered', 'seen'],
        default: 'sent'
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

const chatSchema = new mongoose.Schema({
    participants: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: 'User',
        required: true
    },
    messages: [messageSchema]
});

const Chat = mongoose.model('Chat', chatSchema);

module.exports = { Chat };