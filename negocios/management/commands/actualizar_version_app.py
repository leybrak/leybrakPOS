# ============================================================
# actualizar_version_app.py
# Actualiza el registro VersionApp (control de versión de la app móvil) sin
# tener que entrar al Django admin a mano en cada release.
#
#   python manage.py actualizar_version_app --version-code 24 --version-name 1.0.23 \
#       --apk-url https://pos.leybrak.com/media/leybrak-1.0.23.apk
#
#   # Para forzar la actualización a TODOS los usuarios ya:
#   python manage.py actualizar_version_app --version-code 24 --version-name 1.0.23 \
#       --apk-url https://pos.leybrak.com/media/leybrak-1.0.23.apk --forzar
#
# Sin --forzar, version_code_minima NO se toca (la actualización queda
# disponible pero opcional). Con --forzar, version_code_minima pasa a valer
# --version-code y la pantalla bloqueante aparece para todos los que tengan
# una versión menor.
# ============================================================
from django.core.management.base import BaseCommand, CommandError

from negocios.models import VersionApp


class Command(BaseCommand):
    help = 'Actualiza (o crea) el registro VersionApp de Android sin pasar por el admin.'

    def add_arguments(self, parser):
        parser.add_argument('--version-code', type=int, required=True,
                            help='versionCode del nuevo APK (debe coincidir con build.gradle / version.js).')
        parser.add_argument('--version-name', type=str, required=True,
                            help='versionName del nuevo APK, ej. 1.0.23.')
        parser.add_argument('--apk-url', type=str, required=True,
                            help='URL pública del APK subido (usar nombre versionado, no leybrak.apk a secas).')
        parser.add_argument('--forzar', action='store_true',
                            help='Sube version_code_minima al mismo valor de --version-code (fuerza el update a todos).')
        parser.add_argument('--notas', type=str, default=None,
                            help='Texto de "qué hay de nuevo" para la pantalla de actualización.')
        parser.add_argument('--plataforma', type=str, default='android')

    def handle(self, *args, **opts):
        version_code = opts['version_code']
        version_name = opts['version_name']
        apk_url = opts['apk_url']
        plataforma = opts['plataforma']

        if not apk_url.rstrip('/').endswith(version_name) and version_name not in apk_url:
            self.stdout.write(self.style.WARNING(
                f'Aviso: la URL "{apk_url}" no parece incluir la versión "{version_name}" en el nombre. '
                'Si reusaste el mismo nombre de archivo que la versión anterior, Cloudflare puede seguir '
                'sirviendo el APK viejo desde caché (ver Gotcha #5 en CLAUDE.md).'
            ))

        registro, creado = VersionApp.objects.get_or_create(plataforma=plataforma)

        registro.version_name_ultima = version_name
        registro.apk_url = apk_url
        if opts['notas'] is not None:
            registro.notas = opts['notas']
        if opts['forzar']:
            registro.version_code_minima = version_code
        registro.activa = True
        registro.save()

        accion = 'Creado' if creado else 'Actualizado'
        self.stdout.write(self.style.SUCCESS(
            f'{accion} VersionApp[{plataforma}]: version_name_ultima={version_name}, '
            f'apk_url={apk_url}, version_code_minima={registro.version_code_minima}'
            f'{" (FORZADO a todos)" if opts["forzar"] else " (actualización opcional, sin forzar)"}'
        ))
