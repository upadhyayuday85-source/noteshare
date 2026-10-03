require('dotenv').config();
const db = require('./db');

const email = (process.argv[2] || '').trim().toLowerCase();
if (!email) {
  console.log('Usage: node makeAdmin.js user@example.com');
  process.exit(1);
}

(async () => {
  await db.init();
  const result = await db.query("UPDATE users SET role = 'admin' WHERE email = $1", [email]);
  console.log(result.rowCount ? `${email} is now an admin` : 'No user found with that email');
  await db.pool.end();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});