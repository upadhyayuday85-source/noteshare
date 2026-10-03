const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

async function isAdmin(userId) {
  const { rows } = await db.query('SELECT role FROM users WHERE id = $1', [userId]);
  return rows.length > 0 && rows[0].role === 'admin';
}

// LIST DOUBTS OF A NOTE (with replies)
router.get('/notes/:noteId/doubts', auth, async (req, res) => {
  const note = await db.query('SELECT id FROM notes WHERE id = $1', [req.params.noteId]);
  if (note.rows.length === 0) {
    return res.status(404).json({ message: 'Note not found' });
  }

  const doubtsResult = await db.query(
    `SELECT doubts.id, doubts.question, doubts.is_solved, doubts.user_id,
            to_char(doubts.created_at, 'YYYY-MM-DD') AS created_at,
            users.name AS user_name
     FROM doubts JOIN users ON users.id = doubts.user_id
     WHERE doubts.note_id = $1
     ORDER BY doubts.created_at DESC`,
    [req.params.noteId]
  );
  const doubts = doubtsResult.rows;
  doubts.forEach((d) => (d.replies = []));

  if (doubts.length > 0) {
    const repliesResult = await db.query(
      `SELECT replies.id, replies.doubt_id, replies.answer, replies.user_id,
              to_char(replies.created_at, 'YYYY-MM-DD') AS created_at,
              users.name AS user_name
       FROM replies JOIN users ON users.id = replies.user_id
       WHERE replies.doubt_id = ANY($1::int[])
       ORDER BY replies.created_at ASC`,
      [doubts.map((d) => d.id)]
    );
    repliesResult.rows.forEach((r) => {
      doubts.find((d) => d.id === r.doubt_id).replies.push(r);
    });
  }

  res.json({ doubts });
});

// POST A DOUBT
router.post('/notes/:noteId/doubts', auth, async (req, res) => {
  const question = (req.body.question || '').trim();
  if (!question) {
    return res.status(400).json({ message: 'Please write your doubt' });
  }
  if (question.length > 1000) {
    return res.status(400).json({ message: 'Doubt is too long (max 1000 characters)' });
  }

  const note = await db.query('SELECT id FROM notes WHERE id = $1', [req.params.noteId]);
  if (note.rows.length === 0) {
    return res.status(404).json({ message: 'Note not found' });
  }

  const { rows } = await db.query(
    'INSERT INTO doubts (note_id, user_id, question) VALUES ($1, $2, $3) RETURNING id',
    [req.params.noteId, req.user.id, question]
  );
  res.status(201).json({ message: 'Doubt posted', doubtId: rows[0].id });
});

// REPLY TO A DOUBT
router.post('/doubts/:doubtId/replies', auth, async (req, res) => {
  const answer = (req.body.answer || '').trim();
  if (!answer) {
    return res.status(400).json({ message: 'Please write your reply' });
  }
  if (answer.length > 1000) {
    return res.status(400).json({ message: 'Reply is too long (max 1000 characters)' });
  }

  const doubt = await db.query('SELECT id FROM doubts WHERE id = $1', [req.params.doubtId]);
  if (doubt.rows.length === 0) {
    return res.status(404).json({ message: 'Doubt not found' });
  }

  const { rows } = await db.query(
    'INSERT INTO replies (doubt_id, user_id, answer) VALUES ($1, $2, $3) RETURNING id',
    [req.params.doubtId, req.user.id, answer]
  );
  res.status(201).json({ message: 'Reply posted', replyId: rows[0].id });
});

// MARK A DOUBT SOLVED / UNSOLVED (only the person who asked it)
router.patch('/doubts/:doubtId/solved', auth, async (req, res) => {
  const { rows } = await db.query('SELECT id, user_id FROM doubts WHERE id = $1', [req.params.doubtId]);
  if (rows.length === 0) {
    return res.status(404).json({ message: 'Doubt not found' });
  }
  if (rows[0].user_id !== req.user.id) {
    return res.status(403).json({ message: 'Only the person who asked can mark it solved' });
  }

  await db.query('UPDATE doubts SET is_solved = NOT is_solved WHERE id = $1', [rows[0].id]);
  res.json({ message: 'Updated' });
});

// DELETE A DOUBT (the person who asked it, or an admin)
router.delete('/doubts/:doubtId', auth, async (req, res) => {
  const { rows } = await db.query('SELECT id, user_id FROM doubts WHERE id = $1', [req.params.doubtId]);
  if (rows.length === 0) {
    return res.status(404).json({ message: 'Doubt not found' });
  }

  if (rows[0].user_id !== req.user.id && !(await isAdmin(req.user.id))) {
    return res.status(403).json({ message: 'You can only delete your own doubts' });
  }

  await db.query('DELETE FROM doubts WHERE id = $1', [rows[0].id]);
  res.json({ message: 'Doubt deleted' });
});

module.exports = router;