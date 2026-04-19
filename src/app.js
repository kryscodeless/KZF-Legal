const express = require('express')

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

module.exports = app