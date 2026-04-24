const express = require('express')
const passport = require('./config/passport')
const routes = require('./routes')

// Initialize Express app
const app = express()

// Global middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Temporary health route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    }
  })
})

// Initialize Passport (without session as JWT is stateless)
app.use(passport.initialize())

// API routes
app.use('/api', routes)

module.exports = app