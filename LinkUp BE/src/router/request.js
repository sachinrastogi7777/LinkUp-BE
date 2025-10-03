const express = require('express');
const ConnectionRequest = require('../models/connectionRequest');
const User = require('../models/user');
const userAuth = require('../middleware/auth');

const requestRouter = express.Router();

requestRouter.post('/request/send/:status/:toUserId', userAuth, async (req, res) => {
    try {
        const fromUserId = req.user._id;
        const toUserId = req.params.toUserId;
        const status = req.params.status;

        // Validate Status.
        const allowedStatus = ['interested', 'ignored']
        if (!allowedStatus.includes(status)) {
            throw new Error("Invalid status for connection request. Allowed statuses are 'interested' and 'ignored'.")
        }

        // Check fromUserId is different from toUserId.
        if (fromUserId.equals(toUserId)) {
            throw new Error("You cannot send a connection request to yourself.")
        }

        // Check toUserId exists in our DB.
        const toUser = await User.findById(toUserId);
        if (!toUser) {
            throw new Error("The user you are trying to connect with does not exist.")
        }

        // Check if there are no existing connection request between these two users.
        const existingConnectionRequest = await ConnectionRequest.findOne({
            $or: [
                { fromUserId, toUserId },
                { fromUserId: toUserId, toUserId: fromUserId }
            ]
        });
        if (existingConnectionRequest) {
            throw new Error("Already Connection Request exists!!!")
        }

        const connectionRequest = new ConnectionRequest({
            fromUserId,
            toUserId,
            status
        });

        const savedRequest = await connectionRequest.save();
        res.json({ message: status === 'interested' ? `${req.user.firstName + " " + req.user.lastName} is ${status} in ${toUser.firstName + " " + toUser.lastName}.` : `${req.user.firstName + " " + req.user.lastName} ${status} ${toUser.firstName + " " + toUser.lastName}.`, data: savedRequest });
    } catch (error) {
        res.status(404).send("ERROR : " + error.message);
    }
});

module.exports = requestRouter;