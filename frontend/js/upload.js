if (!getToken()) {
  window.location.href = 'login.html';
}

document.getElementById('logoutBtn').addEventListener('click', logout);

const form = document.getElementById('uploadForm');
const message = document.getElementById('message');
const submitBtn = document.getElementById('submitBtn');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  message.className = 'message';
  submitBtn.disabled = true;
  submitBtn.textContent = 'Uploading...';

  const formData = new FormData();
  formData.append('title', document.getElementById('title').value.trim());
  formData.append('subject', document.getElementById('subject').value.trim());
  formData.append('branch', document.getElementById('branch').value);
  formData.append('semester', document.getElementById('semester').value);
  formData.append('description', document.getElementById('description').value.trim());
  formData.append('file', document.getElementById('file').files[0]);

  try {
    // do NOT set Content-Type here, the browser sets it for file uploads
    const res = await fetch(`${API_URL}/notes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    });
    const data = await res.json();

    if (res.status === 401) {
      logout();
      return;
    }

    if (!res.ok) {
      message.textContent = data.message;
      message.className = 'message error';
    } else {
      message.textContent = 'Note uploaded successfully! Redirecting...';
      message.className = 'message success';
      form.reset();
      setTimeout(() => (window.location.href = 'home.html'), 1200);
    }
  } catch (err) {
    message.textContent = 'Cannot connect to the server. Please try again.';
    message.className = 'message error';
  }

  submitBtn.disabled = false;
  submitBtn.textContent = 'Upload';
});