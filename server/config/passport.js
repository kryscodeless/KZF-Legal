const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const User = require('../models/User');
const config = require('./env');

// Local strategy for username + password login
passport.use(
  new LocalStrategy(
    // Use email instead of default username field
    {
      usernameField: 'email',   
      passwordField: 'password'
    },
    async (email, password, done) => {
      try {
        // Find user and explicitly include password field
        const user = await User.findOne({ email }).select('+password')

        // User not found
        if (!user) {
          return done(null, false, {
            message: 'Invalid email or password',
            code: 'AUTH_INVALID_CREDENTIALS'
          })
        }

        // Compare provided password against hashed password
        const isMatch = await user.comparePassword(password)

        // If password does not match, authentication fails
        if (!isMatch) {
          return done(null, false, {
            message: 'Invalid email or password',
            code: 'AUTH_INVALID_CREDENTIALS'
          })
        }

        // If password matches, return safe user object
        return done(null, user.toSafeObject())

      } catch (error) {
        return done(error)
      }
    }
  )
)

// JWT strategy for protected routes
passport.use(
  new JwtStrategy(
    // Read the JWT from the Authorization header as a Bearer token
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.JWT_SECRET
    },
    async (jwtPayload, done) => {
      try {
        // Find user by ID from JWT payload
        const user = await User.findById(jwtPayload.userId)

        // If user not found, authentication fails
        if (!user) {
          return done(null, false)
        }

        // If user is found, return safe user object
        return done(null, user.toSafeObject())

      } catch (error) {
        return done(error)
      }
    }
  )
)

module.exports = passport;