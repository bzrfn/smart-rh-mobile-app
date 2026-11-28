"""Valida que las compilaciones internas utilicen una API aislada."""
import json
import sys
from pathlib import Path
from urllib.parse import urlsplit


def validate(data, profile):
    seen = set(); config = {}; current = profile
    while current:
        if current in seen: raise ValueError('Herencia circular en eas.json')
        seen.add(current)
        item = data.get('build', {}).get(current)
        if not isinstance(item, dict): raise ValueError('Perfil no encontrado')
        config = {**item.get('env', {}), **config}
        current = item.get('extends')
    parsed = urlsplit(config.get('EXPO_PUBLIC_API_URL', ''))
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('El perfil debe declarar una URL HTTPS de API válida')
    production = parsed.hostname.lower() == 'api.smart-rh.com.mx'
    if profile != 'production' and (production or parsed.hostname in ('localhost', '127.0.0.1') or parsed.hostname.endswith('.invalid')):
        raise ValueError('El perfil interno necesita una API aislada')
    if profile == 'production' and not production:
        raise ValueError('La URL de producción no coincide con SMART RH')
    return parsed.hostname


if __name__ == '__main__':
    try:
        validate(json.loads(Path('eas.json').read_text()), sys.argv[1])
        print('PERFIL_EAS=OK')
    except (ValueError, IndexError):
        raise SystemExit('PERFIL_EAS=ERROR; configura la URL de API del perfil seleccionado')
