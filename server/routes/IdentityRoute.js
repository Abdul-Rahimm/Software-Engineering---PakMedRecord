const express = require('express');
const identity = require('../contollers/IdentityController');
const { requireAuth } = require('../middleware/auth');
const { signinLimiter } = require('../middleware/rateLimit');

const router = express.Router();
router.use(requireAuth);
router.get('/me', identity.mine);
router.post('/', signinLimiter, identity.submit);

module.exports = router;
