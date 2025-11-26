const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/user');

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

const getCallbackURL = () => {
    if (process.env.NODE_ENV === 'production') {
        return `${process.env.CALLBACK_URL}/auth/google/callback`;
    }
    return 'http://localhost:3000/auth/google/callback';
};

// Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: getCallbackURL(),
    passReqToCallback: true,
    proxy: true
}, async (req, accessToken, refreshToken, profile, done) => {
    try {
        let isNewUser = false;
        let user = await User.findOne({ googleId: profile.id });
        
        if (user) {
            user.isOnline = true;
            user.lastSeen = new Date();
            await user.save();
            return done(null, { user, isNewUser: false });
        }

        const email = profile.emails?.[0]?.value;
        if (email) {
            user = await User.findOne({ email: email });
            if (user) {
                user.googleId = profile.id;
                user.authProvider = 'google';
                if (!user.profileImage || user.profileImage.includes('vectorstock')) {
                    user.profileImage = profile.photos?.[0]?.value || user.profileImage;
                }
                user.isOnline = true;
                user.lastSeen = new Date();
                await user.save();
                return done(null, { user, isNewUser: false });
            }
        }

        isNewUser = true;
        const firstName = profile.name?.givenName || profile.displayName?.split(' ')[0] || 'User';
        const lastName = profile.name?.familyName || profile.displayName?.split(' ').slice(1).join(' ') || 'Name';

        const baseUsername = email ? email.split('@')[0] : firstName.toLowerCase();
        let userName = (baseUsername + Math.floor(Math.random() * 1000)).toLowerCase().replace(/[^a-z0-9]/g, '');
        let userExists = await User.findOne({ userName });
        while (userExists) {
            userName = (baseUsername + Math.floor(Math.random() * 10000)).toLowerCase().replace(/[^a-z0-9]/g, '');
            userExists = await User.findOne({ userName });
        }
        
        user = new User({
            googleId: profile.id,
            firstName,
            lastName,
            email: email || `${profile.id}@google.placeholder.com`,
            userName,
            profileImage: profile.photos?.[0]?.value || 'https://cdn.vectorstock.com/i/1000v/28/01/flat-style-faceless-portrait-of-a-young-man-head-vector-59492801.avif',
            authProvider: 'google',
            isOnline: true,
            lastSeen: new Date()
        });

        await user.save();
        return done(null, { user, isNewUser: true });
    } catch (error) {
        console.error('✗ Passport strategy error:', error);
        return done(error, null);
    }
}));

module.exports = passport;