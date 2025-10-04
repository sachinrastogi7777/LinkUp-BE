const express = require('express');
const userAuth = require('../middleware/auth');
const ConnectionRequest = require('../models/connectionRequest');
const User = require('../models/user');

const userRouter = express.Router();

userRouter.get('/user/requests/received', userAuth, async (req, res) => {
    const SAFE_DATA = ['firstName', 'lastName', 'interests', 'about', 'profileImage', 'location', 'userName', 'createdAt']
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
    const SAFE_DATA = ['firstName', 'lastName', 'interests', 'about', 'profileImage', 'location', 'userName', 'createdAt', 'updatedAt', 'dateOfBirth', 'gender', 'coverImage', '_id']
    try {
        const loggedInUser = req.user;
        const totalRequestSent = await ConnectionRequest.find({
            fromUserId: loggedInUser._id,
            status: 'interested'
        }).populate('toUserId', SAFE_DATA)
        res.json({ totalRequestSent });
    } catch (error) {
        res.status(500).json({ "ERROR": error.message });
    }
});

userRouter.get('/user/connections', userAuth, async (req, res) => {
    const USER_SAFE_DATA = ['firstName', 'lastName', 'gender', 'dateOfBirth', 'interests', 'about', 'profileImage', 'location', 'userName', 'coverImage', 'createdAt', 'updatedAt']
    try {
        const loggedInUser = req.user;
        const totalConnection = await ConnectionRequest.find({
            $or: [
                { fromUserId: loggedInUser._id, status: 'accepted' },
                { toUserId: loggedInUser._id, status: 'accepted' }
            ]
        }).populate('fromUserId', SAFE_DATA).populate('toUserId', USER_SAFE_DATA);

        const userConnection = totalConnection.map((connection) => {
            if (connection.fromUserId.equals(loggedInUser._id)) {
                return { connectionId: connection._id, connectedAt: connection.updatedAt, user: connection.toUserId }
            } else {
                return { connectionId: connection._id, connectedAt: connection.updatedAt, user: connection.fromUserId }
            }
        });
        if (userConnection.length == 0) {
            res.json({ message: "You Don't have any Connection." })
            return
        }
        res.json({ userConnection });
    } catch (error) {
        res.status(500).json({ "ERROR": error.message });
    }
});

userRouter.get('/feed', userAuth, async (req, res) => {
    const SAFE_DATA = ['firstName', 'lastName', 'interests', 'about', 'profileImage', 'location', 'userName', 'createdAt']
    try {
        const loggedInUser = req.user;
        const page = parseInt(req.query.page) || 1;
        let limit = parseInt(req.query.limit) || 10;
        limit = limit > 25 ? 25 : limit;
        const skip = (page - 1) * limit;

        // Find all connection requests (Sent + Recieved)
        const connectionRequest = await ConnectionRequest.find({
            $or: [
                { fromUserId: loggedInUser._id },
                { toUserId: loggedInUser._id }
            ]
        }).select(['fromUserId', 'toUserId']);

        const hideUserFromFeed = new Set();
        connectionRequest.map((connection) => {
            hideUserFromFeed.add(connection.fromUserId.toString());
            hideUserFromFeed.add(connection.toUserId.toString());
        });

        const userToShowOnFeed = await User.find({
            $and: [
                { _id: { $nin: Array.from(hideUserFromFeed) } },
                { _id: { $ne: loggedInUser._id } }
            ]
        }).select(SAFE_DATA).skip(skip).limit(limit);
        res.json({ data: userToShowOnFeed })
    } catch (error) {
        res.status(500).json({ "ERROR": error.message });
    }
})

module.exports = userRouter;