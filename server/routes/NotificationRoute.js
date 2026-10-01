const express = require('express');
const router = express.Router();
const { list, markRead, markAllRead } = require('../contollers/NotificationController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);
router.get('/', list);
router.patch('/read-all', markAllRead);
router.patch('/:id/read', markRead);

module.exports = router;
