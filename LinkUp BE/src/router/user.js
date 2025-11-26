const express = require('express');
const userAuth = require('../middleware/auth');
const ConnectionRequest = require('../models/connectionRequest');
const User = require('../models/user');
const { connection } = require('mongoose');
const { Chat } = require('../models/chat');

const userRouter = express.Router();

const optionalAuth = async (req, res, next) => {
    try {
        const JWT = require('jsonwebtoken');
        const User = require('../models/user');
        
        const token = req.cookies?.token;
        if (!token) {
            req.user = null;
            return next();
        }
        
        const decoded = JWT.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded._id);
        
        if (!user) {
            req.user = null;
            return next();
        }
        
        req.user = user;
        next();
    } catch (error) {
        req.user = null;
        next();
    }
};

userRouter.get('/user/requests/received', userAuth, async (req, res) => {
    const SAFE_DATA = ['firstName', 'lastName', 'interests', 'about', 'profileImage', 'location', 'userName', 'createdAt', 'updatedAt', 'dateOfBirth', 'gender', 'coverImage']
    try {
        const loggedInUser = req.user;
        const totalRequestReceived = await ConnectionRequest.find({
            toUserId: loggedInUser._id,
            status: 'interested'
        }).populate('fromUserId', SAFE_DATA);
        if (!totalRequestReceived) {
            throw new Error("You don't have any pending request for approval.")
        }
        res.json({ data: totalRequestReceived })
    } catch (error) {
        res.status(500).json({ "ERROR": error.message });
    }
});

userRouter.get('/user/requests/sent', userAuth, async (req, res) => {
    const SAFE_DATA = ['firstName', 'lastName', 'interests', 'about', 'profileImage', 'location', 'userName', 'createdAt', 'updatedAt', 'dateOfBirth', 'gender', 'coverImage']
    try {
        const loggedInUser = req.user;
        const totalRequestSent = await ConnectionRequest.find({
            fromUserId: loggedInUser._id,
            status: 'interested'
        }).populate('toUserId', SAFE_DATA)
        res.json({ data: totalRequestSent });
    } catch (error) {
        res.status(500).json({ "ERROR": error.message });
    }
});

userRouter.get('/user/connections/:userId', userAuth, async (req, res) => {
    const USER_SAFE_DATA = ['firstName', 'lastName', 'gender', 'dateOfBirth', 'interests', 'about', 'profileImage', 'location', 'userName', 'coverImage', 'createdAt', 'updatedAt', 'isOnline', 'lastSeen'];
    try {
        const userId = req.params.userId;
        const totalConnection = await ConnectionRequest.find({
            $or: [
                { fromUserId: userId, status: 'accepted' },
                { toUserId: userId, status: 'accepted' }
            ]
        }).populate('fromUserId', USER_SAFE_DATA).populate('toUserId', USER_SAFE_DATA);

        const userConnectionWithUnreadMessages = await Promise.all(totalConnection.map(async (connection) => {
            const partnerId = connection.fromUserId._id.equals(userId) ? connection.toUserId._id : connection.fromUserId._id;
            const partnerUserData = connection.fromUserId._id.equals(userId) ? connection.toUserId : connection.fromUserId;

            // Count unread messages from Chat model
            const chat = await Chat.findOne({
                participants: { $all: [userId, partnerId] }
            });

            const unreadMessageCount = chat?.unreadCount?.get(userId.toString()) || 0;

            return {
                connectionId: connection._id,
                connectedAt: connection.updatedAt,
                user: partnerUserData,
                unreadCount: unreadMessageCount
            };
        }));

        if (userConnectionWithUnreadMessages.length == 0) {
            res.json({ message: "You Don't have any Connection." })
            return
        }
        res.json({ userConnection: userConnectionWithUnreadMessages });
    } catch (error) {
        res.status(500).json({ "ERROR": error.message });
    }
});

userRouter.get('/feed', optionalAuth, async (req, res) => {
    const SAFE_DATA = ['firstName', 'lastName', 'interests', 'about', 'profileImage', 'location', 'userName', 'createdAt', 'dateOfBirth', 'gender', 'coverImage']
    try {
        const page = parseInt(req.query.page) || 1;
        let limit = parseInt(req.query.limit) || 10;
        limit = limit > 25 ? 25 : limit;
        const skip = (page - 1) * limit;

        let hideUserFromFeed = new Set();

        if (req.user) {
            const connectionRequest = await ConnectionRequest.find({
                $or: [
                    { fromUserId: req.user._id },
                    { toUserId: req.user._id }
                ]
            }).select(['fromUserId', 'toUserId']);

            connectionRequest.map((connection) => {
                hideUserFromFeed.add(connection.fromUserId.toString());
                hideUserFromFeed.add(connection.toUserId.toString());
            });
        }

        const query = {
            _id: { $nin: Array.from(hideUserFromFeed) }
        };

        if (req.user) {
            query._id.$ne = req.user._id;
        }

        const userToShowOnFeed = await User.find(query)
            .select(SAFE_DATA)
            .skip(skip)
            .limit(limit);

        res.json({ data: userToShowOnFeed })
    } catch (error) {
        res.status(500).json({ "ERROR": error.message });
    }
});

userRouter.get('/isUserConnected/:userId', userAuth, async (req, res) => {
    try {
        const senderId = req.user._id;
        const receiverId = req.params.userId;
        const isUserConnected = await ConnectionRequest.findOne({
            $or: [
                { fromUserId: senderId, toUserId: receiverId, status: 'accepted' },
                { fromUserId: receiverId, toUserId: senderId, status: 'accepted' }
            ]
        });
        if (!isUserConnected) {
            return res.status(200).json({ message: "You are not connected with this user." });
        }
        return res.status(200).json({ message: "You are connected with this user." });
    } catch (error) {
        res.status(500).json({ "ERROR": error.message });
    }
});

userRouter.delete('/removeConnection/:connectionId', userAuth, async (req, res) => {
    try {
        const connectionId = req.params.connectionId;
        const connectionRequest = await ConnectionRequest.findOneAndDelete({
            _id: connectionId,
            status: 'accepted'
        });
        if (!connectionRequest) {
            throw new Error("No connection found to delete.")
        }
        res.json({ message: "Connection has been deleted successfully!!!." })
    } catch (error) {
        res.status(500).json({ "Error while removing connection ": error.message })
    }
})

module.exports = userRouter;