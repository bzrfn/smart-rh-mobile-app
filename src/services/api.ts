import axios from 'axios';

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

if (!configuredApiUrl) {
  throw new Error(
    'EXPO_PUBLIC_API_URL no está configurada. Define la URL del backend en el archivo .env.'
  );
}

export const API_BASE_URL = configuredApiUrl.replace(/\/+$/, '');

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

let onUnauthorized: (() => void) | null = null;

export function registerUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const message = error?.response?.data?.message;

    if (
      status === 401 &&
      ['Invalid token', 'Missing token', 'Token inválido', 'Token requerido'].includes(message)
    ) {
      onUnauthorized?.();
    }

    return Promise.reject(error);
  }
);

export function getFullUrl(url?: string | null) {
  if (!url) return '';
  return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
}