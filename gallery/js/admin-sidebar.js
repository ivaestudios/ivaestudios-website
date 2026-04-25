// IVAE Gallery — Admin Sidebar Partial
// Renders the shared admin sidebar (logo, search, gallery list, bottom-nav, footer)
// Used by /admin/index.html, /admin/galleries.html, /admin/clients.html,
//   /admin/proofs.html, /admin/settings.html.
//
// Usage:
//   <script src="/gallery/js/api.js"></script>
//   <script src="/gallery/js/auth.js"></script>
//   <script src="/gallery/js/admin-sidebar.js"></script>
//   <script>renderAdminSidebar({ active: 'galleries' });</script>

(function () {
  'use strict';

  // Bottom-nav configuration. `key` matches the `active` arg.
  const BOTTOM_NAV = [
    { key: 'dashboard', href: '/gallery/admin/',               label: 'Dashboard' },
    { key: 'galleries', href: '/gallery/admin/galleries', label: 'Galleries' },
    { key: 'clients',   href: '/gallery/admin/clients',   label: 'Clients'   },
    { key: 'workflow',  href: '/gallery/admin/proofs',    label: 'Workflow'  },
    { key: 'activity',  href: '/gallery/admin/activity',  label: 'Activity'  },
    { key: 'settings',  href: '/gallery/admin/settings',  label: 'Settings'  }
  ];

  // Small HTML-escape helper to keep injected gallery titles safe.
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Build the sidebar's inner HTML string. Mirrors the markup in
  // /admin/index.html lines 247-272.
  function buildSidebarHtml(active) {
    const navLinks = BOTTOM_NAV.map(item => {
      const cls = 'sidebar-bottom-link' + (item.key === active ? ' active' : '');
      return '<a href="' + item.href + '" class="' + cls + '">' + item.label + '</a>';
    }).join('');

    return ''
      + '<div class="sidebar-logo">'
      +   '<a href="/gallery/admin/">IVAE <span>Studios</span></a>'
      + '</div>'
      + '<nav class="sidebar-nav">'
      +   '<a href="/gallery/admin/gallery-new" class="sidebar-new-btn">+ New Client Gallery</a>'
      +   '<div class="sidebar-search">'
      +     '<input type="text" placeholder="Search..." id="searchInput" />'
      +     '<svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">'
      +       '<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/>'
      +     '</svg>'
      +   '</div>'
      +   '<div class="sidebar-galleries" id="sidebarGalleries"></div>'
      + '</nav>'
      + '<div class="sidebar-bottom-nav">' + navLinks + '</div>'
      + '<div class="sidebar-footer">'
      +   '<div class="sidebar-user" id="sidebarUser"></div>'
      +   '<a href="#" class="sidebar-logout" id="sidebarLogout">Logout</a>'
      + '</div>';
  }

  // Render gallery items into the #sidebarGalleries container.
  function renderGalleryList(galleries) {
    const list = document.getElementById('sidebarGalleries');
    if (!list) return;
    list.innerHTML = '';
    galleries.forEach(g => {
      const item = document.createElement('a');
      item.href = '/gallery/admin/gallery-edit?id=' + encodeURIComponent(g.id);
      item.className = 'sidebar-gallery-item';
      const color = g.status === 'published' ? '#34c759' : '#ddd';
      const dot = '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:'
        + color + ';margin-right:8px;flex-shrink:0;"></span>';
      item.innerHTML = dot + esc(g.title);
      list.appendChild(item);
    });
  }

  // Filter rendered items by title substring (matches index.html's pattern).
  function filterSidebarGalleries(q) {
    const items = document.querySelectorAll('.sidebar-gallery-item');
    const needle = String(q || '').toLowerCase();
    items.forEach(el => {
      el.style.display = el.textContent.toLowerCase().includes(needle) ? 'block' : 'none';
    });
  }

  // Default logout: prefer page-defined window.logout(); fall back to a
  // direct API call so the sidebar works on pages that haven't wired auth.
  function defaultLogout() {
    if (typeof window.logout === 'function') {
      try { window.logout(); return; } catch (_) { /* fall through */ }
    }
    const done = () => { window.location.href = '/gallery/'; };
    if (window.API && typeof window.API.post === 'function') {
      window.API.post('/auth/logout', {}).then(done, done);
    } else {
      fetch('/api/gallery/auth/logout', { method: 'POST', credentials: 'same-origin' })
        .then(done, done);
    }
  }

  // Main entry point. Idempotent — safe to call multiple times.
  function renderAdminSidebar(opts) {
    const active = (opts && opts.active) || '';
    const layout = document.querySelector('.admin-layout');
    if (!layout) {
      console.warn('[admin-sidebar] no .admin-layout found — sidebar not rendered');
      return;
    }

    // Find existing sidebar or create a new one as the first child of layout.
    let sidebar = document.getElementById('sidebar');
    if (!sidebar) {
      sidebar = document.createElement('aside');
      sidebar.className = 'admin-sidebar';
      sidebar.id = 'sidebar';
      layout.insertBefore(sidebar, layout.firstChild);
    }
    sidebar.innerHTML = buildSidebarHtml(active);

    // Wire search input.
    const search = document.getElementById('searchInput');
    if (search) search.oninput = (e) => filterSidebarGalleries(e.target.value);

    // Set the user name if the page already populated it.
    const userEl = document.getElementById('sidebarUser');
    if (userEl && window.__adminUser) {
      userEl.textContent = window.__adminUser.name || window.__adminUser.email || '';
    }

    // Wire logout link.
    const logoutLink = document.getElementById('sidebarLogout');
    if (logoutLink) {
      logoutLink.onclick = (e) => { e.preventDefault(); defaultLogout(); };
    }

    // Wire mobile toggle button if the page provides one.
    const toggle = document.getElementById('sidebarToggle');
    if (toggle) {
      toggle.onclick = () => sidebar.classList.toggle('open');
    }

    // Fetch and render the gallery list.
    const onError = (err) => console.warn('[admin-sidebar] failed to load galleries:', err);
    if (window.API && typeof window.API.get === 'function') {
      window.API.get('/galleries').then(renderGalleryList, onError);
    } else {
      fetch('/api/gallery/galleries', { credentials: 'same-origin' })
        .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
        .then(renderGalleryList, onError);
    }
  }

  // Expose globally — no module system in this project.
  window.renderAdminSidebar = renderAdminSidebar;
})();
