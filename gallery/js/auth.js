// ═══ IVAE Gallery — Auth Guard ═══
async function checkAuth(requiredRole, silent) {
  try {
    const user = await API.get('/auth/me');
    window.currentUser = user;
    // Update header user name
    const el = document.getElementById('headerUser');
    if (el) el.textContent = user.name;
    // Check role
    if (requiredRole === 'admin' && user.role !== 'admin') {
      if (!silent) window.location.href = '/gallery/galleries.html';
      return null;
    }
    return user;
  } catch {
    if (!silent) window.location.href = '/gallery/';
    return null;
  }
}

async function logout() {
  try {
    await API.post('/auth/logout', {});
  } catch {} // even if logout API fails, redirect
  window.location.href = '/gallery/';
}
