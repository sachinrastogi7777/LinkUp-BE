const cron = require('node-cron');
const ConnectionRequest = require('../models/connectionRequest');
const { formatted7AM } = require('./helper');
const nodemailer = require('nodemailer');
const User = require('../models/user');
const fs = require('fs').promises;
const path = require('path');

const { yesterdayIsoString, todayIsoString } = formatted7AM();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

cron.schedule('0 7 * * *', async () => {
    try {
        const pendingConnection = await ConnectionRequest.find({
            status: 'interested',
            createdAt: {
                $gt: yesterdayIsoString,
                $lte: todayIsoString
            }
        }).populate('fromUserId toUserId');

        const uniqeEmails = [
            ...new Set(pendingConnection.map(req => req.toUserId.email))
        ]

        const htmlFilePath = path.join(__dirname, 'emailTemplate', 'connectionNotification.html');
        let htmlContent = await fs.readFile(htmlFilePath, 'utf8');
        htmlContent = htmlContent.replace('{year}', new Date().getFullYear());

        for (const email of uniqeEmails) {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Connection Requests Pending Approval',
                html: htmlContent
            }
            await transporter.sendMail(mailOptions);
        }
    } catch (error) {
        console.error('Error running cron job:', error);
    }
});

cron.schedule('0 0 * * 1', async () => {
    try {
        const ignoredRequests = await ConnectionRequest.deleteMany({
            status: 'ignored',
            createdAt: {
                $lte: yesterdayIsoString
            }
        });
    } catch (error) {
        console.error('Error running cron job:', error);
    }
});

cron.schedule('0 6 * * *', async () => {
    try {
        const today = new Date();
        const allUsers = await User.find({ dateOfBirth: { $ne: null } });
        const birthdayUsers = allUsers.filter(user => {
            const dob = new Date(user.dateOfBirth);
            return dob.getDate() === today.getDate() && dob.getMonth() === today.getMonth();
        });
        const htmlFilePath = path.join(__dirname, 'emailTemplate', 'birthday.html');
        let htmlContent = await fs.readFile(htmlFilePath, 'utf8');
        htmlContent = htmlContent.replace('{year}', new Date().getFullYear());
        for (const user of birthdayUsers) {
            htmlContent = htmlContent.replace('${user.firstName}', user.firstName);
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: user.email,
                subject: 'Happy Birthday from LinkUp!',
                html: htmlContent
            };
            await transporter.sendMail(mailOptions);
        }
    } catch (error) {
        console.error('Error running cron job:', error);
    }
});