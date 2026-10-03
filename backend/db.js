const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing. Add it to backend/.env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      branch TEXT,
      year INTEGER,
      role TEXT NOT NULL DEFAULT 'student',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      subject TEXT NOT NULL,
      branch TEXT NOT NULL,
      semester INTEGER NOT NULL,
      description TEXT,
      file_public_id TEXT NOT NULL,
      original_name TEXT NOT NULL,
      uploaded_by INTEGER NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS doubts (
      id SERIAL PRIMARY KEY,
      note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      question TEXT NOT NULL,
      is_solved BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS replies (
      id SERIAL PRIMARY KEY,
      doubt_id INTEGER NOT NULL REFERENCES doubts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      answer TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

module.exports = {
  pool,
  init,
  query: (text, params) => pool.query(text, params),
};