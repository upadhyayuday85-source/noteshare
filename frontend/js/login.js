// If already logged in, go to home
if (getToken()) {
  window.location.href = 'home.html';
}

const form = document.getElementById('loginForm');
const message = document.getElementById('message');
const submitBtn = document.getElementById('submitBtn');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  message.className = 'message';
  submitBtn.disabled = true;
  submitBtn.textContent = 'Logging in...';

  const body = {
    email: document.getElementById('email').value.trim(),
    password: document.getElementById('password').value,
  };

  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) {
      message.textContent = data.message;
      message.className = 'message error';
    } else {
      saveAuth(data.token, data.user);
      window.location.href = 'home.html';
      return;
    }
  } catch (err) {
    message.textContent = 'Cannot connect to the server. Please try again.';
    message.className = 'message error';
  }

  submitBtn.disabled = false;
  submitBtn.textContent = 'Log In';
});