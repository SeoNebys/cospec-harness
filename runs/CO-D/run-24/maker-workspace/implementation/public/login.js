'use strict';
// Sign-in page logic (SCN-011). On success, go to the app.
const form = document.getElementById('loginForm');
const errEl = document.getElementById('loginError');
document.getElementById('loginHint').textContent =
  'Review account: me@bookmarks.local / bookmarks';

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errEl.hidden = true;
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) { window.location.href = '/'; return; }
    const data = await res.json().catch(() => ({}));
    errEl.textContent = data.message || 'Sign in failed.';
    errEl.hidden = false;
  } catch (err) {
    errEl.textContent = 'Could not reach the server.';
    errEl.hidden = false;
  }
});

// Pre-fill review credentials for convenience.
document.getElementById('email').value = 'me@bookmarks.local';
document.getElementById('password').value = 'bookmarks';
document.body.setAttribute('data-harness-ready', 'true');
