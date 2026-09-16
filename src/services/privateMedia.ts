import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { API_BASE_URL, getFullUrl } from './api';

/**
 * Normaliza recursos privados antiguos para que siempre se consuman
 * mediante la API activa de SMART RH.
 */
export function getPrivateMediaUrl(url?: string | null) {
  if (!url) return '';

  const value = String(url).trim();
  if (!value) return '';

  const uploadsIndex = value.indexOf('/uploads/');

  if (uploadsIndex >= 0) {
    return `${API_BASE_URL}${value.slice(uploadsIndex)}`;
  }

  return getFullUrl(value);
}

function getExtension(url: string) {
  const cleanUrl = url.split('?')[0].split('#')[0];
  const match = cleanUrl.match(/\.([a-zA-Z0-9]{1,8})$/);

  return match ? `.${match[1].toLowerCase()}` : '.bin';
}

/**
 * Descarga un recurso privado utilizando el JWT del usuario y devuelve
 * una URI local file:// que React Native puede mostrar sin headers.
 */
export async function downloadPrivateMedia(
  url?: string | null,
  token?: string | null
) {
  if (!url) return '';
  if (!token) throw new Error('No hay sesión activa para cargar el archivo.');

  const remoteUrl = getPrivateMediaUrl(url);

  if (!remoteUrl) return '';

  if (!FileSystem.cacheDirectory) {
    throw new Error('No se pudo acceder a la caché local.');
  }

  const extension = getExtension(remoteUrl);

  const destination =
    `${FileSystem.cacheDirectory}smarth-private-` +
    `${Date.now()}-${Math.random().toString(36).slice(2)}` +
    extension;

  const result = await FileSystem.downloadAsync(
    remoteUrl,
    destination,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (result.status < 200 || result.status >= 300) {
    await FileSystem.deleteAsync(destination, { idempotent: true }).catch(() => {});
    throw new Error(`No se pudo descargar el archivo privado (${result.status}).`);
  }

  return result.uri;
}

export async function deletePrivateMedia(uri?: string | null) {
  if (!uri?.startsWith('file://')) return;

  await FileSystem.deleteAsync(uri, {
    idempotent: true,
  }).catch(() => {});
}

function getMimeType(url: string) {
  const cleanUrl = url.split('?')[0].split('#')[0].toLowerCase();

  if (cleanUrl.endsWith('.pdf')) return 'application/pdf';
  if (cleanUrl.endsWith('.png')) return 'image/png';
  if (cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (cleanUrl.endsWith('.webp')) return 'image/webp';

  return 'application/octet-stream';
}

export async function sharePrivateMedia(
  url?: string | null,
  token?: string | null,
  dialogTitle = 'SMART RH'
) {
  if (!url) {
    throw new Error('El archivo no está disponible.');
  }

  if (!token) {
    throw new Error('No hay una sesión activa.');
  }

  const sharingAvailable = await Sharing.isAvailableAsync();

  if (!sharingAvailable) {
    throw new Error(
      'Este dispositivo no permite abrir el archivo mediante el visor del sistema.'
    );
  }

  const localUri = await downloadPrivateMedia(url, token);

  try {
    await Sharing.shareAsync(localUri, {
      dialogTitle,
      mimeType: getMimeType(url),
    });
  } finally {
    await deletePrivateMedia(localUri);
  }
}
