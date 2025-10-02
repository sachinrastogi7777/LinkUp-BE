const mongoose = require('mongoose');
require('dotenv').config();

const connectDb = async () => {
    try {
        await mongoose.connect(process.env.DATABASE_URL);
    } catch (error) {
        console.error('MongoDB connection failed:', error.message);
    }
};

module.exports = connectDb;