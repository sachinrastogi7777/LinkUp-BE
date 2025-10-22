const express = require('express');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/user');
const Otp = require('../models/otp');
const bcrypt = require('bcrypt');
const otpRouter = express.Router();
const fs = require('fs').promises;
const path = require('path');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

const generateOtp = () => {
    return crypto.randomInt(100000, 999999).toString();
};

otpRouter.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            const err = new Error("Please enter your Email.");
            err.status = 400;
            throw err;
        }
        const user = await User.findOne({ email });
        if (!user) {
            const err = new Error("Email does not exist. Please enter correct Email.");
            err.status = 404;
            throw err;
        }
        const otp = generateOtp();
        const otpData = new Otp({
            email: email,
            otp: otp,
            expireAt: new Date(Date.now() + 5 * 60 * 1000) // OTP valid for 5 minutes
        });
        await otpData.save();

        // Read otp.html template and inject OTP and year
        const htmlFilePath = path.join(__dirname, '../utils/emailTemplate', 'otp.html');
        let htmlContent = await fs.readFile(htmlFilePath, 'utf8');
        htmlContent = htmlContent.replace('{code}', otp);
        htmlContent = htmlContent.replace('{year}', new Date().getFullYear());

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Password Reset OTP',
            html: htmlContent
        }
        await transporter.sendMail(mailOptions);
        res.json({ message: "OTP has been sent to your email." });
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ message: error.message });
    }
});

otpRouter.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        const matchOtp = await Otp.findOne({ email, otp });
        if (!matchOtp) {
            const err = new Error("Invalid OTP or Email.");
            err.status = 400;
            throw err;
        }
        res.json({ message: "OTP verified successfully." });
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ message: error.message });
    }
});

otpRouter.post('/reset-password', async (req, res) => {
    try {
        const { email, newPassword } = req.body;
        if (!email || !newPassword) {
            const err = new Error("Email and new password are required.");
            err.status = 400;
            throw err;
        }

        const user = await User.findOne({ email });
        if (!user) {
            const err = new Error("User not found.");
            err.status = 404;
            throw err;
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        res.json({ message: 'Password has been reset successfully.' });
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ message: error.message });
    }
});

otpRouter.post('/resend-otp', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            const err = new Error("Please enter your Email.");
            err.status = 400;
            throw err;
        }
        const user = await User.findOne({ email });
        if (!user) {
            const err = new Error("Email does not exist. Please enter correct Email.");
            err.status = 404;
            throw err;
        }
        const otp = generateOtp();
        const otpData = new Otp({
            email: email,
            otp: otp,
            expireAt: new Date(Date.now() + 5 * 60 * 1000) // OTP valid for 5 minutes
        });
        await otpData.save();
        const htmlFilePath = path.join(__dirname, '../utils/emailTemplate', 'otp.html');
        let htmlContent = await fs.readFile(htmlFilePath, 'utf8');
        htmlContent = htmlContent.replace('{code}', otp);
        htmlContent = htmlContent.replace('{year}', new Date().getFullYear());

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Password Reset OTP',
            html: htmlContent
        }
        await transporter.sendMail(mailOptions);
        res.json({ message: "New OTP has been sent to your email." });
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ message: error.message });
    }
});

module.exports = otpRouter;