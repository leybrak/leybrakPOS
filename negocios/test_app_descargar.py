"""
Link estable de descarga del APK (/api/app/descargar/) — pensado para
pegar en sitios externos (leybrak.com, en otro servidor) sin tener que
actualizarlo cada vez que sube una versión nueva: siempre redirige al
apk_url configurado en VersionApp en ese momento.
"""
from rest_framework.test import APITestCase

from negocios.models import VersionApp

URL = '/api/app/descargar/'


class DescargarApkTest(APITestCase):

    def test_redirige_al_apk_url_configurado(self):
        VersionApp.objects.create(
            plataforma='android', activa=True,
            apk_url='https://pos.leybrak.com/media/leybrak-1.0.21.apk')

        resp = self.client.get(URL)
        self.assertEqual(resp.status_code, 302)
        self.assertEqual(resp.url, 'https://pos.leybrak.com/media/leybrak-1.0.21.apk')

    def test_sigue_el_ultimo_apk_url_tras_actualizar_version(self):
        cfg = VersionApp.objects.create(
            plataforma='android', activa=True,
            apk_url='https://pos.leybrak.com/media/leybrak-1.0.21.apk')

        resp = self.client.get(URL)
        self.assertEqual(resp.url, 'https://pos.leybrak.com/media/leybrak-1.0.21.apk')

        # Se publica una versión nueva — el link estable debe seguirla sin
        # que nadie toque el sitio externo que lo referencia.
        cfg.apk_url = 'https://pos.leybrak.com/media/leybrak-1.0.22.apk'
        cfg.save()

        resp = self.client.get(URL)
        self.assertEqual(resp.status_code, 302)
        self.assertEqual(resp.url, 'https://pos.leybrak.com/media/leybrak-1.0.22.apk')

    def test_sin_config_cae_al_default(self):
        resp = self.client.get(URL)
        self.assertEqual(resp.status_code, 302)
        self.assertEqual(resp.url, 'https://pos.leybrak.com/media/leybrak.apk')

    def test_desactivado_cae_al_default(self):
        VersionApp.objects.create(
            plataforma='android', activa=False,
            apk_url='https://pos.leybrak.com/media/leybrak-1.0.21.apk')

        resp = self.client.get(URL)
        self.assertEqual(resp.status_code, 302)
        self.assertEqual(resp.url, 'https://pos.leybrak.com/media/leybrak.apk')

    def test_no_requiere_autenticacion(self):
        # Va en un sitio público, sin login.
        resp = self.client.get(URL)
        self.assertIn(resp.status_code, (301, 302))
