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

const validateEditProfileData = (data) => {
    const editFieldAllowed = ['firstName', 'lastName', 'dateOfBirth', 'gender', 'mobileNumber', 'interests', 'about', 'profileImage', 'coverImage', 'location'];
    const isEditAllowed = Object.keys(data).every(field => editFieldAllowed.includes(field));
    if (isEditAllowed) {
        if (data.firstName && (data.firstName.length < 2 || data.firstName.length > 15)) {
            throw new Error("First name must be between 2 and 15 characters.");
        }
        if (data.lastName && (data.lastName.length < 2 || data.lastName.length > 15)) {
            throw new Error("Last name must be between 2 and 15 characters.");
        }
        if (data.mobileNumber && phoneNumberValidation(data.mobileNumber) === false) {
            throw new Error("Please enter a valid mobile number.");
        }
        if (data.gender && genderValidation(data.gender) === false) {
            throw new Error("Please select a valid gender.");
        }
        if (data.dateOfBirth && ageValidation(data.dateOfBirth) < 13) {
            throw new Error("User must be at least 13 years old.");
        }
        if (data.interests && Array.isArray(data.interests) && data.interests.length > 10) {
            throw new Error("Only up to 10 interests are allowed");
        }
        if (data.about && data.about.length > 200) {
            throw new Error("Max 200 length of About is allowed.!!!")
        }
    }
    return isEditAllowed;
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
    validateEditProfileData
};