const express = require('express');
const { register, login, logout, getMe } = require('../controllers/authController')
// const requireAuth = require('../middleware/requireAuth');
const validateRequest = require('../middleware/validateRequest');
const { registerSchema, loginSchema } = require('../validators/authValidator');

// Initialize router
const router = express.Router();

// Authentication routes
router.post('/register', validateRequest(registerSchema), register);
router.post('/login', validateRequest(loginSchema), login);
router.post('/logout', /* requireAuth, */ logout);
router.get('/me', /* requireAuth, */ getMe);

module.exports = router;