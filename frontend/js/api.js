const API_URL = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  ? 'http://localhost:5000/api'
  : 'https://YOUR-RENDER-URL.onrender.com/api';

function saveAuth(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

function getToken() {
  return localStorage.getItem('token');
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'login.html';
}