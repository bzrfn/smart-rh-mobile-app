export const CREDENTIAL_QR_TYPE =
  'CREDENCIAL_SMART_RH';

export type CredentialQrPayload = {
  tipo: string;
  token: string;
};

export type CredentialVerificationResult = {
  valida: boolean;
  estado: string;
  empleado?: {
    codigo: string;
    nombre: string;
    rol: string;
  };
  vigencia?: string;
};

export function parseCredentialQr(
  rawValue: string
): CredentialQrPayload | null {
  try {
    const parsed =
      JSON.parse(
        String(rawValue || '').trim()
      );

    if (
      parsed?.tipo !==
      CREDENTIAL_QR_TYPE
    ) {
      return null;
    }

    const token =
      String(
        parsed?.token || ''
      ).trim();

    if (
      !/^[a-f0-9]{64}$/i.test(
        token
      )
    ) {
      return null;
    }

    return {
      tipo:
        CREDENTIAL_QR_TYPE,
      token,
    };
  } catch {
    return null;
  }
}

export function formatCredentialValidity(
  value?: string
): string {
  if (!value) {
    return 'No disponible';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return 'No disponible';
  }

  return date.toLocaleDateString(
    'es-MX',
    {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }
  );
}
