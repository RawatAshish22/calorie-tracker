import { Router } from 'express';
import crypto from 'node:crypto';
import Group from '../models/Group.js';
import User from '../models/User.js';
import authMiddleware from '../middleware/auth.js';

const router = Router();

// ─── PUBLIC: GET /api/groups/preview-link/:token ─ Preview group info ───────
// No auth needed — used to show the join prompt before login/join
router.get('/preview-link/:token', async (req, res) => {
  try {
    const group = await Group.findOne({ inviteToken: req.params.token }).lean();
    if (!group) return res.status(404).json({ error: 'Invite link is invalid or expired.' });
    res.json({
      name: group.name,
      memberCount: group.members.length,
      token: req.params.token,
    });
  } catch (err) {
    console.error('Preview link error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// All group routes below require authentication
router.use(authMiddleware);

/** Generate a random 6-character uppercase alphanumeric group code */
function generateCode() {
  return crypto.randomBytes(4).toString('base64url').toUpperCase().slice(0, 6).replace(/[^A-Z0-9]/g, 'X').padEnd(6, 'X');
}

/** Sanitize a group for client response */
function sanitizeGroup(group, userId) {
  return {
    id: group._id,
    name: group.name,
    code: group.code,
    inviteToken: group.inviteToken,
    memberCount: group.members.length,
    members: group.members.map((m) => ({
      id: m.userId,
      name: m.name,
      profilePic: m.profilePic || '',
      joinedAt: m.joinedAt,
    })),
    isMember: group.members.some((m) => String(m.userId) === String(userId)),
    isCreator: String(group.createdBy) === String(userId),
    activity: group.recentActivity().map((a) => ({
      id: a._id,
      userId: a.userId,
      userName: a.userName,
      userProfilePic: a.userProfilePic || '',
      modeId: a.modeId,
      modeName: a.modeName,
      calories: a.calories,
      elapsedSeconds: a.elapsedSeconds,
      distanceKm: a.distanceKm,
      summary: a.summary,
      postedAt: a.postedAt,
    })),
    createdAt: group.createdAt,
  };
}

// ─── POST /api/groups ── Create a group ────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    const user = await User.findById(req.userId).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Generate unique code
    let code;
    let attempts = 0;
    do {
      code = generateCode();
      attempts++;
    } while (attempts < 10 && await Group.exists({ code }));

    const inviteToken = crypto.randomUUID();

    const group = await Group.create({
      name: name.trim(),
      code,
      inviteToken,
      createdBy: req.userId,
      members: [{ userId: req.userId, name: user.name, profilePic: user.profilePic || '', joinedAt: new Date() }],
      activity: [],
    });

    res.status(201).json({ group: sanitizeGroup(group, req.userId) });
  } catch (err) {
    console.error('Create group error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/groups ── Get all groups the user belongs to ─────────────────
router.get('/', async (req, res) => {
  try {
    const groups = await Group.find({ 'members.userId': req.userId })
      .sort({ createdAt: -1 })
      .lean({ virtuals: false });

    // Manually attach recentActivity since lean() skips methods
    res.json({
      groups: groups.map((g) => {
        const sorted = [...(g.activity || [])].sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt)).slice(0, 50);
        const fake = { ...g, recentActivity: () => sorted };
        return sanitizeGroup(fake, req.userId);
      }),
    });
  } catch (err) {
    console.error('Get groups error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/groups/join ── Join by code ──────────────────────────────────
router.post('/join', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Group code is required' });

    const group = await Group.findOne({ code: code.trim().toUpperCase() });
    if (!group) return res.status(404).json({ error: 'Group not found. Check the code and try again.' });

    const alreadyMember = group.members.some((m) => String(m.userId) === String(req.userId));
    if (alreadyMember) {
      return res.json({ group: sanitizeGroup(group, req.userId), alreadyMember: true });
    }

    const user = await User.findById(req.userId).lean();
    group.members.push({ userId: req.userId, name: user.name, profilePic: user.profilePic || '', joinedAt: new Date() });
    await group.save();

    res.json({ group: sanitizeGroup(group, req.userId) });
  } catch (err) {
    console.error('Join group error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/groups/join-link/:token ── Join via invite link ─────────────
router.post('/join-link/:token', async (req, res) => {
  try {
    const group = await Group.findOne({ inviteToken: req.params.token });
    if (!group) return res.status(404).json({ error: 'Invite link is invalid or expired.' });

    const alreadyMember = group.members.some((m) => String(m.userId) === String(req.userId));
    if (!alreadyMember) {
      const user = await User.findById(req.userId).lean();
      group.members.push({ userId: req.userId, name: user.name, profilePic: user.profilePic || '', joinedAt: new Date() });
      await group.save();
    }

    res.json({ group: sanitizeGroup(group, req.userId), alreadyMember });
  } catch (err) {
    console.error('Join via link error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/groups/:id ── Get group feed ─────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const isMember = group.members.some((m) => String(m.userId) === String(req.userId));
    if (!isMember) return res.status(403).json({ error: 'You are not a member of this group' });

    res.json({ group: sanitizeGroup(group, req.userId) });
  } catch (err) {
    console.error('Get group feed error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/groups/:id/activity ── Post burn session to group ────────────
router.post('/:id/activity', async (req, res) => {
  try {
    const { modeId, modeName, calories, elapsedSeconds, distanceKm, summary } = req.body;
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const member = group.members.find((m) => String(m.userId) === String(req.userId));
    if (!member) return res.status(403).json({ error: 'You are not a member of this group' });

    group.activity.push({
      userId: req.userId,
      userName: member.name,
      userProfilePic: member.profilePic || '',
      modeId,
      modeName,
      calories,
      elapsedSeconds,
      distanceKm,
      summary,
      postedAt: new Date(),
    });

    // Keep only last 200 activities
    if (group.activity.length > 200) {
      group.activity = group.activity.slice(-200);
    }

    await group.save();
    res.json({ ok: true });
  } catch (err) {
    console.error('Post activity error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── DELETE /api/groups/:id/leave ── Leave a group ─────────────────────────
router.delete('/:id/leave', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    group.members = group.members.filter((m) => String(m.userId) !== String(req.userId));
    await group.save();

    res.json({ ok: true });
  } catch (err) {
    console.error('Leave group error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
