import mongoose from 'mongoose';

// Use strict: false on the items sub-schema so any meal shape is accepted.
// We also avoid the Mongoose 'type' reserved keyword conflict by defining
// items as an array of Mixed — meal data is user-generated and variable.
const logSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    date: { type: String, required: true, index: true }, // 'YYYY-MM-DD'

    // Use Mixed so any meal object shape works without Mongoose type-casting issues.
    // The old { id: String, type: String, ... } schema hit Mongoose's reserved
    // 'type' keyword bug, causing "Cast to string failed" on every $push.
    items: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
  },
  { timestamps: true }
);

// One log document per user per day
logSchema.index({ userId: 1, date: 1 }, { unique: true });

const Log = mongoose.model('Log', logSchema);
export default Log;
