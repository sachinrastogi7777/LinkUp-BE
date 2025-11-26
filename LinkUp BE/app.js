// require('dotenv').config();
// const express = require('express');
// const connectDb = require('./src/config/database');
// const cookieParser = require('cookie-parser');
// const cors = require('cors');
// const http = require('http');
// const mongoose = require('mongoose');
// const { initializeSocket } = require('./src/utils/socket');
// const authRouter = require('./src/router/auth');
// const profileRouter = require('./src/router/profile');
// const requestRouter = require('./src/router/request');
// const userRouter = require('./src/router/user');
// const otpRouter = require('./src/router/otp');
// const chatRouter = require('./src/router/chat');
// const { startOfflineUserCleanup } = require('./src/utils/cronJobs');
// const session = require('express-session');
// const passport = require('passport');

// const app = express();

// app.set('trust proxy', 1);
// app.use(cors({
//     origin: process.env.FRONTEND_URL,
//     credentials: true,
//     methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//     allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
//     exposedHeaders: ['set-cookie']
// }));

// app.use(express.json());
// app.use(cookieParser());
// app.use(session({
//     secret: process.env.SESSION_SECRET,
//     resave: false,
//     saveUninitialized: false,
//     cookie: {
//         secure: process.env.NODE_ENV === 'production',
//         httpOnly: true,
//         maxAge: 24 * 60 * 60 * 1000,
//         sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
//     }
// }));

// app.use(passport.initialize());
// app.use(passport.session());

// app.use('/', authRouter);
// app.use('/', profileRouter);
// app.use('/', requestRouter);
// app.use('/', userRouter);
// app.use('/', otpRouter);
// app.use('/', chatRouter);

// app.get('/health', (req, res) => {
//     res.json({ status: 'ok', timestamp: new Date().toISOString() });
// });

// const server = http.createServer(app);
// initializeSocket(server);

// let cleanupJob = null;

// // Database connection with proper error handling
// connectDb()
//     .then(() => {
//         console.log("✓ Database connected successfully...");
//         cleanupJob = startOfflineUserCleanup();
//         server.listen(3000, () => {
//             console.log("✓ Server is running on port: 3000");
//         });
//     })
//     .catch((err) => {
//         console.error("✗ Database connection failed:", err.message);
//         process.exit(1);
//     });

// mongoose.connection.on('disconnected', () => {
//     console.log('⚠ Mongoose disconnected from DB');
//     // Stop cleanup job if DB disconnects
//     if (cleanupJob) {
//         cleanupJob.stop();
//         console.log('⚠ Cleanup job stopped due to DB disconnection');
//     }
// });

// // Handle process termination gracefully
// process.on('SIGINT', async () => {
//     console.log('\n⚠ Shutting down gracefully...');
//     try {
//         if (cleanupJob) {
//             cleanupJob.stop();
//             console.log('✓ Cleanup job stopped');
//         }
//         await mongoose.connection.close();
//         console.log('✓ MongoDB connection closed');
//         server.close(() => {
//             console.log('✓ Server closed');
//             process.exit(0);
//         });
//     } catch (error) {
//         console.error('✗ Error during shutdown:', error.message);
//         process.exit(1);
//     }
// });

// process.on('SIGTERM', async () => {
//     console.log('\n⚠ SIGTERM received, shutting down...');
//     try {
//         if (cleanupJob) {
//             cleanupJob.stop();
//             console.log('✓ Cleanup job stopped');
//         }
//         await mongoose.connection.close();
//         console.log('✓ MongoDB connection closed');
//         server.close(() => {
//             console.log('✓ Server closed');
//             process.exit(0);
//         });
//     } catch (error) {
//         console.error('✗ Error during shutdown:', error.message);
//         process.exit(1);
//     }
// });

// // Handle uncaught exceptions
// process.on('uncaughtException', (err) => {
//     console.error('✗ Uncaught Exception:', err.message);
//     console.error(err.stack);
//     process.exit(1);
// });

// // Handle unhandled promise rejections
// process.on('unhandledRejection', (reason, promise) => {
//     console.error('✗ Unhandled Rejection at:', promise, 'reason:', reason);
//     process.exit(1);
// });

// module.exports = app;



require('dotenv').config();
const express = require('express');
const connectDb = require('./src/config/database');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const http = require('http');
const mongoose = require('mongoose');
const { initializeSocket } = require('./src/utils/socket');
const authRouter = require('./src/router/auth');
const profileRouter = require('./src/router/profile');
const requestRouter = require('./src/router/request');
const userRouter = require('./src/router/user');
const otpRouter = require('./src/router/otp');
const chatRouter = require('./src/router/chat');
const { startOfflineUserCleanup } = require('./src/utils/cronJobs');
const passport = require('./src/config/passport');
const session = require('express-session');

const app = express();

// Trust proxy for secure cookies in production
app.set('trust proxy', 1);

// CORS configuration - MUST come before other middleware
const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:5173',
    'https://linkup-app.duckdns.org'
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.log('⚠ Blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With'],
    exposedHeaders: ['set-cookie']
}));

// Body parser
app.use(express.json());
app.use(cookieParser());

// Session configuration (required for Passport)
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-super-secret-key-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/', authRouter);
app.use('/', profileRouter);
app.use('/', requestRouter);
app.use('/', userRouter);
app.use('/', otpRouter);
app.use('/', chatRouter);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const server = http.createServer(app);
initializeSocket(server);

let cleanupJob = null;

// Database connection with proper error handling
connectDb()
    .then(() => {
        console.log("✓ Database connected successfully...");
        cleanupJob = startOfflineUserCleanup();
        server.listen(3000, () => {
            console.log("✓ Server is running on port: 3000");
            console.log(`✓ Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
            console.log(`✓ Backend URL: ${process.env.CALLBACK_URL || 'http://localhost:3000'}`);
        });
    })
    .catch((err) => {
        console.error("✗ Database connection failed:", err.message);
        process.exit(1);
    });

mongoose.connection.on('disconnected', () => {
    console.log('⚠ Mongoose disconnected from DB');
    if (cleanupJob) {
        cleanupJob.stop();
        console.log('⚠ Cleanup job stopped due to DB disconnection');
    }
});

// Handle process termination gracefully
process.on('SIGINT', async () => {
    console.log('\n⚠ Shutting down gracefully...');
    try {
        if (cleanupJob) {
            cleanupJob.stop();
            console.log('✓ Cleanup job stopped');
        }
        await mongoose.connection.close();
        console.log('✓ MongoDB connection closed');
        server.close(() => {
            console.log('✓ Server closed');
            process.exit(0);
        });
    } catch (error) {
        console.error('✗ Error during shutdown:', error.message);
        process.exit(1);
    }
});

process.on('SIGTERM', async () => {
    console.log('\n⚠ SIGTERM received, shutting down...');
    try {
        if (cleanupJob) {
            cleanupJob.stop();
            console.log('✓ Cleanup job stopped');
        }
        await mongoose.connection.close();
        console.log('✓ MongoDB connection closed');
        server.close(() => {
            console.log('✓ Server closed');
            process.exit(0);
        });
    } catch (error) {
        console.error('✗ Error during shutdown:', error.message);
        process.exit(1);
    }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('✗ Uncaught Exception:', err.message);
    console.error(err.stack);
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('✗ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

module.exports = app;