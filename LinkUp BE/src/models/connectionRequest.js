const mongoose = require('mongoose');

const connectionRequestSchema = new mongoose.Schema({
    fromUserId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    toUserId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    status: {
        type: String,
        enum: {
            values: ['ignored', 'interested', 'accepted', 'rejected'],
            message: '{VALUE} is not a valid status for connection request.'
        },
        required: true
    },
    lastNotificationSent: {
        type: Date,
        default: null
    },
    notificationCount: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

// Ensure a user cannot send multiple requests to the same user. This is compound unique index.
connectionRequestSchema.index({ fromUserId: 1, toUserId: 1 }, { unique: true });
connectionRequestSchema.index({ status: 1, lastNotificationSent: 1 });

const ConnectionRequest = mongoose.model('ConnectionRequest', connectionRequestSchema);
module.exports = ConnectionRequest;