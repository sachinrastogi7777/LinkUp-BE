// const express = require('express');
// const { validateSignupData } = require('../utils/validation');
// const User = require('../models/user');
// const validator = require('validator');
// const bcrypt = require('bcrypt');
// const multer = require('multer');
// const { uploadToCloudinary } = require('../utils/helper');
// const JWT = require('jsonwebtoken');
// const passport = require('../config/passport');

// const authRouter = express.Router();

// const upload = multer({
//     storage: multer.memoryStorage(),
//     limits: { fileSize: 5 * 1024 * 1024 },
//     fileFilter: (req, file, cb) => {
//         if (file.mimetype.startsWith('image/')) {
//             cb(null, true);
//         } else {
//             cb(new Error('Only image files are allowed!'), false);
//         }
//     }
// });

// authRouter.post('/upload-image', upload.single('image'), async (req, res) => {
//     try {
//         if (!req.file) {
//             return res.status(400).json({ message: "No image provided" });
//         }
//         const type = req.body.type;
//         const result = await uploadToCloudinary(req.file.buffer, type);

//         res.json({
//             message: "Image uploaded successfully",
//             imageUrl: result.secure_url,
//             publicId: result.public_id
//         });
//     } catch (error) {
//         console.error('Upload failed:', error);
//         res.status(500).json({
//             message: "Upload failed: " + error.message,
//             error: error.http_code || 'UNKNOWN_ERROR'
//         });
//     }
// });

// authRouter.post("/signup", async (req, res) => {
//     try {
//         validateSignupData(req.body);
//         if (req.body.email) {
//             const existingUser = await User.findOne({ email: req.body.email });
//             if (existingUser) {
//                 throw new Error("Email already in use.");
//             }
//         }
//         if (req.body.mobileNumber) {
//             const existingUser = await User.findOne({ mobileNumber: req.body.mobileNumber });
//             if (existingUser) {
//                 throw new Error("Mobile number already in use.");
//             }
//         }
//         const hashedPassword = await bcrypt.hash(req.body.password, 10);
//         const user = new User({
//             firstName: req.body.firstName,
//             lastName: req.body.lastName,
//             email: req.body.email,
//             password: hashedPassword,
//             userName: req.body.userName,
//             dateOfBirth: req.body.dateOfBirth,
//             gender: req.body.gender,
//             mobileNumber: req.body.mobileNumber,
//             interests: req.body.interests,
//             location: req.body.location,
//             profileImage: req.body?.profileImage,
//             coverImage: req.body?.coverImage,
//             about: req.body?.about,
//             authProvider: 'local',
//             isOnline: true,
//             lastSeen: new Date()
//         });
//         const newUserData = await user.save();
//         const token = await user.getJWT();
//         res.cookie("token", token, {
//             expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
//             httpOnly: true,
//             secure: process.env.NODE_ENV === 'production',
//             sameSite: 'lax'
//         });
//         res.json({ message: "User saved successfully...", data: newUserData })
//     } catch (error) {
//         res.status(404).send(error.message);
//     }
// });

// authRouter.post("/login", async (req, res) => {
//     const { email, password } = req.body;
//     try {
//         if (!validator.isEmail(email)) {
//             throw new Error("Please enter valid email.");
//         }
//         const user = await User.findOne({ email });
//         if (!user) {
//             throw new Error("User not found.");
//         }
//         if (user.authProvider !== 'local') {
//             throw new Error(`This account uses ${user.authProvider} login. Please use ${user.authProvider} to sign in.`);
//         }
//         const isPasswordValid = await user.validatePassword(password);
//         if (!isPasswordValid) {
//             throw new Error("Please enter correct password.");
//         }
//         const token = await user.getJWT();
//         res.cookie("token", token, {
//             expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
//             httpOnly: true,
//             secure: process.env.NODE_ENV === 'production',
//             sameSite: 'lax'
//         });

//         user.isOnline = true;
//         user.lastSeen = new Date();
//         await user.save();
//         res.send(user);
//     } catch (error) {
//         res.status(404).send(error.message);
//     }
// });

// authRouter.get('/auth/google',
//     passport.authenticate('google', {
//         scope: ['profile', 'email'],
//         session: false,
//         prompt: 'select_account'
//     })
// );

// authRouter.get('/auth/google/callback',
//     (req, res, next) => {
//         next();
//     },
//     passport.authenticate('google', {
//         session: false,
//         failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=google_auth_failed`
//     }),
//     async (req, res) => {
//         try {
//             if (!req.user) {
//                 throw new Error('No user returned from authentication');
//             }
//             const { user, isNewUser } = req.user;
//             const token = await user.getJWT();
//             res.cookie("token", token, {
//                 expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
//                 httpOnly: true,
//                 secure: process.env.NODE_ENV === 'production',
//                 sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
//                 path: '/'
//             });

//             const frontendUrl = process.env.FRONTEND_URL;
//             const redirectUrl = `${frontendUrl}/auth/callback?success=true&newUser=${isNewUser}`;

//             res.redirect(redirectUrl);
//         } catch (error) {
//             const frontendUrl = process.env.FRONTEND_URL;
//             res.redirect(`${frontendUrl}/login?error=token_generation_failed`);
//         }
//     }
// );

// // Heartbeat endpoint - keeps user online
// authRouter.post('/heartbeat', async (req, res) => {
//     try {
//         const token = req.cookies.token;
//         if (!token) {
//             return res.status(401).json({ error: 'Not authenticated' });
//         }

//         const decoded = JWT.verify(token, process.env.JWT_SECRET);
//         const userId = decoded._id;

//         await User.findByIdAndUpdate(userId, {
//             isOnline: true,
//             lastSeen: new Date()
//         });

//         res.status(200).json({ success: true });
//     } catch (error) {
//         console.error('Heartbeat error:', error);
//         res.status(500).json({ error: 'Failed to update status' });
//     }
// });

// // Offline endpoint - called when page closes
// authRouter.post('/offline', async (req, res) => {
//     try {
//         const token = req.cookies.token;
//         if (!token) {
//             // Don't return error, just silently fail for beacon requests
//             return res.status(200).json({ success: false });
//         }

//         const decoded = JWT.verify(token, process.env.JWT_SECRET);
//         const userId = decoded._id;

//         await User.findByIdAndUpdate(userId, {
//             isOnline: false,
//             lastSeen: new Date()
//         });

//         res.status(200).json({ success: true });
//     } catch (error) {
//         console.error('Offline status error:', error);
//         // Return 200 even on error to prevent browser retries
//         res.status(200).json({ success: false });
//     }
// });

// authRouter.post('/logout', async (req, res) => {
//     try {
//         const token = req.cookies.token;
//         if (token) {
//             const decoded = JWT.verify(token, process.env.JWT_SECRET);
//             const userId = decoded._id;
//             await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() });
//         }
//         res.clearCookie('token');
//         res.status(200).json({ message: "Logout successful." });
//     } catch (error) {
//         console.error('Error during logout:', error);
//         res.clearCookie('token');
//         res.status(200).json({ message: "Logout successful." });
//     }
// });

// module.exports = authRouter;



const express = require('express');
const { validateSignupData } = require('../utils/validation');
const User = require('../models/user');
const validator = require('validator');
const bcrypt = require('bcrypt');
const multer = require('multer');
const { uploadToCloudinary } = require('../utils/helper');
const JWT = require('jsonwebtoken');
const passport = require('../config/passport');

const authRouter = express.Router();

// Cookie configuration helper
const getCookieConfig = () => {
    const isProduction = process.env.NODE_ENV === 'production';
    return {
        httpOnly: true,
        secure: isProduction, // true in production (HTTPS)
        sameSite: isProduction ? 'none' : 'lax', // 'none' for cross-site in production
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/'
    };
};

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
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
            authProvider: 'local',
            isOnline: true,
            lastSeen: new Date()
        });
        const newUserData = await user.save();
        const token = await user.getJWT();
        res.cookie("token", token, getCookieConfig());
        res.json({ message: "User saved successfully...", data: newUserData })
    } catch (error) {
        res.status(404).send(error.message);
    }
});

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
        if (user.authProvider !== 'local') {
            throw new Error(`This account uses ${user.authProvider} login. Please use ${user.authProvider} to sign in.`);
        }
        const isPasswordValid = await user.validatePassword(password);
        if (!isPasswordValid) {
            throw new Error("Please enter correct password.");
        }
        const token = await user.getJWT();
        res.cookie("token", token, getCookieConfig());

        user.isOnline = true;
        user.lastSeen = new Date();
        await user.save();
        res.send(user);
    } catch (error) {
        res.status(404).send(error.message);
    }
});

// Google OAuth - Initiate
authRouter.get('/auth/google',
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        session: false,
        prompt: 'select_account'
    })
);

// Google OAuth - Callback
authRouter.get('/auth/google/callback',
    (req, res, next) => {
        console.log('📍 OAuth callback hit');
        console.log('Query params:', req.query);
        console.log('Environment:', process.env.NODE_ENV);
        next();
    },
    passport.authenticate('google', {
        session: false,
        failureRedirect: `${process.env.FRONTEND_URL}/login?error=google_auth_failed`
    }),
    async (req, res) => {
        try {
            console.log('✓ Passport authentication successful');
            
            if (!req.user) {
                console.error('✗ No user object in request');
                throw new Error('No user returned from authentication');
            }

            const { user, isNewUser } = req.user;
            console.log('✓ User authenticated:', user.email, '| New user:', isNewUser);

            // Generate token
            const token = await user.getJWT();
            console.log('✓ JWT token generated');

            // Set cookie with production-ready configuration
            res.cookie("token", token, getCookieConfig());
            console.log('✓ Cookie set with config:', getCookieConfig());

            // Construct redirect URL
            const frontendUrl = process.env.FRONTEND_URL;
            const redirectUrl = `${frontendUrl}/auth/callback?success=true&newUser=${isNewUser}`;
            
            console.log('✓ Redirecting to:', redirectUrl);
            res.redirect(redirectUrl);

        } catch (error) {
            console.error('✗ OAuth callback error:', error);
            const frontendUrl = process.env.FRONTEND_URL;
            res.redirect(`${frontendUrl}/login?error=token_generation_failed`);
        }
    }
);

// Heartbeat endpoint
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

// Offline endpoint
authRouter.post('/offline', async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) {
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
        res.clearCookie('token', {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
        });
        res.status(200).json({ message: "Logout successful." });
    } catch (error) {
        console.error('Error during logout:', error);
        res.clearCookie('token', {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
        });
        res.status(200).json({ message: "Logout successful." });
    }
});

module.exports = authRouter;