const express = require('express');
const bcrypt = require('bcrypt');
const userAuth = require('../middleware/auth');
const { validateEditProfileData, passwordValidation } = require('../utils/validation');

const profileRouter = express.Router();

profileRouter.get('/profile/view', userAuth, async (req, res) => {
    try {
        const user = req.user;
        res.send(user);
    } catch (error) {
        res.status(500).send("ERROR : " + error.message);
    }
});

profileRouter.patch('/profile/edit', userAuth, async (req, res) => {
    try {
        const loggedInUser = req.user;
        if (!validateEditProfileData(req.body)) {
            throw new Error('Invalid Field Edited.')
        }
        Object.keys(req.body).forEach(field => loggedInUser[field] = req.body[field]);
        const user = await loggedInUser.save();
        res.json({ message: 'Profile updated successfully!!!', data: user })
    } catch (error) {
        res.status(500).send("ERROR : " + error.message);
    }
})

profileRouter.patch('/profile/updatePassword', userAuth, async (req, res) => {
    try {
        const loggedInUser = req.user;
        const { currentPassword, newPassword } = req.body;
        const isPasswordValid = await bcrypt.compare(currentPassword, loggedInUser.password);
        if (!isPasswordValid) {
            throw new Error('Please enter correct current password.');
        }
        const isNewPasswordSameAsOld = await bcrypt.compare(newPassword, loggedInUser.password);
        if (isNewPasswordSameAsOld) {
            throw new Error('New password must be different from current password');
        }
        const newPasswordValidation = passwordValidation(newPassword);
        if (!newPasswordValidation) {
            throw new Error('Please enter a strong password (at least 8 characters, including uppercase, lowercase, number, and special character)')
        }
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        loggedInUser.password = hashedPassword;
        await loggedInUser.save();
        res.json({ message: 'Password updated successfully.', data: loggedInUser });
    } catch (error) {
        res.status(500).send("ERROR : " + error.message);
    }
})

module.exports = profileRouter;