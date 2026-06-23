import mongoose from 'mongoose';

const logSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    date: { type: String, required: true, index: true }, // 'YYYY-MM-DD'

    items: [
      {
        id: String,
        type: String,
        mealType: String,
        foodId: String,
        name: String,
        quantity: String,
        nutrition: {
          calories: Number,
          protein: Number,
          carbs: Number,
          fat: Number,
          fiber: Number,
          sugar: Number,
          sodium: Number,
          water: Number,
          burnedCalories: Number,
          vitamins: mongoose.Schema.Types.Mixed,
        },
        exercise: mongoose.Schema.Types.Mixed,
        source: String,
        notes: String,
        createdAt: String,
      },
    ],
  },
  { timestamps: true }
);

// One log document per user per day
logSchema.index({ userId: 1, date: 1 }, { unique: true });

const Log = mongoose.model('Log', logSchema);
export default Log;
