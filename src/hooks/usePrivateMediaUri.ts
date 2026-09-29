import { useEffect, useState } from 'react';
import {
  deletePrivateMedia,
  downloadPrivateMedia,
} from '../services/privateMedia';

export function usePrivateMediaUri(
  url?: string | null,
  token?: string | null
) {
  const [localUri, setLocalUri] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let downloadedUri = '';

    setLocalUri('');
    setError(null);

    if (!url || !token) {
      setLoading(false);
      return;
    }

    setLoading(true);

    async function load() {
      try {
        downloadedUri = await downloadPrivateMedia(url, token);

        if (cancelled) {
          await deletePrivateMedia(downloadedUri);
          return;
        }

        setLocalUri(downloadedUri);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'No se pudo cargar el archivo privado.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;

      if (downloadedUri) {
        void deletePrivateMedia(downloadedUri);
      }
    };
  }, [url, token]);

  return {
    localUri,
    loading,
    error,
  };
}
