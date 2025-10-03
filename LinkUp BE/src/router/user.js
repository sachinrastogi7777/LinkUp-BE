const express = require('express');
const userAuth = require('../middleware/auth');
const ConnectionRequest = require('../models/connectionRequest');

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



module.exports = userRouter;