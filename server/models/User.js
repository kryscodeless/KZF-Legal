const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Note: In authentication, mongoose validation acts as a safety net, 
// but we will also validate inputs at the API level using Zod schemas 
// and middleware for better error handling and security.
const userSchema = new mongoose.Schema({
     email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false  // Never return password in queries
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user'
    }
}, {
    timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function () {
  // Only hash if password has been modified
  if (!this.isModified('password')) {
    return
  }
  // Generate salt to add brute-force protection and hash the password
  const salt = await bcrypt.genSalt(12)
  this.password = await bcrypt.hash(this.password, salt)
})

// Method to compare entered password with hashed password in database
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password)
}

// Method to return safe user object not containing the password
userSchema.methods.toSafeObject = function () {
  return {
    userId: this._id,
    email: this.email,
    role: this.role,
    // Automatically created by fields from mongoose when timestamps: true is set
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  }
}

const User = mongoose.model('User', userSchema);

module.exports = User;
