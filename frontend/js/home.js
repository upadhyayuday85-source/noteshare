function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('user'));
  } catch (e) {
    return null;
  }
} if (!getToken()) {
  window.location.href = 'login.html';
}

document.getElementById('logoutBtn').addEventListener('click', logout);

const notesList = document.getElementById('notesList');
const searchInput = document.getElementById('search');
const branchSelect = document.getElementById('filterBranch');
const semesterSelect = document.getElementById('filterSemester');

async function loadUser() {
  try {
    const res = await fetch(`${API_URL}/me`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) {
      logout();
      return;
    }
    const data = await res.json();
        localStorage.setItem('user', JSON.stringify(data.user));
    document.getElementById('welcome').textContent = `Hi, ${data.user.name} 👋`;
  } catch (err) {
    document.getElementById('welcome').textContent = 'Server not reachable';
  }
}

async function loadNotes() {
  const params = new URLSearchParams();
  if (searchInput.value.trim()) params.append('search', searchInput.value.trim());
  if (branchSelect.value) params.append('branch', branchSelect.value);
  if (semesterSelect.value) params.append('semester', semesterSelect.value);

  try {
    const res = await fetch(`${API_URL}/notes?${params.toString()}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.status === 401) {
      logout();
      return;
    }
    const data = await res.json();
    renderNotes(data.notes);
  } catch (err) {
    notesList.textContent = 'Could not load notes. Is the server running?';
  }
}

function renderNotes(notes) {
  notesList.innerHTML = '';

  if (notes.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No notes found. Be the first to upload one!';
    notesList.appendChild(empty);
    return;
  }

  notes.forEach((note) => {
    const card = document.createElement('div');
    card.className = 'note-card';

    const title = document.createElement('h3');
    title.textContent = note.title;

    const tags = document.createElement('div');
    tags.className = 'tags';
    [note.subject, note.branch, `Sem ${note.semester}`].forEach((text) => {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = text;
      tags.appendChild(tag);
    });

    card.appendChild(title);
    card.appendChild(tags);

    if (note.description) {
      const desc = document.createElement('p');
      desc.className = 'muted';
      desc.textContent = note.description;
      card.appendChild(desc);
    }

    const meta = document.createElement('p');
    meta.className = 'meta';
    meta.textContent = `Uploaded by ${note.uploaded_by_name} on ${note.created_at.split(' ')[0]}`;
    card.appendChild(meta);

        const actions = document.createElement('div');
    actions.className = 'card-actions';

    const btn = document.createElement('button');
    btn.className = 'download-btn';
    btn.textContent = 'Download';
    btn.addEventListener('click', () => downloadNote(note.id, note.original_name));
        const viewBtn = document.createElement('a');
    viewBtn.className = 'view-btn';
    viewBtn.textContent = 'Doubts';
    viewBtn.href = `note.html?id=${note.id}`;
    actions.appendChild(viewBtn);
    actions.appendChild(btn);


    // delete button only for the person who uploaded this note
    const me = getCurrentUser();
        if (me && (me.id === note.uploaded_by || me.role === 'admin')) {
      const delBtn = document.createElement('button');
      delBtn.className = 'delete-btn';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => deleteNote(note.id));
      actions.appendChild(delBtn);
    }

    card.appendChild(actions);

    notesList.appendChild(card);
  });
}

// files need the login token, so we fetch them and save as a blob
async function downloadNote(id, fileName) {
  try {
    const res = await fetch(`${API_URL}/notes/${id}/file`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) {
      alert('Could not download this file.');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert('Could not connect to the server.');
  }
}

let searchTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadNotes, 300);
});
branchSelect.addEventListener('change', loadNotes);
semesterSelect.addEventListener('change', loadNotes);

loadUser();
loadNotes();
async function deleteNote(id) {
  if (!confirm('Delete this note? This cannot be undone.')) return;

  try {
    const res = await fetch(`${API_URL}/notes/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const data = await res.json();

    if (res.status === 401) {
      logout();
      return;
    }
    if (!res.ok) {
      alert(data.message);
      return;
    }
    loadNotes(); // refresh the list
  } catch (err) {
    alert('Could not connect to the server.');
  }
}
loadUser().then(loadNotes);