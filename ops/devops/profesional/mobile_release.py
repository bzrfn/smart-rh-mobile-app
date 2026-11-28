"""Valida el resultado de EAS y relaciona binarios con la revisión solicitada."""
import argparse
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlsplit


def summarize(source, revision, expected_platform):
    if not re.fullmatch('[0-9a-f]{40}', revision):
        raise ValueError('Commit inválido')
    records = json.loads(source.read_text())
    if isinstance(records, dict): records = [records]
    if not isinstance(records, list) or not records:
        raise ValueError('EAS no devolvió compilaciones')
    expected = {'ANDROID', 'IOS'} if expected_platform == 'all' else {expected_platform.upper()}
    observed = set(); clean = []
    for item in records:
        plat = item.get('platform')
        if plat not in expected or plat in observed or item.get('status') != 'FINISHED':
            raise ValueError('Compilación incompleta o inesperada')
        if item.get('gitCommitHash') != revision:
            raise ValueError('EAS no confirmó la misma revisión de Git')
        build_id = item.get('id', '')
        if not re.fullmatch('[0-9a-f-]{36}', build_id):
            raise ValueError('Identificador de compilación inválido')
        url = item.get('artifacts', {}).get('buildUrl') or item.get('artifacts', {}).get('applicationArchiveUrl')
        parsed = urlsplit(url or '')
        if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError('Falta el artefacto de la compilación')
        clean.append({'id': build_id, 'platform': plat, 'revision': revision, 'artifact_url': url,
                      'app_version': item.get('appVersion'), 'build_version': item.get('appBuildVersion')})
        observed.add(plat)
    if expected != observed: raise ValueError('Falta una plataforma solicitada')
    target = source.with_name('mobile-release.json')
    target.write_text(json.dumps({'schema': 1, 'builds': clean,
                                'eas_response_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                                'store_submission': 'No enviada por este flujo'}, indent=2) + '\n')
    print('COMPILACION_NATIVA=OK; ENVIO_A_TIENDAS=PENDIENTE')


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('response', type=Path); p.add_argument('revision')
    p.add_argument('platform', choices=['all', 'ios', 'android'])
    a = p.parse_args(); summarize(a.response, a.revision, a.platform)
