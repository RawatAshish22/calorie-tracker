import { Router } from 'express';
import User from '../models/User.js';
import Log from '../models/Log.js';
import auth from '../middleware/auth.js';
import { sanitizeUser } from './auth.js';

const router = Router();

// All routes require authentication
router.use(auth);

// ─── PUT /profile ────────────────────────────────────────────────────────────
router.put('/profile', async (req, res) => {
  try {
    const { profile, goals } = req.body;

    const update = {};
    if (profile) update.profile = profile;
    if (goals) update.goals = goals;

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

// ─── PUT /goals ──────────────────────────────────────────────────────────────
router.put('/goals', async (req, res) => {
  try {
    const { goals } = req.body;
    if (!goals) return res.status(400).json({ error: 'Goals object is required' });

    // Merge incoming goals with existing ones
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

// ─── PUT /ai-settings ───────────────────────────────────────────────────────
router.put('/ai-settings', async (req, res) => {
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

// ─── GET /logs ───────────────────────────────────────────────────────────────
router.get('/logs', async (req, res) => {
  try {
    const { from, to } = req.query;
    const filter = { userId: req.userId };

    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = from;
      if (to) filter.date.$lte = to;
    }

    const docs = await Log.find(filter).sort({ date: 1 }).lean();

    // Convert array of Log docs to a date-keyed object
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

// ─── GET /logs/:date ─────────────────────────────────────────────────────────
router.get('/logs/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const log = await Log.findOne({ userId: req.userId, date }).lean();

    res.json({ date, items: log ? log.items : [] });
  } catch (err) {
    console.error('Get log error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /logs/:date/meals ─────────────────────────────────────────────────
router.post('/logs/:date/meals', async (req, res) => {
  try {
    const { date } = req.params;
    const { meal } = req.body;

    if (!meal) return res.status(400).json({ error: 'Meal object is required' });

    // Find existing log or create a new one, then push the meal
    const log = await Log.findOneAndUpdate(
      { userId: req.userId, date },
      { $push: { items: meal } },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(201).json({ date, items: log.items });
  } catch (err) {
    console.error('Add meal error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── DELETE /logs/:date/meals/:mealId ────────────────────────────────────────
router.delete('/logs/:date/meals/:mealId', async (req, res) => {
  try {
    const { date, mealId } = req.params;

    const log = await Log.findOne({ userId: req.userId, date });
    if (!log) return res.status(404).json({ error: 'Log not found' });

    // Remove the meal with the matching id
    log.items = log.items.filter((item) => item.id !== mealId);
    await log.save();

    res.json({ date, items: log.items });
  } catch (err) {
    console.error('Delete meal error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
