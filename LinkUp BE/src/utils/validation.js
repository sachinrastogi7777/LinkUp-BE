const validator = require('validator');

const validateSignupData = (data) => {
    if (!data.firstName) {
        throw new Error("First name is required.");
    }
    if (!validator.isEmail(data.email)) {
        throw new Error("Please enter valid email.");
    }
    if (!validator.isStrongPassword(data.password)) {
        throw new Error("Please enter a strong password (at least 8 characters, including uppercase, lowercase, number, and special character)");
    }
    if (data.dateOfBirth) {
        const today = new Date();
        const birthDate = new Date(data.dateOfBirth);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        if (age < 13) {
            throw new Error("User must be at least 13 years old.");
        }
    }
    if (validator.isIn(data.gender, ['male', 'female', 'others'])) {
        throw new Error("Please select a valid gender.");
    }
    if (!validator.isMobilePhone(data.mobileNumber, 'any', { strictMode: false })) {
        throw new Error("Please enter a valid mobile number.");
    }
    if (!Array.isArray(data.interests) || data.interests.length > 10) {
        throw new Error("Only up to 10 interests are allowed");
    }
}

const ageValidation = (dateOfBirth) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

const phoneNumberValidation = (mobileNumber) => {
    const mobileRegex = /^\d{10}$/;
    return mobileRegex.test(mobileNumber);
}

const emailValidation = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,3}$/;
    return emailRegex.test(email);
}

const passwordValidation = (password) => {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,15}$/;
    return passwordRegex.test(password);
}

const genderValidation = (gender) => {
    const validGenders = ["male", "female", "other"];
    return validGenders.includes(gender.toLowerCase());
}

module.exports = {
    ageValidation,
    phoneNumberValidation,
    emailValidation,
    passwordValidation,
    genderValidation,
    validateSignupData,
};