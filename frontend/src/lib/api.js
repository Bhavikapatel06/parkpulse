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
  timeout: 30000, // 30 second timeout for normal calls
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

export default api;
