const express = require('express');
const asyncHandler = require('express-async-handler');
const router = express.Router();
const ai = require('../contollers/AIController');
const { requireAuth, requireRole, requireVerifiedDoctor } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimit');

router.use(requireAuth);
router.get('/status', ai.status);
router.get('/threads', asyncHandler(ai.listThreads));
router.get('/threads/:id', asyncHandler(ai.getThread));
router.delete('/threads/:id', asyncHandler(ai.deleteThread));
router.post('/chat', ai.requireAI, aiLimiter, asyncHandler(ai.postChat));
router.post('/explain/:recordId', ai.requireAI, aiLimiter, asyncHandler(ai.explainRecord));
router.post('/summary/:patientCNIC', requireRole('doctor'), requireVerifiedDoctor, ai.requireAI, aiLimiter, asyncHandler(ai.summarizePatient));

module.exports = router;
