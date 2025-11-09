const streamifier = require('streamifier');
const cloudinary = require('./cloudinaryConfig');
const ConnectionRequest = require('../models/connectionRequest');

const uploadToCloudinary = async (buffer, type, retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            const result = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    {
                        resource_type: 'image',
                        folder: type === 'chat' ? 'chat_images' : `profile_images/${type}`,
                        timeout: 60000,
                        transformation: type === 'chat' ? [
                            { width: 800, height: 800, crop: 'limit' },
                            { quality: 'auto:good' },
                            { fetch_format: 'auto' }
                        ] : [
                            {
                                width: type === 'profile' ? 400 : 1200,
                                height: type === 'profile' ? 400 : 400,
                                crop: 'limit'
                            },
                            { quality: 'auto:good' },
                            { fetch_format: 'auto' }
                        ]
                    },
                    (error, result) => {
                        if (error) {
                            console.error('Cloudinary upload error:', error);
                            reject(error);
                        } else {
                            resolve(result);
                        }
                    }
                );
                streamifier.createReadStream(buffer).pipe(uploadStream);
            });

            return result;
        } catch (error) {
            console.log(`Upload attempt ${i + 1} failed:`, error.message);
            if (i === retries - 1) {
                throw error;
            }
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
};

const formatted7AM = () => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    yesterday.setHours(7, 0, 0, 0);
    const yesterdayIsoString = yesterday.toISOString();

    const today = new Date(now);
    today.setHours(7, 0, 0, 0);
    const todayIsoString = today.toISOString();

    return { yesterdayIsoString, todayIsoString };
};

const generateConnectionRequestEmail = (htmlTemplate, requests) => {
    let htmlContent = htmlTemplate;
    htmlContent = htmlContent.replace('{year}', new Date().getFullYear());

    const totalRequests = requests.length;
    htmlContent = htmlContent.replace('{totalRequests}', totalRequests);
    htmlContent = htmlContent.replace('{plural}', totalRequests > 1 ? 's' : '');

    // Generate request cards (max 5)
    const requestsToShow = requests.slice(0, 5);
    const now = Date.now();
    const oneDayInMs = 24 * 60 * 60 * 1000;

    const requestCardsHtml = requestsToShow.map(req => {
        const fromUser = req.fromUserId;
        const fullName = `${fromUser.firstName} ${fromUser.lastName}`;
        const profileImage = fromUser.profileImage || 'https://via.placeholder.com/50';
        const about = fromUser.about ? fromUser.about.split(' ').slice(0, 10).join(' ') + '...' : '';
        const baseUrl = process.env.FRONTEND_URL || 'http://16.16.115.34';

        // Check if request is from yesterday (new)
        const requestAge = now - new Date(req.createdAt).getTime();
        const isNew = requestAge < oneDayInMs;
        const newBadge = isNew ? '<span style="background: #10b981; color: white; font-size: 10px; padding: 2px 6px; border-radius: 10px; margin-left: 6px; font-weight: 600;">NEW</span>' : '';

        return `
        <div class="request-card">
            <div class="request-image">
                <img src="${profileImage}" alt="${fullName}">
            </div>
            <div class="request-info">
                <p class="request-name">${fullName}${newBadge}</p>
                <p class="request-detail">${about}</p>
            </div>
            <div class="request-button">
                <a href="${baseUrl}/requests" class="review-btn">Review</a>
            </div>
        </div>`;
    }).join('');

    htmlContent = htmlContent.replace('{requestCards}', requestCardsHtml);

    let viewMoreSection = '';
    if (totalRequests > 5) {
        const remainingCount = totalRequests - 5;
        const appUrl = process.env.APP_URL;
        viewMoreSection = `
        <div class="view-more">
            <a href="${appUrl}/requests" class="view-more-link">
                + ${remainingCount} more request${remainingCount > 1 ? 's' : ''} waiting for your review
            </a>
        </div>`;
    }
    htmlContent = htmlContent.replace('{viewMoreSection}', viewMoreSection);

    return htmlContent;
};

const fetchPendingRequests = async () => {
    return await ConnectionRequest.find({
        status: 'interested'
    }).populate('fromUserId toUserId');
};

/**
 * 1. New requests (created yesterday after 7 AM): Send notification once (next day)
 * 2. Old requests (3+ days old): Send notification every 3 days
 */
const categorizeRequestsByEmail = (allRequests, yesterdayIsoString, todayIsoString) => {
    const now = Date.now();
    const threeDaysInMs = 3 * 24 * 60 * 60 * 1000;
    const requestByEmail = {};
    const emailStats = {};

    allRequests.forEach(req => {
        const email = req.toUserId.email;
        const createdAt = new Date(req.createdAt);
        const requestAge = now - createdAt.getTime();
        const lastNotified = req.lastNotificationSent ? new Date(req.lastNotificationSent) : null;
        const timeSinceLastNotification = lastNotified ? now - lastNotified.getTime() : Infinity;

        const isNewRequest = createdAt > new Date(yesterdayIsoString) && createdAt <= new Date(todayIsoString) && !lastNotified;
        const isOldRequest = requestAge >= threeDaysInMs && (!lastNotified || timeSinceLastNotification >= threeDaysInMs);

        if (isNewRequest || isOldRequest) {
            if (!requestByEmail[email]) {
                requestByEmail[email] = {
                    all: [],
                    new: [],
                    old: []
                };
                emailStats[email] = {
                    newCount: 0,
                    oldCount: 0,
                    totalCount: 0
                };
            }

            requestByEmail[email].all.push(req);
            emailStats[email].totalCount++;

            if (isNewRequest) {
                requestByEmail[email].new.push(req);
                emailStats[email].newCount++;
            }

            if (isOldRequest) {
                requestByEmail[email].old.push(req);
                emailStats[email].oldCount++;
            }
        }
    });
    return { requestByEmail, emailStats };
};

const sortRequests = (allRequests, newRequests) => {
    return allRequests.sort((a, b) => {
        const aIsNew = newRequests.some(req => req._id.equals(a._id));
        const bIsNew = newRequests.some(req => req._id.equals(b._id));

        if (aIsNew && !bIsNew) return -1;
        if (!aIsNew && bIsNew) return 1;

        return new Date(b.createdAt) - new Date(a.createdAt);
    });
};

const generateEmailSubject = (stats) => {
    if (stats.newCount > 0 && stats.oldCount > 0) {
        return `You have ${stats.newCount} new request${stats.newCount > 1 ? 's' : ''} + ${stats.oldCount} pending`;
    } else if (stats.newCount > 0) {
        return `You have ${stats.newCount} new connection request${stats.newCount > 1 ? 's' : ''}`;
    } else {
        return `Reminder: ${stats.oldCount} connection request${stats.oldCount > 1 ? 's' : ''} still pending`;
    }
};

const updateNotificationTracking = async (requestIds) => {
    try {
        await ConnectionRequest.updateMany(
            { _id: { $in: requestIds } },
            {
                $set: { lastNotificationSent: new Date() },
                $inc: { notificationCount: 1 }
            }
        );
    } catch (error) {
        console.error('Error updating notification tracking:', error);
        throw error;
    }
};

module.exports = {
    uploadToCloudinary,
    formatted7AM,
    generateConnectionRequestEmail,
    fetchPendingRequests,
    categorizeRequestsByEmail,
    sortRequests,
    generateEmailSubject,
    updateNotificationTracking,
};