"""
Regresión del IDOR en los endpoints de bot de OrdenViewSet: el token de bot
de un negocio no debe poder leer ni modificar pedidos de OTRO negocio.
"""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APITestCase

from negocios.models import Negocio, Sede, Orden


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
