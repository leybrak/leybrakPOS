# ============================================================
# views/app_version_views.py
# Endpoint público que la app móvil consulta al abrir para saber
# si debe forzar una actualización.
# ============================================================
from django.shortcuts import redirect
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(['GET'])
@permission_classes([AllowAny])
def app_version(request):
    """
    Devuelve la info de versión de la app Android.
    La app compara su versionCode con `version_code_minima`:
    si es menor y `forzar=True`, muestra la pantalla bloqueante de actualización.
    """
    from ..models import VersionApp

    cfg = VersionApp.objects.filter(plataforma='android').first()

    if not cfg or not cfg.activa:
        # Sin config o desactivado → nunca se fuerza
        return Response({
            'forzar': False,
            'version_code_minima': 0,
            'version_ultima': '1.0.0',
            'apk_url': 'https://pos.leybrak.com/media/leybrak.apk',
            'notas': '',
        })

    return Response({
        'forzar': True,
        'version_code_minima': cfg.version_code_minima,
        'version_ultima': cfg.version_name_ultima,
        'apk_url': cfg.apk_url,
        'notas': cfg.notas or '',
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def descargar_apk(request):
    """
    Link ESTABLE para poner en sitios externos (ej. leybrak.com, que vive
    en otro servidor) — redirige siempre al APK más reciente configurado
    en VersionApp. El nombre del .apk cambia con cada versión (por la
    caché de Cloudflare), así que un link directo al archivo se vuelve
    viejo con cada release; este no, porque resuelve el destino en cada
    click en vez de tenerlo hardcodeado en el sitio externo.
    """
    from ..models import VersionApp

    cfg = VersionApp.objects.filter(plataforma='android').first()
    apk_url = cfg.apk_url if (cfg and cfg.activa and cfg.apk_url) else 'https://pos.leybrak.com/media/leybrak.apk'
    return redirect(apk_url)
