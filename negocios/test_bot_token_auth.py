"""
BotTokenAuthentication: el bot de WhatsApp (n8n) se autentica con X-Bot-Token +
sede_id en vez de un JWT atado a un solo negocio. El token NO es un secreto
global — es Sede.bot_token, propio de cada sede — porque un secreto global
compartido dejaría autenticarse como CUALQUIER sede con solo pasar su
sede_id (justo el bug que estas pruebas habrían atrapado en el diseño
anterior). Estas pruebas usan el header real (no force_authenticate) para
validar la capa de autenticación en sí, y confirman que las protecciones
anti-IDOR ya existentes en las vistas siguen funcionando con esta nueva
fuente de identidad.
"""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from negocios.models import Negocio, Sede, Orden


class BotTokenAuthenticationTest(APITestCase):

    def setUp(self):
        self.user_a = User.objects.create_user(username='duenoA', password='x')
        self.negocio_a = Negocio.objects.create(
            propietario=self.user_a, nombre='Negocio A',
            fin_prueba=timezone.now() + timedelta(days=30))
        self.sede_a = Sede.objects.create(negocio=self.negocio_a, nombre='Sede A')
        self.orden_a = Orden.objects.create(
            sede=self.sede_a, tipo='salon', estado_pago='pendiente',
            total=Decimal('20'), cliente_telefono='987654321')

        self.user_b = User.objects.create_user(username='duenoB', password='x')
        self.negocio_b = Negocio.objects.create(
            propietario=self.user_b, nombre='Negocio B',
            fin_prueba=timezone.now() + timedelta(days=30))
        self.sede_b = Sede.objects.create(negocio=self.negocio_b, nombre='Sede B')
        self.orden_b = Orden.objects.create(
            sede=self.sede_b, tipo='salon', estado_pago='pendiente',
            total=Decimal('30'), cliente_telefono='912345678')

        # save() genera bot_token solo si estaba vacío — confirmamos que quedó set.
        self.sede_a.refresh_from_db()
        self.sede_b.refresh_from_db()
        self.assertTrue(self.sede_a.bot_token)
        self.assertTrue(self.sede_b.bot_token)
        self.assertNotEqual(self.sede_a.bot_token, self.sede_b.bot_token)

    def _get(self, sede_id, token, telefono='987654321'):
        headers = {'HTTP_X_BOT_TOKEN': token} if token is not None else {}
        return self.client.get(
            '/api/ordenes/estado_orden_bot/',
            {'sede_id': sede_id, 'telefono': telefono},
            **headers,
        )

    def test_token_de_su_propia_sede_responde_200(self):
        r = self._get(self.sede_a.id, self.sede_a.bot_token)
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data['orden']['id'], self.orden_a.id)

    def test_token_de_otra_sede_no_sirve_aunque_el_sede_id_sea_ajeno(self):
        # El token de la Sede A, usado con el sede_id de la Sede B: antes del
        # fix (token global) esto autenticaba como negocio B. Debe fallar.
        r = self._get(self.sede_b.id, self.sede_a.bot_token)
        self.assertEqual(r.status_code, 401)

    def test_token_de_otra_sede_con_su_propio_sede_id_tampoco_sirve(self):
        # El token de la Sede A no es válido ni para su propia sede si se
        # manda un sede_id que no coincide (defensa en profundidad simple).
        r = self._get(self.sede_a.id, self.sede_b.bot_token)
        self.assertEqual(r.status_code, 401)

    def test_token_invalido_responde_401(self):
        r = self._get(self.sede_a.id, 'token-que-no-existe')
        self.assertEqual(r.status_code, 401)

    def test_sin_token_no_autoriza(self):
        r = self._get(self.sede_a.id, None)
        self.assertIn(r.status_code, (401, 403))

    def test_token_valido_sin_sede_id_responde_401(self):
        r = self.client.get(
            '/api/ordenes/estado_orden_bot/', {'telefono': '987654321'},
            HTTP_X_BOT_TOKEN=self.sede_a.bot_token,
        )
        self.assertEqual(r.status_code, 401)

    # ── modificar_desde_bot: la protección IDOR sigue activa con el token nuevo ──
    def test_no_puede_cancelar_pedido_de_otro_negocio_con_bot_token(self):
        r = self.client.post(
            f'/api/ordenes/{self.orden_b.id}/modificar_desde_bot/',
            {'accion': 'cancelar', 'sede_id': self.sede_a.id},
            format='json', HTTP_X_BOT_TOKEN=self.sede_a.bot_token,
        )
        self.assertEqual(r.status_code, 404)
        self.orden_b.refresh_from_db()
        self.assertNotEqual(self.orden_b.estado, 'cancelado')

    def test_si_puede_cancelar_su_propio_pedido_con_bot_token(self):
        r = self.client.post(
            f'/api/ordenes/{self.orden_a.id}/modificar_desde_bot/',
            {'accion': 'cancelar', 'sede_id': self.sede_a.id},
            format='json', HTTP_X_BOT_TOKEN=self.sede_a.bot_token,
        )
        self.assertEqual(r.status_code, 200, r.data)

    # ── el flujo normal del POS (cookie JWT, sin X-Bot-Token) no se ve afectado ──
    def test_sin_header_bot_token_no_rompe_auth_normal(self):
        self.client.force_authenticate(user=self.user_a)
        r = self.client.get('/api/ordenes/estado_orden_bot/', {
            'sede_id': self.sede_a.id, 'telefono': '987654321',
        })
        self.assertEqual(r.status_code, 200, r.data)

    # ── info_bot: la puerta de entrada le entrega a n8n el token propio de la sede ──
    @override_settings(BOT_API_TOKEN='token-global-de-arranque')
    def test_info_bot_devuelve_el_bot_token_de_la_sede(self):
        self.sede_a.whatsapp_instancia = 'instancia_sede_a'
        self.sede_a.save(update_fields=['whatsapp_instancia'])
        r = self.client.get(
            '/api/sedes/info_bot/', {'instancia': 'instancia_sede_a'},
            HTTP_X_BOT_TOKEN='token-global-de-arranque',
        )
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data['bot_token'], self.sede_a.bot_token)
        self.assertEqual(r.data['sede_id'], self.sede_a.id)

    @override_settings(BOT_API_TOKEN='token-global-de-arranque')
    def test_info_bot_rechaza_sin_token_global(self):
        self.sede_a.whatsapp_instancia = 'instancia_sede_a'
        self.sede_a.save(update_fields=['whatsapp_instancia'])
        r = self.client.get('/api/sedes/info_bot/', {'instancia': 'instancia_sede_a'})
        self.assertEqual(r.status_code, 403)

    # ── info_bot: bloque 'carta' — el bot manda link/PDF, no lista productos ──
    @override_settings(BOT_API_TOKEN='token-global-de-arranque')
    def _info_bot(self):
        self.sede_a.whatsapp_instancia = 'instancia_sede_a'
        self.sede_a.save(update_fields=['whatsapp_instancia'])
        return self.client.get(
            '/api/sedes/info_bot/', {'instancia': 'instancia_sede_a'},
            HTTP_X_BOT_TOKEN='token-global-de-arranque',
        )

    @override_settings(BOT_API_TOKEN='token-global-de-arranque')
    def test_carta_modo_propia_manda_link_de_la_pagina_publica(self):
        self.sede_a.carta_modo = 'propia'
        self.sede_a.save(update_fields=['carta_modo'])
        r = self._info_bot()
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data['carta']['modo'], 'propia')
        self.assertIn(f'/menu/{self.negocio_a.id}/{self.sede_a.id}/0', r.data['carta']['link'])
        self.assertIsNone(r.data['carta']['pdf_url'])

    @override_settings(BOT_API_TOKEN='token-global-de-arranque')
    def test_carta_modo_link_manda_el_link_externo(self):
        self.sede_a.carta_modo = 'link'
        self.sede_a.enlace_carta_virtual = 'https://ejemplo.com/mi-carta'
        self.sede_a.save(update_fields=['carta_modo', 'enlace_carta_virtual'])
        r = self._info_bot()
        self.assertEqual(r.data['carta']['modo'], 'link')
        self.assertEqual(r.data['carta']['link'], 'https://ejemplo.com/mi-carta')
        self.assertIsNone(r.data['carta']['pdf_url'])

    @override_settings(BOT_API_TOKEN='token-global-de-arranque')
    def test_carta_modo_pdf_sin_archivo_no_rompe(self):
        self.sede_a.carta_modo = 'pdf'
        self.sede_a.save(update_fields=['carta_modo'])
        r = self._info_bot()
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data['carta']['modo'], 'pdf')
        self.assertIsNone(r.data['carta']['link'])
        self.assertIsNone(r.data['carta']['pdf_url'])

    @override_settings(BOT_API_TOKEN='token-global-de-arranque')
    def test_carta_modo_pdf_con_archivo_manda_la_url(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        self.sede_a.carta_modo = 'pdf'
        self.sede_a.carta_pdf = SimpleUploadedFile('carta.pdf', b'%PDF-1.4 fake', content_type='application/pdf')
        self.sede_a.save()
        r = self._info_bot()
        self.assertEqual(r.status_code, 200, r.data)
        self.assertIsNotNone(r.data['carta']['pdf_url'])
        self.assertIn('carta', r.data['carta']['pdf_url'])
        self.assertIsNone(r.data['carta']['link'])


class JtiRevocadoTest(APITestCase):
    """
    El JWT de ~10 años que se encontró filtrado en un export de n8n no expira
    hasta 2036 y el token_blacklist de SimpleJWT no cubre access tokens —
    por eso se rechaza por jti explícito en CookieJWTAuthentication.
    """

    def setUp(self):
        self.user = User.objects.create_user(username='dueno', password='x')
        Negocio.objects.create(
            propietario=self.user, nombre='Negocio',
            fin_prueba=timezone.now() + timedelta(days=30))

    def _token_con_jti(self, jti):
        token = AccessToken.for_user(self.user)
        token['jti'] = jti
        return str(token)

    def test_token_con_jti_revocado_es_rechazado(self):
        token = self._token_con_jti('80f927245b0f48e2a947f12faa0fe51c')
        r = self.client.get('/api/negocios/alertas/', HTTP_AUTHORIZATION=f'Bearer {token}')
        self.assertEqual(r.status_code, 401)

    def test_token_con_otro_jti_sigue_funcionando(self):
        token = self._token_con_jti('un-jti-cualquiera-no-revocado')
        r = self.client.get('/api/negocios/alertas/', HTTP_AUTHORIZATION=f'Bearer {token}')
        self.assertEqual(r.status_code, 200, r.data)
