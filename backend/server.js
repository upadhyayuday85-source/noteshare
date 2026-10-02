require('dotenv').config();
const express = require('express');
const cors = require('cors');
const auth = require('./middleware/auth');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/notes', require('./routes/notes'));
app.use('/api', require('./routes/doubts'));

// returns the logged-in user's details (fresh from the database, including role)
app.get('/api/me', auth, (req, res) => {
  const user = db
    .prepare('SELECT id, name, email, branch, year, role FROM users WHERE id = ?')
    .get(req.user.id);
  if (!user) {
    return res.status(401).json({ message: 'Account not found' });
  }
  res.json({ user });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));