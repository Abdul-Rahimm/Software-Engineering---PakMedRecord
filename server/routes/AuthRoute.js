const express = require('express');
const router = express.Router();
const { options, verifyEmail, resendVerification, googleSignIn, googleComplete, forgotPassword, resetPassword, twoFactor } = require('../contollers/AuthController');
const { signinLimiter } = require('../middleware/rateLimit');

router.get('/options', options);
router.post('/verify-email', signinLimiter, verifyEmail);
router.post('/resend-verification', signinLimiter, resendVerification);
router.post('/google', signinLimiter, googleSignIn);
router.post('/google/complete', signinLimiter, googleComplete);

router.post('/forgot-password', signinLimiter, forgotPassword);
router.post('/reset-password', signinLimiter, resetPassword);
router.post('/2fa', signinLimiter, twoFactor);

module.exports = router;
