const mongoose = require('mongoose');
const JWT = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true,
        minLength: 2,
        maxLength: 15
    },
    lastName: {
        type: String,
        required: true,
        minLength: 2,
        maxLength: 15
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: function () {
            return !this.googleId && !this.facebookId;
        },
        minLength: 6,
    },
    userName: {
        type: String,
        required: true,
        unique: true,
    },
    dateOfBirth: {
        type: Date,
    },
    gender: {
        type: String,
        enum: {
            values: ['Male', 'Female', 'Other'],
            message: '{VALUE} is not a valid Gender'
        },
    },
    mobileNumber: {
        type: Number,
        unique: true,
        sparse: true,
    },
    interests: {
        type: Array,
    },
    about: {
        type: String,
        maxLength: 200,
    },
    profileImage: {
        type: String,
        default: 'https://cdn.vectorstock.com/i/1000v/28/01/flat-style-faceless-portrait-of-a-young-man-head-vector-59492801.avif'
    },
    location: {
        type: String,
    },
    coverImage: {
        type: String,
        default: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&h=300&fit=crop'
    },
    isOnline: {
        type: Boolean,
        default: false
    },
    lastSeen: {
        type: Date,
        default: Date.now
    },
    googleId: {
        type: String,
        sparse: true,
        unique: true,
    },
    authProvider: {
        type: String,
        enum: ['local', 'google'],
        default: 'local'
    }
}, { timestamps: true });

userSchema.methods.getJWT = async function () {
    const user = this;
    const token = JWT.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return token;
}

userSchema.methods.validatePassword = async function (passwordInputByUser) {
    const user = this;
    const passwordHash = user.password;
    const isPasswordValid = await bcrypt.compare(passwordInputByUser, passwordHash);
    return isPasswordValid;
}

const User = mongoose.model("User", userSchema);

module.exports = User;