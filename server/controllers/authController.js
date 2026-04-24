const jwt = require('jsonwebtoken');
const passport = require('passport');
const User = require('../models/User');
const config = require('../config/env');

// Register a new user
const register = async (req, res, next) => {
    try {
        const { email, password } = req.body

        // Check if user already exists
        const existingUser = await User.findOne({ email })
        if (existingUser) {
            return res.status(409).json({
                success: false,
                error: {
                    message: 'A user with this email already exists',
                    code: 'USER_ALREADY_EXISTS'
                }
            })
        }

        // Create new user and save to database (password will be hashed by pre-save hook)
        const user = await User.create({
            email,
            password
        })

        // If successful, return safe user object without password
        res.status(201).json({
            success: true,
            data: user.toSafeObject()
        })

    } catch (error) {
        next(error)
    }
}

// Login user and return JWT token
const login = (req, res, next) => {
    // Use Passport's local strategy with JWT to authenticate the user
    passport.authenticate('local', { session: false }, (err, user, info) => {
        // Pass any errors from the authentication process to the error handler
        if (err) {
            return next(err)
        }

        // If authentication fails, return 401 with error message and code
        if (!user) {
            return res.status(401).json({
                success: false,
                error: {
                    message: info.message || 'Invalid email or password',
                    code: info.code || 'AUTH_INVALID_CREDENTIALS'
                }
            })
        }

        // Sign JWT token
        const token = jwt.sign(
            {
                userId: user.userId,
                role: user.role
            },
            config.JWT_SECRET,
            { expiresIn: config.JWT_EXPIRES_IN }
        )

        // Return token and user info (without password)
        res.status(200).json({
            success: true,
            data: {
                token,
                expiresIn: config.JWT_EXPIRES_IN,
                user
            }
        })
    })(req, res, next)
}

// Logout user (handled client-side by discarding the token)
const logout = (req, res) => {
    // As JWT authentication is stateless logout is handled at the client side by discarding the token
    res.status(200).json({
        success: true,
        data: {
            message: 'Successfully logged out'
        }
    })
}

// Get current authenticated user's profile
const getMe = async (req, res, next) => {
    try {
        // Retrieve user from database using ID from JWT payload 
        const user = await User.findById(req.user.userId)

        // If user not found, return 404 with error message and code
        if (!user) {
            return res.status(404).json({
                success: false,
                error: {
                    message: 'User not found',
                    code: 'NOT_FOUND'
                }
            })
        }
        
        // If user is found, return safe user object without password
        res.status(200).json({
            success: true,
            data: user.toSafeObject()
        })

    } catch (error) {
        next(error)
    }
}

module.exports = {
    register,
    login,
    logout,
    getMe
}