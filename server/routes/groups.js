import { Router } from 'express';
import {
  listGroups, getGroup, getGroupForUser, createGroup, deleteGroup,
  findAccounts, addGroupMember, updateGroupMember, deleteGroupMember,
} from '../data/store.js';
import { auth, h, verified } from '../middleware.js';

const router = Router();
router.use(auth(), verified());

// Only the owner can add or remove people, rename or delete the group.
const own = async (req, res) => {
  const group = await getGroup(req.params.id, req.user.id);
  if (!group) {
    const visible = await getGroupForUser(req.params.id, req.user.id);
    res.status(visible ? 403 : 404).json({ error: visible ? 'Only the group owner can do that.' : 'Group not found.' });
  }
  return group;
};

// Owner or member: can see the group.
const visible = async (req, res) => {
  const group = await getGroupForUser(req.params.id, req.user.id);
  if (!group) res.status(404).json({ error: 'Group not found.' });
  return group;
};

router.get('/', h(async (req, res) => {
  res.json({ groups: await listGroups(req.user.id) });
}));

router.post('/', h(async (req, res) => {
  if (req.user.isGuest) return res.status(403).json({ error: 'Sign up to make a group.' });
  const name = (req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Give your group a name.' });
  const group = await createGroup({ ownerId: req.user.id, name });
  res.status(201).json({ group });
}));

router.delete('/:id', h(async (req, res) => {
  const group = await own(req, res);
  if (!group) return;
  await deleteGroup(group.id);
  res.json({ ok: true });
}));

// Add a friend by their account name or email. They must already have an account.
router.post('/:id/members', h(async (req, res) => {
  const group = await own(req, res);
  if (!group) return;
  const text = (req.body?.name || '').trim();
  if (!text) return res.status(400).json({ error: "Enter your friend's account name or email." });

  const found = await findAccounts(text);
  if (!found.length) {
    return res.status(404).json({ error: `No Saan Tayo? account is named "${text}". Ask your friend to sign up first, then add them by their account name or email.` });
  }
  if (found.length > 1) {
    return res.status(409).json({ error: `More than one account is named "${text}". Add them by their email instead.` });
  }
  const friend = found[0];
  if (friend.id === group.ownerId) return res.status(400).json({ error: "That's you. You're already in this group as the owner." });
  if (group.members.some((m) => m.userId === friend.id)) {
    return res.status(409).json({ error: `${friend.name} is already in this group.` });
  }
  try {
    await addGroupMember(group.id, { name: friend.name, userId: friend.id, preference: req.body?.preference || 'No restrictions' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: `${friend.name} is already in this group.` });
    throw err;
  }
  res.status(201).json({ group: await getGroup(group.id, req.user.id) });
}));

// The owner can edit anyone's preference; a member can edit their own.
router.patch('/:id/members/:memberId', h(async (req, res) => {
  const group = await visible(req, res);
  if (!group) return;
  const member = group.members.find((m) => m.id === req.params.memberId);
  if (!member) return res.status(404).json({ error: 'Member not found.' });
  if (group.role !== 'owner' && !member.isYou) return res.status(403).json({ error: 'You can only edit your own preference.' });
  const changes = {};
  if (typeof req.body?.preference === 'string') changes.preference = req.body.preference.trim().slice(0, 200) || 'No restrictions';
  await updateGroupMember(group.id, member.id, changes);
  res.json({ group: await getGroupForUser(group.id, req.user.id) });
}));

// The owner removes someone, or a member leaves the group.
router.delete('/:id/members/:memberId', h(async (req, res) => {
  const group = await visible(req, res);
  if (!group) return;
  const member = group.members.find((m) => m.id === req.params.memberId);
  if (!member) return res.status(404).json({ error: 'Member not found.' });
  if (group.role !== 'owner' && !member.isYou) return res.status(403).json({ error: 'Only the group owner can remove people.' });
  await deleteGroupMember(group.id, member.id);
  if (member.isYou && group.role !== 'owner') return res.json({ left: true });
  res.json({ group: await getGroupForUser(group.id, req.user.id) });
}));

export default router;
