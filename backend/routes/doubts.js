const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// LIST DOUBTS OF A NOTE (with replies)
router.get('/notes/:noteId/doubts', auth, (req, res) => {
  const note = db.prepare('SELECT id FROM notes WHERE id = ?').get(req.params.noteId);
  if (!note) {
    return res.status(404).json({ message: 'Note not found' });
  }

  const doubts = db
    .prepare(
      `SELECT doubts.id, doubts.question, doubts.is_solved, doubts.created_at, doubts.user_id,
              users.name AS user_name
       FROM doubts
       JOIN users ON users.id = doubts.user_id
       WHERE doubts.note_id = ?
       ORDER BY doubts.created_at DESC`
    )
    .all(note.id);

  const replyStmt = db.prepare(
    `SELECT replies.id, replies.answer, replies.created_at, replies.user_id,
            users.name AS user_name
     FROM replies
     JOIN users ON users.id = replies.user_id
     WHERE replies.doubt_id = ?
     ORDER BY replies.created_at ASC`
  );
  doubts.forEach((d) => {
    d.replies = replyStmt.all(d.id);
  });

  res.json({ doubts });
});

// POST A DOUBT
router.post('/notes/:noteId/doubts', auth, (req, res) => {
  const question = (req.body.question || '').trim();
  if (!question) {
    return res.status(400).json({ message: 'Please write your doubt' });
  }
  if (question.length > 1000) {
    return res.status(400).json({ message: 'Doubt is too long (max 1000 characters)' });
  }

  const note = db.prepare('SELECT id FROM notes WHERE id = ?').get(req.params.noteId);
  if (!note) {
    return res.status(404).json({ message: 'Note not found' });
  }

  const result = db
    .prepare('INSERT INTO doubts (note_id, user_id, question) VALUES (?, ?, ?)')
    .run(note.id, req.user.id, question);

  res.status(201).json({ message: 'Doubt posted', doubtId: result.lastInsertRowid });
});

// REPLY TO A DOUBT
router.post('/doubts/:doubtId/replies', auth, (req, res) => {
  const answer = (req.body.answer || '').trim();
  if (!answer) {
    return res.status(400).json({ message: 'Please write your reply' });
  }
  if (answer.length > 1000) {
    return res.status(400).json({ message: 'Reply is too long (max 1000 characters)' });
  }

  const doubt = db.prepare('SELECT id FROM doubts WHERE id = ?').get(req.params.doubtId);
  if (!doubt) {
    return res.status(404).json({ message: 'Doubt not found' });
  }

  const result = db
    .prepare('INSERT INTO replies (doubt_id, user_id, answer) VALUES (?, ?, ?)')
    .run(doubt.id, req.user.id, answer);

  res.status(201).json({ message: 'Reply posted', replyId: result.lastInsertRowid });
});

// MARK A DOUBT SOLVED / UNSOLVED (only the person who asked it)
router.patch('/doubts/:doubtId/solved', auth, (req, res) => {
  const doubt = db.prepare('SELECT id, user_id FROM doubts WHERE id = ?').get(req.params.doubtId);
  if (!doubt) {
    return res.status(404).json({ message: 'Doubt not found' });
  }
  if (doubt.user_id !== req.user.id) {
    return res.status(403).json({ message: 'Only the person who asked can mark it solved' });
  }

  db.prepare('UPDATE doubts SET is_solved = CASE is_solved WHEN 1 THEN 0 ELSE 1 END WHERE id = ?').run(doubt.id);
  res.json({ message: 'Updated' });
});

// DELETE A DOUBT (only the person who asked it)
router.delete('/doubts/:doubtId', auth, (req, res) => {
  const doubt = db.prepare('SELECT id, user_id FROM doubts WHERE id = ?').get(req.params.doubtId);
  if (!doubt) {
    return res.status(404).json({ message: 'Doubt not found' });
  }
  if (doubt.user_id !== req.user.id) {
    return res.status(403).json({ message: 'You can only delete your own doubts' });
  }

  db.prepare('DELETE FROM doubts WHERE id = ?').run(doubt.id);
  res.json({ message: 'Doubt deleted' });
});

module.exports = router;