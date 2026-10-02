const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// make sure uploads folder exists
const uploadDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, crypto.randomBytes(16).toString('hex') + ext);
  },
});

const allowed = ['.pdf', '.jpg', '.jpeg', '.png'];

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      return cb(new Error('Only PDF, JPG and PNG files are allowed'));
    }
    cb(null, true);
  },
});

// UPLOAD A NOTE
router.post('/', auth, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 10 MB)' : err.message;
      return res.status(400).json({ message: msg });
    }

    const { title, subject, branch, semester, description } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: 'Please select a file to upload' });
    }
    if (!title || !subject || !branch || !semester) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ message: 'Title, subject, branch and semester are required' });
    }

    const result = db
      .prepare(
        `INSERT INTO notes (title, subject, branch, semester, description, file_name, original_name, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        title.trim(),
        subject.trim(),
        branch,
        Number(semester),
        description ? description.trim() : null,
        req.file.filename,
        req.file.originalname,
        req.user.id
      );

    res.status(201).json({ message: 'Note uploaded successfully', noteId: result.lastInsertRowid });
  });
});

// LIST NOTES (with optional filters)
router.get('/', auth, (req, res) => {
  const { branch, semester, search } = req.query;

  let sql = `
        SELECT notes.id, notes.title, notes.subject, notes.branch, notes.semester,
           notes.description, notes.original_name, notes.created_at, notes.uploaded_by,
           users.name AS uploaded_by_name
    FROM notes
    JOIN users ON users.id = notes.uploaded_by
    WHERE 1 = 1
  `;
  const params = [];

  if (branch) { sql += ' AND notes.branch = ?'; params.push(branch); }
  if (semester) { sql += ' AND notes.semester = ?'; params.push(Number(semester)); }
  if (search) {
    sql += ' AND (notes.title LIKE ? OR notes.subject LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  sql += ' ORDER BY notes.created_at DESC';

  res.json({ notes: db.prepare(sql).all(...params) });
});

// DOWNLOAD / VIEW A NOTE FILE (login required)
router.get('/:id/file', auth, (req, res) => {
  const note = db.prepare('SELECT file_name, original_name FROM notes WHERE id = ?').get(req.params.id);
  if (!note) {
    return res.status(404).json({ message: 'Note not found' });
  }
  res.download(path.join(uploadDir, note.file_name), note.original_name);
});
// DELETE A NOTE (only the person who uploaded it)
router.delete('/:id', auth, (req, res) => {
  const note = db
    .prepare('SELECT id, file_name, uploaded_by FROM notes WHERE id = ?')
    .get(req.params.id);

  if (!note) {
    return res.status(404).json({ message: 'Note not found' });
  }
  if (note.uploaded_by !== req.user.id) {
    return res.status(403).json({ message: 'You can only delete your own notes' });
  }

  db.prepare('DELETE FROM notes WHERE id = ?').run(note.id);
  fs.unlink(path.join(uploadDir, note.file_name), () => {}); // remove the file too

  res.json({ message: 'Note deleted' });
}); 
// GET ONE NOTE
router.get('/:id', auth, (req, res) => {
  const note = db
    .prepare(
      `SELECT notes.id, notes.title, notes.subject, notes.branch, notes.semester,
              notes.description, notes.original_name, notes.created_at, notes.uploaded_by,
              users.name AS uploaded_by_name
       FROM notes
       JOIN users ON users.id = notes.uploaded_by
       WHERE notes.id = ?`
    )
    .get(req.params.id);

  if (!note) {
    return res.status(404).json({ message: 'Note not found' });
  }
  res.json({ note });
});

module.exports = router;