const express = require('express');
const router = express.Router();
const { upload, meta, content, retryOcr, remove, MAX_BYTES } = require('../contollers/FileController');
const { requireAuth, requirePatientAccess } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimit');

router.use(requireAuth);
// raw bytes in the body; the real type is checked from the file contents
router.post('/:patientCNIC', requirePatientAccess('patientCNIC'), aiLimiter, express.raw({ type: () => true, limit: MAX_BYTES + 1024 }), upload);
router.get('/:id', meta);
router.get('/:id/content', content);
router.post('/:id/ocr', aiLimiter, retryOcr);
router.delete('/:id', remove);

module.exports = router;
