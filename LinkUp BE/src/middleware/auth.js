const JWT = require('jsonwebtoken');
const User = require('../models/user');

const userAuth = async (req, res, next) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).send("Authentication failed. Please login again.");
        }
        const decoded = JWT.verify(token, "DeVtInDeR@123");
        const user = await User.findById(decoded._id);
        if (!user) {
            throw new Error("User not found.");
        }
        req.user = user;
        next();
    }
    catch (error) {
        res.status(400).send("ERROR : " + error.message);
    }
};

module.exports = userAuth;