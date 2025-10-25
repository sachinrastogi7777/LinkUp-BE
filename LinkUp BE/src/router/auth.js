const express = require('express');
const { validateSignupData } = require('../utils/validation');
const User = require('../models/user');
const validator = require('validator');
const bcrypt = require('bcrypt');
const multer = require('multer');
const { uploadToCloudinary } = require('../utils/helper');
const JWT = require('jsonwebtoken');

const authRouter = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

authRouter.post('/upload-image', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No image provided" });
        }
        const type = req.body.type;
        const result = await uploadToCloudinary(req.file.buffer, type);

        res.json({
            message: "Image uploaded successfully",
            imageUrl: result.secure_url,
            publicId: result.public_id
        });
    } catch (error) {
        console.error('Upload failed:', error);
        res.status(500).json({
            message: "Upload failed: " + error.message,
            error: error.http_code || 'UNKNOWN_ERROR'
        });
    }
});

authRouter.post("/signup", async (req, res) => {
    try {
        validateSignupData(req.body);
        if (req.body.email) {
            const existingUser = await User.findOne({ email: req.body.email });
            if (existingUser) {
                throw new Error("Email already in use.");
            }
        }
        if (req.body.mobileNumber) {
            const existingUser = await User.findOne({ mobileNumber: req.body.mobileNumber });
            if (existingUser) {
                throw new Error("Mobile number already in use.");
            }
        }
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        const user = new User({
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            email: req.body.email,
            password: hashedPassword,
            userName: req.body.userName,
            dateOfBirth: req.body.dateOfBirth,
            gender: req.body.gender,
            mobileNumber: req.body.mobileNumber,
            interests: req.body.interests,
            location: req.body.location,
            profileImage: req.body?.profileImage,
            coverImage: req.body?.coverImage,
            about: req.body?.about,
            isOnline: true,
            lastSeen: new Date()
        });
        const newUserData = await user.save();
        const token = await user.getJWT();
        res.cookie("token", token, { expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) });
        res.json({ message: "User saved successfully...", data: newUserData })
    } catch (error) {
        res.status(404).send(error.message);
    }
})

authRouter.post("/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        if (!validator.isEmail(email)) {
            throw new Error("Please enter valid email.");
        }
        const user = await User.findOne({ email });
        if (!user) {
            throw new Error("User not found.");
        }
        const isPasswordValid = await user.validatePassword(password);
        if (!isPasswordValid) {
            throw new Error("Please enter correct password.");
        }
        const token = await user.getJWT();
        res.cookie("token", token, { expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) });

        user.isOnline = true;
        user.lastSeen = new Date();
        await user.save();
        res.send(user);
    } catch (error) {
        res.status(404).send(error.message);
    }
});

// Heartbeat endpoint - keeps user online
authRouter.post('/heartbeat', async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const decoded = JWT.verify(token, process.env.JWT_SECRET);
        const userId = decoded._id;

        await User.findByIdAndUpdate(userId, {
            isOnline: true,
            lastSeen: new Date()
        });

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Heartbeat error:', error);
        res.status(500).json({ error: 'Failed to update status' });
    }
});

// Offline endpoint - called when page closes
authRouter.post('/offline', async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            // Don't return error, just silently fail for beacon requests
            return res.status(200).json({ success: false });
        }

        const decoded = JWT.verify(token, process.env.JWT_SECRET);
        const userId = decoded._id;

        await User.findByIdAndUpdate(userId, {
            isOnline: false,
            lastSeen: new Date()
        });

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Offline status error:', error);
        // Return 200 even on error to prevent browser retries
        res.status(200).json({ success: false });
    }
});

authRouter.post('/logout', async (req, res) => {
    try {
        const token = req.cookies.token;
        if (token) {
            const decoded = JWT.verify(token, process.env.JWT_SECRET);
            const userId = decoded._id;
            await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() });
        }
        res.clearCookie('token');
        res.status(200).json({ message: "Logout successful." });
    } catch (error) {
        console.error('Error during logout:', error);
        res.clearCookie('token');
        res.status(200).json({ message: "Logout successful." });
    }
});

module.exports = authRouter;