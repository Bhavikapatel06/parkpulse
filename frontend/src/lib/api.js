import axios from 'axios';

/**
 * Central axios instance for all API calls.
 *
 * - In development: baseURL is '' so Vite dev proxy routes /api/* → localhost:3000
 * - In production (Vercel): VITE_API_URL is set to the Render backend URL
 *   e.g. https://parkpulse-backend.onrender.com
 *
 * Set VITE_API_URL in Vercel's Environment Variables dashboard.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 75000, // 75 second timeout to accommodate Render/cloud free tier cold starts
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for unified error logging
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.error || error.message;
    console.error(`[API Error] ${status || 'Network'}: ${message}`);
    return Promise.reject(error);
  }
);

/**
 * Ping backend to check if the server is awake and healthy.
 */
export async function pingServer(customTimeout = 12000) {
  const base = import.meta.env.VITE_API_URL || '';
  try {
    const res = await axios.get(`${base}/api/health`, { timeout: customTimeout });
    return res.status === 200;
  } catch {
    try {
      const resMeta = await axios.get(`${base}/api/meta`, { timeout: customTimeout });
      return resMeta.status === 200;
    } catch {
      return false;
    }
  }
}

/**
 * Get active configured backend URL
 */
export function getBackendUrl() {
  return import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || '';
}

export default api;
