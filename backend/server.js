require('dotenv').config();
const express = require('express');
const cors = require('cors');
const auth = require('./middleware/auth');
const db = require('./db');

const app = express();

// allowed frontend addresses (comma separated). Empty = allow all (fine for local testing)
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors(allowedOrigins.length ? { origin: allowedOrigins } : {}));
app.use(express.json());

app.get('/', (req, res) => res.json({ status: 'NoteShare API is running' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/notes', require('./routes/notes'));
app.use('/api', require('./routes/doubts'));

// returns the logged-in user's details (fresh from the database, including role)
app.get('/api/me', auth, async (req, res) => {
  const { rows } = await db.query(
    'SELECT id, name, email, branch, year, role FROM users WHERE id = $1',
    [req.user.id]
  );
  if (rows.length === 0) {
    return res.status(401).json({ message: 'Account not found' });
  }
  res.json({ user: rows[0] });
});

// any unexpected error ends up here
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Something went wrong on the server' });
});

const PORT = process.env.PORT || 5000;

db.init()
  .then(() => {
    console.log('Database ready');
    app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('Database setup failed:', err.message);
    process.exit(1);
  });