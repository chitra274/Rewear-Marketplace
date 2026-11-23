const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
export async function api(path, options = {}) {
  const token = localStorage.getItem('rewear_token');
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || 'Something went wrong.');
    error.status = response.status; error.code = data.error; throw error;
  }
  return data;
}
export const money = (cents) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(cents || 0) / 100);
export const imageFor = (item) => item?.image_url || 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=900&q=80';
