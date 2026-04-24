// ═══ IVAE Gallery — API Helper ═══
const API = {
  timeout: 30000, // 30s default timeout

  async request(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch('/api/gallery' + path, {
        ...options,
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...options.headers },
        credentials: 'same-origin'
      });
      clearTimeout(timer);

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data.error || (res.status === 401 ? 'Please sign in again' :
                     res.status === 403 ? 'You don\'t have permission' :
                     res.status === 404 ? 'Not found' :
                     res.status >= 500 ? 'Server error — please try again' :
                     'Something went wrong');
        throw new Error(msg);
      }
      return data;
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') throw new Error('Request timed out — please try again');
      if (err instanceof TypeError && err.message.includes('fetch')) throw new Error('Network error — check your connection');
      throw err;
    }
  },
  get(path) { return this.request(path); },
  post(path, body) { return this.request(path, { method: 'POST', body: JSON.stringify(body) }); },
  put(path, body) { return this.request(path, { method: 'PUT', body: JSON.stringify(body) }); },
  del(path) { return this.request(path, { method: 'DELETE' }); },

  async upload(path, formData, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/gallery' + path);
      xhr.withCredentials = true;
      xhr.timeout = 600000; // 10 min — handles large files on slow connections
      if (onProgress) xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
      xhr.onload = () => {
        let data = null;
        try { data = JSON.parse(xhr.responseText); } catch { data = null; }
        if (xhr.status >= 200 && xhr.status < 300) {
          if (data) resolve(data);
          else resolve({ ok: true }); // Handle 204 / empty 2xx responses
        } else {
          const msg = (data && data.error) ? data.error : ('Upload failed (' + xhr.status + ')');
          console.error('[API.upload] HTTP ' + xhr.status, xhr.responseText?.slice(0, 500));
          reject(new Error(msg));
        }
      };
      xhr.onerror = () => { console.error('[API.upload] network error'); reject(new Error('Network error — check your connection')); };
      xhr.ontimeout = () => reject(new Error('Upload timed out — file may be too large'));
      xhr.upload.onerror = () => { console.error('[API.upload] upload-phase network error'); };
      xhr.send(formData);
    });
  }
};

function showToast(msg, duration = 3000) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), duration);
}
