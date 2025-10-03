const express = require('express');
const connectDb = require('./src/config/database');
const cookieParser = require('cookie-parser');
const authRouter = require('./src/router/auth');
const app = express();

app.use(express.json());
app.use(cookieParser());

app.use('/', authRouter);

connectDb().then(() => {
    console.log("Database connected successfully...");
    app.listen(3000, () => {
        console.log("Server is running on port: 3000")
    })
}).catch(() => {
    console.log("Database connection failed!!!");
});