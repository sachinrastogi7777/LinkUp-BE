const cron = require('node-cron');
const mongoose = require('mongoose');
const ConnectionRequest = require('../models/connectionRequest');
const { formatted7AM, generateConnectionRequestEmail, fetchPendingRequests, categorizeRequestsByEmail, sortRequests, generateEmailSubject } = require('./helper');
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
        const { yesterdayIsoString, todayIsoString } = formatted7AM();
        const allPendingRequests = await fetchPendingRequests();

        if (allPendingRequests.length === 0) {
            return;
        }

        const { requestByEmail, emailStats } = categorizeRequestsByEmail(
            allPendingRequests,
            yesterdayIsoString,
            todayIsoString
        );

        if (Object.keys(requestByEmail).length === 0) {
            return;
        }

        const htmlFilePath = path.join(__dirname, 'emailTemplate', 'connectionNotification.html');
        const htmlTemplate = await fs.readFile(htmlFilePath, 'utf8');

        for (const [email, data] of Object.entries(requestByEmail)) {
            try {
                const { all, new: newRequests } = data;
                const stats = emailStats[email];
                const sortedRequests = sortRequests(all, newRequests);

                let htmlContent = generateConnectionRequestEmail(htmlTemplate, sortedRequests);
                htmlContent = htmlContent.replace('{year}', new Date().getFullYear());
                const subject = generateEmailSubject(stats);

                const mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: email,
                    subject: subject,
                    html: htmlContent
                };

                await transporter.sendMail(mailOptions);
            } catch (emailError) {
                console.error(`❌ Failed to send email to ${email}:`, emailError.message);
            }
        }
    } catch (error) {
        console.error('Error running cron job:', error);
    }
})

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
}, {
    scheduled: true,
    timezone: "Asia/Kolkata"
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
}, {
    scheduled: true,
    timezone: "Asia/Kolkata"
});

const startOfflineUserCleanup = () => {
    const job = cron.schedule('* * * * *', async () => {
        try {
            if (mongoose.connection.readyState !== 1) {
                console.log('Database not connected, skipping cleanup');
                return;
            }

            const thresholdTime = new Date(Date.now() - 2 * 60 * 1000);
            const result = await User.updateMany(
                {
                    isOnline: true,
                    lastSeen: { $lt: thresholdTime }
                },
                {
                    $set: { isOnline: false }
                }
            );
        } catch (error) {
            console.error('✗ Error updating offline users:', error.message);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Kolkata"
    });
    return job;
};

module.exports = { startOfflineUserCleanup };