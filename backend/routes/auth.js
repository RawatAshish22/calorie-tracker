import { Router } from 'express';
import User from '../models/User.js';
import authMiddleware, { generateToken } from '../middleware/auth.js';

const router = Router();

/** Strip sensitive fields before sending user data to the client. */
function sanitizeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    profile: user.profile,
    goals: user.goals,
    aiSettings: user.aiSettings,
  };
}

// ─── POST /register ─────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check for duplicate email
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const user = await User.create({ name, email, password });
    const token = generateToken(user._id);

    res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /login ─────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user._id);
    res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /me ─────────────────────────────────────────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    console.error('Get-me error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /forgot-password ──────────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      // Don't reveal whether the email exists
      return res.json({ message: 'If that email is registered, a reset code has been sent' });
    }

    // Generate 6-digit code & set 15-min expiry
    const code = String(Math.floor(100000 + Math.random() * 900000));
    user.resetCode = code;
    user.resetCodeExpiry = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    // TODO: Send code via email service
    res.json({ message: 'Reset code sent', code });
  } catch (err) {
    console.error('Forgot-password error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /reset-password ───────────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'Email, code, and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || user.resetCode !== code) {
      return res.status(400).json({ error: 'Invalid reset code' });
    }
    if (!user.resetCodeExpiry || user.resetCodeExpiry < new Date()) {
      return res.status(400).json({ error: 'Reset code has expired' });
    }

    // Update password (pre-save hook auto-hashes) & clear reset fields
    user.password = newPassword;
    user.resetCode = undefined;
    user.resetCodeExpiry = undefined;
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (err) {
    console.error('Reset-password error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export { sanitizeUser };
export default router;
