import { Router } from 'express';
import User from '../models/User.js';
import Log from '../models/Log.js';
import auth from '../middleware/auth.js';
import { sanitizeUser } from './auth.js';

// ─── User/Profile Router (mounted at /api/user) ───────────────────────────────
export const userRouter = Router();
userRouter.use(auth);

function calculateTDEE(profile) {
  if (!profile || !profile.weightKg || !profile.heightCm || !profile.age || !profile.gender) return null;
  
  // Mifflin-St Jeor Equation
  let bmr = (10 * profile.weightKg) + (6.25 * profile.heightCm) - (5 * profile.age);
  bmr += profile.gender === 'male' ? 5 : -161;

  const activityMultipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };
  
  const multiplier = activityMultipliers[profile.activity] || 1.2;
  let tdee = Math.round(bmr * multiplier);

  // Goal adjustment
  if (profile.goal === 'lose') tdee -= 500;
  if (profile.goal === 'lose_fast') tdee -= 1000;
  if (profile.goal === 'gain') tdee += 500;
  if (profile.goal === 'gain_fast') tdee += 1000;

  // Safety minimums
  const minCalories = profile.gender === 'male' ? 1500 : 1200;
  return Math.max(tdee, minCalories);
}

// ─── PUT /api/user/profile ────────────────────────────────────────────────────
userRouter.put('/profile', async (req, res) => {
  try {
    const { profile, goals, profilePic } = req.body;

    const update = {};
    if (profilePic !== undefined) update.profilePic = profilePic;
    
    if (profile) {
      update.profile = profile;
      
      // Auto-calculate macros if a full profile is provided
      const newCalories = calculateTDEE(profile);
      if (newCalories) {
        update.goals = {
          calories: newCalories,
          protein: Math.round((newCalories * 0.3) / 4),
          carbs: Math.round((newCalories * 0.4) / 4),
          fat: Math.round((newCalories * 0.3) / 9),
          fiber: 28,
          sugar: 50,
          sodium: 2300,
        };
      }
    }
    
    // Explicit goals payload overrides auto-calculated ones
    if (goals) {
      update.goals = { ...update.goals, ...goals };
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── PUT /api/user/goals ──────────────────────────────────────────────────────
userRouter.put('/goals', async (req, res) => {
  try {
    const { goals } = req.body;
    if (!goals) return res.status(400).json({ error: 'Goals object is required' });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    Object.assign(user.goals, goals);
    await user.save();

    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    console.error('Update goals error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── PUT /api/user/ai-settings ───────────────────────────────────────────────
userRouter.put('/ai-settings', async (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings) return res.status(400).json({ error: 'Settings object is required' });

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: { aiSettings: settings } },
      { new: true, runValidators: true }
    );
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    console.error('Update AI settings error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Logs Router (mounted at /api) ────────────────────────────────────────────
export const logsRouter = Router();
logsRouter.use(auth);

// ─── GET /api/logs ────────────────────────────────────────────────────────────
logsRouter.get('/logs', async (req, res) => {
  try {
    const { from, to } = req.query;
    const filter = { userId: req.userId };

    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = from;
      if (to) filter.date.$lte = to;
    }

    const docs = await Log.find(filter).sort({ date: 1 }).lean();

    const logs = {};
    for (const doc of docs) {
      logs[doc.date] = doc.items;
    }

    res.json({ logs });
  } catch (err) {
    console.error('Get logs error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/logs/:date ──────────────────────────────────────────────────────
logsRouter.get('/logs/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const log = await Log.findOne({ userId: req.userId, date }).lean();

    res.json({ date, items: log ? log.items : [] });
  } catch (err) {
    console.error('Get log error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/logs/:date/meals ───────────────────────────────────────────────
logsRouter.post('/logs/:date/meals', async (req, res) => {
  try {
    const { date } = req.params;
    const { meal } = req.body;

    if (!meal) return res.status(400).json({ error: 'Meal object is required' });

    // Use findOne + save instead of findOneAndUpdate+upsert
    // to avoid Mongoose runValidators bug with $push on upsert
    let log = await Log.findOne({ userId: req.userId, date });

    if (!log) {
      log = new Log({ userId: req.userId, date, items: [] });
    }

    log.items.push(meal);
    log.markModified('items'); // Required for Mongoose Mixed arrays
    await log.save();

    res.status(201).json({ date, items: log.items });
  } catch (err) {
    console.error('Add meal error:', err.message || err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// ─── DELETE /api/logs/:date/meals/:mealId ─────────────────────────────────────
logsRouter.delete('/logs/:date/meals/:mealId', async (req, res) => {
  try {
    const { date, mealId } = req.params;

    const log = await Log.findOne({ userId: req.userId, date });
    if (!log) return res.status(404).json({ error: 'Log not found' });

    log.items = log.items.filter((item) => item.id !== mealId);
    log.markModified('items'); // Required for Mongoose Mixed arrays
    await log.save();

    res.json({ date, items: log.items });
  } catch (err) {
    console.error('Delete meal error:', err.message || err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// Keep default export for backward compat (unused after server.js update)
export default logsRouter;
