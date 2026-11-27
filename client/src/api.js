const TOKEN_KEY = 'lyf_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
};

const ROLE_KEY = 'lyf_role';
export const getRole = () => localStorage.getItem(ROLE_KEY) || 'planner';
export const setRole = (r) => localStorage.setItem(ROLE_KEY, r);

export const homeFor = (role) => (role === 'admin' ? '/admin' : role === 'vendor' ? '/vendor' : '/');

export function signIn({ token, user }) {
  setToken(token);
  setRole(user.role);
  return homeFor(user.role);
}

export const whatsappLink = (phone, text = '') =>
  `https://wa.me/${String(phone || '').replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) clearToken();
    throw new Error(data.error || 'Something went wrong. Try again.');
  }
  return data;
}

// Uploads use XMLHttpRequest because fetch can't report upload progress, and videos take a while on mobile data.
export function apiUpload(path, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api${path}`);
    if (getToken()) xhr.setRequestHeader('Authorization', `Bearer ${getToken()}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* non-JSON error page */
      }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(data);
      if (xhr.status === 401) clearToken();
      reject(new Error(data.error || 'Upload failed. Try again.'));
    };
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'));
    const form = new FormData();
    form.append('file', file, file.name);
    xhr.send(form);
  });
}

export const naira =(n) => `₦${Number(n || 0).toLocaleString('en-NG')}`;
