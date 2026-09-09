"""
Regresión del IDOR en los endpoints de bot de OrdenViewSet: el token de bot
de un negocio no debe poder leer ni modificar pedidos de OTRO negocio.
"""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APITestCase

from negocios.models import Negocio, Sede, Orden, SolicitudCambio


class OrdenBotSeguridadTest(APITestCase):

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

    # ── estado_orden_bot ─────────────────────────────────────────
    def test_no_puede_ver_pedido_de_otro_negocio(self):
        self.client.force_authenticate(user=self.user_a)
        r = self.client.get('/api/ordenes/estado_orden_bot/', {
            'sede_id': self.sede_b.id, 'telefono': '912345678',
        })
        self.assertEqual(r.status_code, 403)

    def test_si_puede_ver_su_propio_pedido(self):
        self.client.force_authenticate(user=self.user_a)
        r = self.client.get('/api/ordenes/estado_orden_bot/', {
            'sede_id': self.sede_a.id, 'telefono': '987654321',
        })
        self.assertEqual(r.status_code, 200)
        self.assertIsNotNone(r.data['orden'])
        self.assertEqual(r.data['orden']['id'], self.orden_a.id)

    # ── modificar_desde_bot ──────────────────────────────────────
    def test_no_puede_cancelar_pedido_de_otro_negocio(self):
        self.client.force_authenticate(user=self.user_a)
        r = self.client.post(f'/api/ordenes/{self.orden_b.id}/modificar_desde_bot/', {
            'accion': 'cancelar',
        }, format='json')
        self.assertEqual(r.status_code, 404)
        self.orden_b.refresh_from_db()
        self.assertNotEqual(self.orden_b.estado, 'cancelado')

    def test_si_puede_cancelar_su_propio_pedido(self):
        self.client.force_authenticate(user=self.user_a)
        r = self.client.post(f'/api/ordenes/{self.orden_a.id}/modificar_desde_bot/', {
            'accion': 'cancelar',
        }, format='json')
        self.assertEqual(r.status_code, 200, r.data)

    # ── resolver_solicitud_bot ─────────────────────────────────────
    def test_no_puede_resolver_solicitud_de_otro_negocio(self):
        solicitud = SolicitudCambio.objects.create(
            orden=self.orden_b, tipo_accion='cancelar', detalles_json={})
        self.client.force_authenticate(user=self.user_a)
        r = self.client.post(f'/api/ordenes/{self.orden_b.id}/resolver_solicitud_bot/', {
            'solicitud_id': solicitud.id, 'decision': 'aprobar',
        }, format='json')
        self.assertEqual(r.status_code, 404)
        solicitud.refresh_from_db()
        self.assertEqual(solicitud.estado, 'pendiente')

    def test_si_puede_resolver_su_propia_solicitud(self):
        solicitud = SolicitudCambio.objects.create(
            orden=self.orden_a, tipo_accion='cancelar', detalles_json={})
        self.client.force_authenticate(user=self.user_a)
        r = self.client.post(f'/api/ordenes/{self.orden_a.id}/resolver_solicitud_bot/', {
            'solicitud_id': solicitud.id, 'decision': 'aprobar',
        }, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        solicitud.refresh_from_db()
        self.assertEqual(solicitud.estado, 'aprobada')

    # ── accion 'nota': regresión de AttributeError (Orden.notas_cocina no
    # existía) — modificar_desde_bot y resolver_solicitud_bot devolvían 500
    # tanto para pedidos 'pendiente' (nota directa) como 'preparando'
    # (nota vía SolicitudCambio aprobada por el staff en el KDS). ──
    def test_nota_directa_en_pedido_pendiente_no_rompe(self):
        self.orden_a.estado = 'pendiente'
        self.orden_a.save(update_fields=['estado'])
        self.client.force_authenticate(user=self.user_a)
        r = self.client.post(f'/api/ordenes/{self.orden_a.id}/modificar_desde_bot/', {
            'accion': 'nota', 'datos': {'nota': 'agregar una gaseosa'},
        }, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data['status'], 'aprobado')
        self.orden_a.refresh_from_db()
        self.assertIn('agregar una gaseosa', self.orden_a.notas_cocina)

    def test_nota_en_pedido_preparando_queda_en_revision_y_se_aprueba_sin_romper(self):
        self.orden_a.estado = 'preparando'
        self.orden_a.save(update_fields=['estado'])
        self.client.force_authenticate(user=self.user_a)

        r1 = self.client.post(f'/api/ordenes/{self.orden_a.id}/modificar_desde_bot/', {
            'accion': 'nota', 'datos': {'nota': 'agregar una gaseosa gordita'},
        }, format='json')
        self.assertEqual(r1.status_code, 200, r1.data)
        self.assertEqual(r1.data['status'], 'en_revision')

        solicitud = SolicitudCambio.objects.get(orden=self.orden_a, tipo_accion='nota')
        r2 = self.client.post(f'/api/ordenes/{self.orden_a.id}/resolver_solicitud_bot/', {
            'solicitud_id': solicitud.id, 'decision': 'aprobar',
        }, format='json')
        self.assertEqual(r2.status_code, 200, r2.data)
        self.orden_a.refresh_from_db()
        self.assertIn('agregar una gaseosa gordita', self.orden_a.notas_cocina)
