const express = require('express');
const { login, forceChangePassword } = require('../controllers/authController');
const { verifyToken } = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/login', login);
router.post('/change-password', verifyToken, forceChangePassword);

module.exports = router;