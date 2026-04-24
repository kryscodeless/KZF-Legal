const mongoose = require('mongoose')
const config = require('./env')

const connectDB = async () => {
    try {
        await mongoose.connect(config.MONGODB_URI)
        console.log('MongoDB connected under URI:', config.MONGODB_URI)
    } catch (error) {
        console.error('MongoDB connection error:', error)
        process.exit(1) // Exit process with failure
    }  
}

module.exports = connectDB