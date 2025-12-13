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
const MongoStore = require('connect-mongo');

const app = express();

app.set('trust proxy', 1);

const allowedOrigins = [
    process.env.FRONTEND_URL
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With'],
    exposedHeaders: ['set-cookie']
}));

app.use(express.json());
app.use(cookieParser());

// Use MongoDB for session storage in production
const sessionConfig = {
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    }
};

// Add MongoStore in production
if (process.env.NODE_ENV === 'production') {
    sessionConfig.store = MongoStore.create({
        mongoUrl: process.env.DATABASE_URL,
        touchAfter: 24 * 3600, // Update session only once in 24 hours unless session data changes
        crypto: {
            secret: process.env.SESSION_SECRET
        },
        collectionName: 'sessions',
        ttl: 24 * 60 * 60 // 24 hours
    });
}

app.use(session(sessionConfig));

app.use(passport.initialize());
app.use(passport.session());

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

connectDb()
    .then(() => {
        console.log("✓ Database connected successfully...");
        cleanupJob = startOfflineUserCleanup();
        server.listen(3000, () => {
            console.log("✓ Server is running on port: 3000");
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