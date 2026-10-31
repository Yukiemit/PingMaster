import { Router } from 'express';
import { db, uid } from '../data/store.js';
import { auth } from '../middleware.js';

const router = Router();
router.use(auth());

const own = (req, res) => {
  const group = db.groups.find((g) => g.id === req.params.id && g.ownerId === req.user.id);
  if (!group) res.status(404).json({ error: 'Group not found.' });
  return group;
};

router.get('/', (req, res) => {
  res.json({ groups: db.groups.filter((g) => g.ownerId === req.user.id) });
});

router.post('/', (req, res) => {
  const name = (req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Give your group a name.' });
  const group = { id: uid('g_'), ownerId: req.user.id, name, members: [] };
  db.groups.push(group);
  res.status(201).json({ group });
});

router.delete('/:id', (req, res) => {
  const group = own(req, res);
  if (!group) return;
  db.groups.splice(db.groups.indexOf(group), 1);
  res.json({ ok: true });
});

router.post('/:id/members', (req, res) => {
  const group = own(req, res);
  if (!group) return;
  const name = (req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: "Enter your friend's name." });
  const member = { id: uid('m_'), name, preference: req.body?.preference || 'No restrictions' };
  group.members.push(member);
  res.status(201).json({ group });
});

router.patch('/:id/members/:memberId', (req, res) => {
  const group = own(req, res);
  if (!group) return;
  const member = group.members.find((m) => m.id === req.params.memberId);
  if (!member) return res.status(404).json({ error: 'Member not found.' });
  if (typeof req.body?.preference === 'string') member.preference = req.body.preference.trim() || 'No restrictions';
  if (typeof req.body?.name === 'string' && req.body.name.trim()) member.name = req.body.name.trim();
  res.json({ group });
});

router.delete('/:id/members/:memberId', (req, res) => {
  const group = own(req, res);
  if (!group) return;
  group.members = group.members.filter((m) => m.id !== req.params.memberId);
  res.json({ group });
});

export default router;
