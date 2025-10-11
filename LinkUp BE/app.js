require('dotenv').config();
const express = require('express');
const connectDb = require('./src/config/database');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const authRouter = require('./src/router/auth');
const profileRouter = require('./src/router/profile');
const requestRouter = require('./src/router/request');
const userRouter = require('./src/router/user');
const otpRouter = require('./src/router/otp');
const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}))

app.use('/', authRouter);
app.use('/', profileRouter);
app.use('/', requestRouter);
app.use('/', userRouter);
app.use('/', otpRouter);

connectDb().then(() => {
    console.log("Database connected successfully...");
    app.listen(3000, () => {
        console.log("Server is running on port: 3000")
    })
}).catch(() => {
    console.log("Database connection failed!!!");
});