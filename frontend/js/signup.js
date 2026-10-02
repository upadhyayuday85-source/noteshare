// If already logged in, go to home
if (getToken()) {
  window.location.href = 'home.html';
}

const form = document.getElementById('signupForm');
const message = document.getElementById('message');
const submitBtn = document.getElementById('submitBtn');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  message.className = 'message';
  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating account...';

  const body = {
    name: document.getElementById('name').value.trim(),
    email: document.getElementById('email').value.trim(),
    password: document.getElementById('password').value,
    branch: document.getElementById('branch').value,
    year: Number(document.getElementById('year').value),
  };

  try {
    const res = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) {
      message.textContent = data.message;
      message.className = 'message error';
    } else {
      message.textContent = 'Account created! Redirecting to login...';
      message.className = 'message success';
      setTimeout(() => (window.location.href = 'login.html'), 1200);
    }
  } catch (err) {
    message.textContent = 'Cannot connect to the server. Please try again.';
    message.className = 'message error';
  }

  submitBtn.disabled = false;
  submitBtn.textContent = 'Sign Up';
});