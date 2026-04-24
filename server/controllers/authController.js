const passport = require('passport');
const { registerUser, loginUser, getUserByID } = require('../services/authService')

// Register a new user
const register = async (req, res, next) => {
    try {
        const user = await registerUser(req.body)

        // If successfully registered, return 201 with safe user object
        res.status(201).json({
            success: true,
            data: user
        })
    } catch (error) {
        next(error)
    }
}

// Login user and return JWT token
const login = (req, res, next) => {
    passport.authenticate('local', { session: false }, async (err, user, info) => {
        if (err) {
            return next(err)
        }

        // If credentials are invalid, return a 401 error with message and code from the local strategy
        if (!user) {
            return res.status(401).json({
                success: false,
                error: {
                    message: info.message || 'Invalid email or password',
                    code: info.code || 'AUTH_INVALID_CREDENTIALS'
                }
            })
        }

        try {
            // If authentication is successful, generate JWT token and return it along with user data
            const data = await loginUser(user)

            // If token generation is successful, return 200 with token, expiration time, and safe user object
            res.status(200).json({
                success: true,
                data
            })

        } catch (error) {
            next(error)
        }
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
        // Retrieve user from database using ID from JWT payload (set by auth middleware)
        const user = await getUserById(req.user.userId)

        // If user is found, return safe user object without password
        res.status(200).json({
            success: true,
            data: user
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