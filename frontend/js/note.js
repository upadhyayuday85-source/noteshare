if (!getToken()) {
  window.location.href = 'login.html';
}

document.getElementById('logoutBtn').addEventListener('click', logout);

const noteId = new URLSearchParams(window.location.search).get('id');
if (!noteId) {
  window.location.href = 'home.html';
}

let me = JSON.parse(localStorage.getItem('user') || 'null');
let noteFileName = 'note';

// helper: call the API with the login token
async function api(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
  });
  if (res.status === 401) {
    logout();
    throw new Error('Please log in again');
  }
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Something went wrong');
  }
  return data;
}

// refresh the user (and role) from the server
async function refreshMe() {
  try {
    const data = await api('/me');
    me = data.user;
    localStorage.setItem('user', JSON.stringify(me));
  } catch (err) {
    // keep the saved user
  }
}

// helper: create an element safely (textContent, never innerHTML)
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function showMessage(text, type) {
  const box = document.getElementById('doubtMessage');
  box.textContent = text;
  box.className = `message ${type}`;
}

// ---------- NOTE DETAILS ----------
async function loadNote() {
  try {
    const { note } = await api(`/notes/${noteId}`);
    noteFileName = note.original_name;

    document.title = `${note.title} - NoteShare`;
    document.getElementById('noteTitle').textContent = note.title;
    document.getElementById('noteDesc').textContent = note.description || '';
    document.getElementById('noteMeta').textContent =
      `Uploaded by ${note.uploaded_by_name} on ${note.created_at.split(' ')[0]}`;

    const tags = document.getElementById('noteTags');
    [note.subject, note.branch, `Sem ${note.semester}`].forEach((t) => tags.appendChild(el('span', 'tag', t)));
  } catch (err) {
    document.getElementById('noteTitle').textContent = err.message;
  }
}

document.getElementById('downloadBtn').addEventListener('click', async () => {
  try {
    const res = await fetch(`${API_URL}/notes/${noteId}/file`, {
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
    a.download = noteFileName;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert('Could not connect to the server.');
  }
});

// ---------- DOUBTS ----------
async function loadDoubts() {
  const list = document.getElementById('doubtsList');
  try {
    const { doubts } = await api(`/notes/${noteId}/doubts`);
    document.getElementById('doubtCount').textContent = doubts.length;
    list.innerHTML = '';

    if (doubts.length === 0) {
      list.appendChild(el('p', 'muted', 'No doubts yet. Ask the first one!'));
      return;
    }
    doubts.forEach((d) => list.appendChild(renderDoubt(d)));
  } catch (err) {
    list.textContent = err.message;
  }
}

function renderDoubt(d) {
  const card = el('div', 'doubt-card');

  const head = el('div', 'doubt-head');
  head.appendChild(el('strong', '', d.user_name));
  head.appendChild(el('span', 'meta', d.created_at.split(' ')[0]));
  if (d.is_solved) head.appendChild(el('span', 'solved-badge', 'Solved'));
  card.appendChild(head);

  card.appendChild(el('p', 'doubt-question', d.question));

  // replies
  if (d.replies.length > 0) {
    const replies = el('div', 'replies');
    d.replies.forEach((r) => {
      const item = el('div', 'reply');
      const rhead = el('div', 'doubt-head');
      rhead.appendChild(el('strong', '', r.user_name));
      rhead.appendChild(el('span', 'meta', r.created_at.split(' ')[0]));
      item.appendChild(rhead);
      item.appendChild(el('p', '', r.answer));
      replies.appendChild(item);
    });
    card.appendChild(replies);
  }

  // reply form
  const form = el('form', 'reply-form');
  const input = el('input');
  input.type = 'text';
  input.placeholder = 'Write a reply...';
  input.maxLength = 1000;
  input.required = true;
  const sendBtn = el('button', 'inline-btn', 'Reply');
  sendBtn.type = 'submit';
  form.appendChild(input);
  form.appendChild(sendBtn);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api(`/doubts/${d.id}/replies`, {
        method: 'POST',
        body: JSON.stringify({ answer: input.value }),
      });
      loadDoubts();
    } catch (err) {
      alert(err.message);
    }
  });
  card.appendChild(form);

  // asker can mark solved; asker or admin can delete
  const isAsker = me && me.id === d.user_id;
  const isAdmin = me && me.role === 'admin';

  if (isAsker || isAdmin) {
    const actions = el('div', 'card-actions');

    if (isAsker) {
      const solveBtn = el('button', 'solve-btn', d.is_solved ? 'Mark as unsolved' : 'Mark as solved');
      solveBtn.addEventListener('click', async () => {
        try {
          await api(`/doubts/${d.id}/solved`, { method: 'PATCH' });
          loadDoubts();
        } catch (err) {
          alert(err.message);
        }
      });
      actions.appendChild(solveBtn);
    }

    const delBtn = el('button', 'delete-btn', 'Delete doubt');
    delBtn.addEventListener('click', async () => {
      if (!confirm('Delete this doubt and all its replies?')) return;
      try {
        await api(`/doubts/${d.id}`, { method: 'DELETE' });
        loadDoubts();
      } catch (err) {
        alert(err.message);
      }
    });
    actions.appendChild(delBtn);

    card.appendChild(actions);
  }

  return card;
}

// post a new doubt
document.getElementById('doubtForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const question = document.getElementById('question');
  const btn = document.getElementById('doubtBtn');
  btn.disabled = true;

  try {
    await api(`/notes/${noteId}/doubts`, {
      method: 'POST',
      body: JSON.stringify({ question: question.value }),
    });
    question.value = '';
    showMessage('', '');
    loadDoubts();
  } catch (err) {
    showMessage(err.message, 'error');
  }
  btn.disabled = false;
});

// get the latest role first, then load the page
refreshMe().then(() => {
  loadNote();
  loadDoubts();
});
refreshMe().then(() => {
  loadNote();
  loadDoubts();
});