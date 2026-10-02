const db = require('./db');

const email = process.argv[2];
if (!email) {
  console.log('Usage: node makeAdmin.js user@example.com');
  process.exit(1);
}

const result = db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run(email);
console.log(result.changes ? `${email} is now an admin` : 'No user found with that email');