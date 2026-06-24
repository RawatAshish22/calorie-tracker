import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: String,
  userProfilePic: { type: String, default: '' },
  modeId: String,
  modeName: String,
  calories: Number,
  elapsedSeconds: Number,
  distanceKm: Number,
  summary: String,
  postedAt: { type: Date, default: Date.now },
});

const memberSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: String,
  profilePic: { type: String, default: '' },
  joinedAt: { type: Date, default: Date.now },
});

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 40 },
  code: { type: String, required: true, unique: true, uppercase: true, length: 6 },
  inviteToken: { type: String, required: true, unique: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  members: [memberSchema],
  activity: {
    type: [activitySchema],
    validate: [(v) => v.length <= 200, 'Activity feed too large'],
  },
  createdAt: { type: Date, default: Date.now },
});

// Only return last 50 activities (most recent first)
groupSchema.methods.recentActivity = function () {
  return [...this.activity].sort((a, b) => b.postedAt - a.postedAt).slice(0, 50);
};

const Group = mongoose.model('Group', groupSchema);
export default Group;
