import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },

    profile: {
      gender: String,
      dob: String,
      age: Number,
      heightUnit: String,
      heightCm: Number,
      heightFeet: Number,
      heightInches: Number,
      weightKg: Number,
      desiredWeightKg: Number,
      activity: String,
      goal: String,
      dietPreference: String,
      completed: Boolean,
      updatedAt: String,
    },

    goals: {
      calories: { type: Number, default: 2000 },
      protein: { type: Number, default: 120 },
      carbs: { type: Number, default: 240 },
      fat: { type: Number, default: 65 },
      fiber: { type: Number, default: 28 },
      sugar: { type: Number, default: 50 },
      sodium: { type: Number, default: 2300 },
    },

    aiSettings: {
      provider: { type: String, default: 'auto' },
    },

    resetCode: String,
    resetCodeExpiry: Date,

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Hash password before saving (only when modified)
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare candidate password against stored hash
userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
