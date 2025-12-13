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
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const skip = (page - 1) * limit;

        const totalConnections = await ConnectionRequest.countDocuments({
            $or: [
                { fromUserId: userId, status: 'accepted' },
                { toUserId: userId, status: 'accepted' }
            ]
        });

        const totalConnection = await ConnectionRequest.find({
            $or: [
                { fromUserId: userId, status: 'accepted' },
                { toUserId: userId, status: 'accepted' }
            ]
        })
            .populate('fromUserId', USER_SAFE_DATA)
            .populate('toUserId', USER_SAFE_DATA)
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(limit);

        const userConnectionWithUnreadMessages = await Promise.all(totalConnection.map(async (connection) => {
            const partnerId = connection.fromUserId._id.equals(userId) ? connection.toUserId._id : connection.fromUserId._id;
            const partnerUserData = connection.fromUserId._id.equals(userId) ? connection.toUserId : connection.fromUserId;

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
            res.json({
                message: "You Don't have any Connection.",
                userConnection: [],
                pagination: {
                    currentPage: page,
                    totalPages: 0,
                    totalConnections: 0,
                    hasNextPage: false,
                    hasPrevPage: false
                }
            });
            return;
        }

        res.json({
            userConnection: userConnectionWithUnreadMessages,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalConnections / limit),
                totalConnections: totalConnections,
                hasNextPage: page < Math.ceil(totalConnections / limit),
                hasPrevPage: page > 1,
                limit: limit
            }
        });
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
});

userRouter.post('/user/mutualConnections/batch', userAuth, async (req, res) => {
    try {
        const loggedInUserId = req.user._id;
        const { userIds } = req.body;

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ message: "userIds array is required" });
        }

        if (userIds.length > 1000) {
            return res.status(400).json({ message: "Maximum 1000 userIds allowed per request" });
        }

        const loggedInUserConnections = await ConnectionRequest.find({
            $or: [
                { fromUserId: loggedInUserId, status: 'accepted' },
                { toUserId: loggedInUserId, status: 'accepted' }
            ]
        }).select('fromUserId toUserId').lean();

        const loggedInUserConnectionIds = new Set();
        loggedInUserConnections.forEach(connection => {
            const connectionId = connection.fromUserId.equals(loggedInUserId)
                ? connection.toUserId.toString()
                : connection.fromUserId.toString();
            loggedInUserConnectionIds.add(connectionId);
        });

        const allTargetConnections = await ConnectionRequest.find({
            $or: [
                { fromUserId: { $in: userIds }, status: 'accepted' },
                { toUserId: { $in: userIds }, status: 'accepted' }
            ]
        }).select('fromUserId toUserId').lean();

        const userConnectionsMap = {};
        userIds.forEach(userId => {
            userConnectionsMap[userId] = new Set();
        });

        allTargetConnections.forEach(connection => {
            const fromId = connection.fromUserId.toString();
            const toId = connection.toUserId.toString();

            if (userConnectionsMap[fromId]) {
                userConnectionsMap[fromId].add(toId);
            }
            if (userConnectionsMap[toId]) {
                userConnectionsMap[toId].add(fromId);
            }
        });

        const mutualConnectionsCount = {};
        userIds.forEach(userId => {
            const userIdStr = userId.toString();
            const targetUserConnections = userConnectionsMap[userIdStr] || new Set();

            let count = 0;
            targetUserConnections.forEach(connectionId => {
                if (loggedInUserConnectionIds.has(connectionId)) {
                    count++;
                }
            });

            mutualConnectionsCount[userIdStr] = count;
        });

        res.json({
            mutualConnections: mutualConnectionsCount
        });

    } catch (error) {
        res.status(500).json({ "ERROR": error.message });
    }
});

userRouter.get('/user/mutualConnections/:userId', userAuth, async (req, res) => {
    const USER_SAFE_DATA = ['firstName', 'lastName', 'gender', 'dateOfBirth', 'interests', 'about', 'profileImage', 'location', 'userName', 'coverImage', 'createdAt', 'updatedAt'];

    try {
        const loggedInUserId = req.user._id;
        const targetUserId = req.params.userId;

        const targetUser = await User.findById(targetUserId);
        if (!targetUser) {
            return res.status(404).json({ message: "User not found." });
        }

        const loggedInUserConnections = await ConnectionRequest.find({
            $or: [
                { fromUserId: loggedInUserId, status: 'accepted' },
                { toUserId: loggedInUserId, status: 'accepted' }
            ]
        }).lean();

        const loggedInUserConnectionIds = new Set();
        loggedInUserConnections.forEach(connection => {
            const connectionId = connection.fromUserId.equals(loggedInUserId)
                ? connection.toUserId.toString()
                : connection.fromUserId.toString();
            loggedInUserConnectionIds.add(connectionId);
        });

        const targetUserConnections = await ConnectionRequest.find({
            $or: [
                { fromUserId: targetUserId, status: 'accepted' },
                { toUserId: targetUserId, status: 'accepted' }
            ]
        }).lean();

        const targetUserConnectionIds = new Set();
        targetUserConnections.forEach(connection => {
            const connectionId = connection.fromUserId.equals(targetUserId)
                ? connection.toUserId.toString()
                : connection.fromUserId.toString();
            targetUserConnectionIds.add(connectionId);
        });

        const mutualConnectionIds = [...loggedInUserConnectionIds].filter(id =>
            targetUserConnectionIds.has(id)
        );

        if (mutualConnectionIds.length === 0) {
            return res.json({
                message: "No mutual connections found.",
                count: 0,
                mutualConnections: []
            });
        }

        const mutualConnections = await User.find({
            _id: { $in: mutualConnectionIds }
        }).select(USER_SAFE_DATA);

        res.json({
            message: "Mutual connections retrieved successfully.",
            count: mutualConnections.length,
            mutualConnections: mutualConnections
        });

    } catch (error) {
        res.status(500).json({ "ERROR": error.message });
    }
});

userRouter.get('/user/mutualConnectionsCount/:userId', userAuth, async (req, res) => {
    try {
        const loggedInUserId = req.user._id;
        const targetUserId = req.params.userId;

        const loggedInUserConnections = await ConnectionRequest.find({
            $or: [
                { fromUserId: loggedInUserId, status: 'accepted' },
                { toUserId: loggedInUserId, status: 'accepted' }
            ]
        }).select('fromUserId toUserId').lean();

        const loggedInUserConnectionIds = new Set();
        loggedInUserConnections.forEach(connection => {
            const connectionId = connection.fromUserId.equals(loggedInUserId)
                ? connection.toUserId.toString()
                : connection.fromUserId.toString();
            loggedInUserConnectionIds.add(connectionId);
        });

        const targetUserConnections = await ConnectionRequest.find({
            $or: [
                { fromUserId: targetUserId, status: 'accepted' },
                { toUserId: targetUserId, status: 'accepted' }
            ]
        }).select('fromUserId toUserId').lean();

        const targetUserConnectionIds = new Set();
        targetUserConnections.forEach(connection => {
            const connectionId = connection.fromUserId.equals(targetUserId)
                ? connection.toUserId.toString()
                : connection.fromUserId.toString();
            targetUserConnectionIds.add(connectionId);
        });

        const mutualCount = [...loggedInUserConnectionIds].filter(id =>
            targetUserConnectionIds.has(id)
        ).length;

        res.json({
            mutualConnectionsCount: mutualCount
        });

    } catch (error) {
        res.status(500).json({ "ERROR": error.message });
    }
});

module.exports = userRouter;