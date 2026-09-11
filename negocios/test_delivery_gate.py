"""
No se puede activar el módulo Delivery (Negocio.mod_delivery_activo) sin al
menos una ZonaDelivery activa configurada — si no, el bot cae siempre a "un
agente humano validará el envío" para todos los pedidos, en silencio.
"""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APITestCase

from negocios.models import Negocio, Sede, ZonaDelivery


class DeliveryGateTest(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user(username='dueno', password='x')
        self.negocio = Negocio.objects.create(
            propietario=self.user, nombre='Negocio',
            fin_prueba=timezone.now() + timedelta(days=30),
            mod_delivery_activo=False,
        )
        self.sede = Sede.objects.create(negocio=self.negocio, nombre='Sede')
        self.client.force_authenticate(user=self.user)

    def test_no_puede_activar_delivery_sin_zonas(self):
        r = self.client.patch(
            f'/api/negocios/{self.negocio.id}/', {'mod_delivery_activo': True}, format='json')
        self.assertEqual(r.status_code, 400)
        self.negocio.refresh_from_db()
        self.assertFalse(self.negocio.mod_delivery_activo)

    def test_si_puede_activar_delivery_con_una_zona_activa(self):
        ZonaDelivery.objects.create(
            sede=self.sede, nombre='Zona 1', costo_envio=Decimal('5'),
            radio_max_km=3.0, activa=True)
        r = self.client.patch(
            f'/api/negocios/{self.negocio.id}/', {'mod_delivery_activo': True}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.negocio.refresh_from_db()
        self.assertTrue(self.negocio.mod_delivery_activo)

    def test_zona_inactiva_no_cuenta(self):
        ZonaDelivery.objects.create(
            sede=self.sede, nombre='Zona 1', costo_envio=Decimal('5'),
            radio_max_km=3.0, activa=False)
        r = self.client.patch(
            f'/api/negocios/{self.negocio.id}/', {'mod_delivery_activo': True}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_otros_campos_sin_delivery_no_se_bloquean(self):
        r = self.client.patch(
            f'/api/negocios/{self.negocio.id}/', {'nombre': 'Negocio Nuevo'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)

    def test_no_revalida_si_ya_estaba_activo_y_no_se_toca_el_campo(self):
        # Ya estaba activo (quizás sin zonas, de antes de este gate) — un
        # PATCH que no toca mod_delivery_activo no debe romperse por eso.
        self.negocio.mod_delivery_activo = True
        self.negocio.save(update_fields=['mod_delivery_activo'])
        r = self.client.patch(
            f'/api/negocios/{self.negocio.id}/', {'nombre': 'Otro Nombre'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)

    def test_no_revalida_si_ya_estaba_activo_aunque_lo_reenvien_en_true(self):
        # El ERP (Erp_TabModulos.jsx) reenvía TODOS los mod_*_activo en cada
        # guardado, no solo el que cambió — si el módulo ya estaba en True
        # (aunque esté bloqueado por plan y sin zonas, de antes de este
        # gate), guardar otra pestaña de config no debe romperse por eso.
        self.negocio.mod_delivery_activo = True
        self.negocio.save(update_fields=['mod_delivery_activo'])
        r = self.client.patch(
            f'/api/negocios/{self.negocio.id}/',
            {'nombre': 'Otro Nombre', 'mod_delivery_activo': True}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
