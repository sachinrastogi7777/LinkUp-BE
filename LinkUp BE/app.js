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

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));

app.use('/', authRouter);
app.use('/', profileRouter);
app.use('/', requestRouter);
app.use('/', userRouter);
app.use('/', otpRouter);
app.use('/', chatRouter);

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
        });
    })
    .catch((err) => {
        console.error("✗ Database connection failed:", err.message);
        process.exit(1);
    });

mongoose.connection.on('disconnected', () => {
    console.log('⚠ Mongoose disconnected from DB');
    // Stop cleanup job if DB disconnects
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