// Not logged in? Go to login page
if (!getToken()) {
  window.location.href = 'login.html';
}

document.getElementById('logoutBtn').addEventListener('click', logout);

async function loadUser() {
  try {
    const res = await fetch(`${API_URL}/me`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });

    if (!res.ok) {
      // token invalid or expired
      logout();
      return;
    }

    const data = await res.json();
    document.getElementById('welcome').textContent = `Hi, ${data.user.name} 👋`;
  } catch (err) {
    document.getElementById('welcome').textContent = 'Server not reachable';
  }
}

loadUser();