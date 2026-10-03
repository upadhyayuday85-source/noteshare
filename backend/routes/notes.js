const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const cloudinary = require('cloudinary').v2;
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// files are kept in memory, then sent to Cloudinary (private, signed access only)
const allowed = ['.pdf', '.jpg', '.jpeg', '.png'];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      return cb(new Error('Only PDF, JPG and PNG files are allowed'));
    }
    cb(null, true);
  },
});

const fileOptions = { resource_type: 'raw', type: 'authenticated' };

function uploadToCloudinary(buffer, publicId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { ...fileOptions, public_id: publicId },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

async function isAdmin(userId) {
  const { rows } = await db.query('SELECT role FROM users WHERE id = $1', [userId]);
  return rows.length > 0 && rows[0].role === 'admin';
}

const NOTE_COLUMNS = `
  notes.id, notes.title, notes.subject, notes.branch, notes.semester,
  notes.description, notes.original_name, notes.uploaded_by,
  to_char(notes.created_at, 'YYYY-MM-DD') AS created_at,
  users.name AS uploaded_by_name
`;

// UPLOAD A NOTE
router.post('/', auth, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 10 MB)' : err.message;
      return res.status(400).json({ message: msg });
    }

    const { title, subject, branch, semester, description } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: 'Please select a file to upload' });
    }
    if (!title || !subject || !branch || !semester) {
      return res.status(400).json({ message: 'Title, subject, branch and semester are required' });
    }

    try {
      const ext = path.extname(req.file.originalname).toLowerCase();
      const publicId = `noteshare/${crypto.randomBytes(16).toString('hex')}${ext}`;
      await uploadToCloudinary(req.file.buffer, publicId);

      const { rows } = await db.query(
        `INSERT INTO notes (title, subject, branch, semester, description, file_public_id, original_name, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [
          title.trim(),
          subject.trim(),
          branch,
          Number(semester),
          description ? description.trim() : null,
          publicId,
          req.file.originalname,
          req.user.id,
        ]
      );

      res.status(201).json({ message: 'Note uploaded successfully', noteId: rows[0].id });
    } catch (e) {
      console.error('Upload failed:', e);
      res.status(500).json({ message: 'Upload failed. Please try again.' });
    }
  });
});

// LIST NOTES (with optional filters)
router.get('/', auth, async (req, res) => {
  const { branch, semester, search } = req.query;
  const params = [];
  let where = '';

  if (branch) {
    params.push(branch);
    where += ` AND notes.branch = $${params.length}`;
  }
  if (semester) {
    params.push(Number(semester));
    where += ` AND notes.semester = $${params.length}`;
  }
  if (search) {
    params.push(`%${search}%`);
    where += ` AND (notes.title ILIKE $${params.length} OR notes.subject ILIKE $${params.length})`;
  }

  const { rows } = await db.query(
    `SELECT ${NOTE_COLUMNS}
     FROM notes JOIN users ON users.id = notes.uploaded_by
     WHERE TRUE ${where}
     ORDER BY notes.created_at DESC`,
    params
  );
  res.json({ notes: rows });
});

// DOWNLOAD A NOTE FILE (login required)
router.get('/:id/file', auth, async (req, res) => {
  const { rows } = await db.query(
    'SELECT file_public_id, original_name FROM notes WHERE id = $1',
    [req.params.id]
  );
  if (rows.length === 0) {
    return res.status(404).json({ message: 'Note not found' });
  }

  // short-lived signed link, fetched by the server so the real link is never exposed
  const signedUrl = cloudinary.url(rows[0].file_public_id, {
    ...fileOptions,
    sign_url: true,
    secure: true,
  });

  const upstream = await fetch(signedUrl);
  if (!upstream.ok) {
    console.error('Cloudinary file fetch failed with status', upstream.status);
    return res.status(502).json({ message: 'Could not fetch the file right now' });
  }

  const buffer = Buffer.from(await upstream.arrayBuffer());
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename*=UTF-8''${encodeURIComponent(rows[0].original_name)}`
  );
  res.send(buffer);
});

// GET ONE NOTE
router.get('/:id', auth, async (req, res) => {
  const { rows } = await db.query(
    `SELECT ${NOTE_COLUMNS}
     FROM notes JOIN users ON users.id = notes.uploaded_by
     WHERE notes.id = $1`,
    [req.params.id]
  );
  if (rows.length === 0) {
    return res.status(404).json({ message: 'Note not found' });
  }
  res.json({ note: rows[0] });
});

// DELETE A NOTE (the uploader, or an admin)
router.delete('/:id', auth, async (req, res) => {
  const { rows } = await db.query(
    'SELECT id, file_public_id, uploaded_by FROM notes WHERE id = $1',
    [req.params.id]
  );
  if (rows.length === 0) {
    return res.status(404).json({ message: 'Note not found' });
  }
  const note = rows[0];

  if (note.uploaded_by !== req.user.id && !(await isAdmin(req.user.id))) {
    return res.status(403).json({ message: 'You can only delete your own notes' });
  }

  await db.query('DELETE FROM notes WHERE id = $1', [note.id]);

  try {
    await cloudinary.uploader.destroy(note.file_public_id, fileOptions);
  } catch (e) {
    console.error('Could not delete the file from Cloudinary:', e.message);
  }

  res.json({ message: 'Note deleted' });
});

module.exports = router;