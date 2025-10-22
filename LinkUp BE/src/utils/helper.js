const streamifier = require('streamifier');
const cloudinary = require('./cloudinaryConfig')

const uploadToCloudinary = async (buffer, type, retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            const result = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    {
                        resource_type: 'image',
                        folder: `profile_images/${type}`,
                        timeout: 60000, // 60 seconds timeout
                        transformation: [
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

            return result; // Success, return result
        } catch (error) {
            console.log(`Upload attempt ${i + 1} failed:`, error.message);
            if (i === retries - 1) {
                throw error; // Last attempt failed
            }
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}

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
}

module.exports = { uploadToCloudinary, formatted7AM };