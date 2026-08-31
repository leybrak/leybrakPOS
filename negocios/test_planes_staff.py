"""
Gestión de PlanSaaS desde el panel de staff: cualquier autenticado puede
ver los planes (los necesita para "contratar"), pero solo el staff puede
crear/editar/borrar, y no se puede borrar un plan que negocios ya usan.
"""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APITestCase

from negocios.models import Negocio, PlanSaaS

PLANES_URL = '/api/planes-saas/'


class PlanSaaSStaffTest(APITestCase):

    def setUp(self):
        self.staff = User.objects.create_superuser(username='leybrak', password='x', email='l@l.com')
        self.dueno = User.objects.create_user(username='dueno', password='x')
        Negocio.objects.create(
            propietario=self.dueno, nombre='Negocio', fin_prueba=timezone.now() + timedelta(days=30))

    def test_dueno_puede_listar_planes(self):
        PlanSaaS.objects.create(nombre='Pro', precio_mensual=Decimal('99'))
        self.client.force_authenticate(user=self.dueno)
        resp = self.client.get(PLANES_URL)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)

    def test_dueno_no_puede_crear_planes(self):
        self.client.force_authenticate(user=self.dueno)
        resp = self.client.post(PLANES_URL, {'nombre': 'Pirata', 'precio_mensual': '1.00'}, format='json')
        self.assertEqual(resp.status_code, 403)

    def test_staff_crea_un_plan(self):
        self.client.force_authenticate(user=self.staff)
        resp = self.client.post(PLANES_URL, {
            'nombre': 'Pro', 'precio_mensual': '99.00', 'max_sedes': 3,
            'modulo_kds': True, 'modulo_delivery': True,
        }, format='json')
        self.assertEqual(resp.status_code, 201, resp.data)

        plan = PlanSaaS.objects.get(nombre='Pro')
        self.assertEqual(plan.max_sedes, 3)
        self.assertTrue(plan.modulo_kds)
        self.assertTrue(plan.modulo_delivery)
        self.assertFalse(plan.modulo_ml)

    def test_staff_edita_un_plan(self):
        plan = PlanSaaS.objects.create(nombre='Pro', precio_mensual=Decimal('99'))
        self.client.force_authenticate(user=self.staff)
        resp = self.client.patch(f'{PLANES_URL}{plan.id}/', {'precio_mensual': '129.00'}, format='json')
        self.assertEqual(resp.status_code, 200, resp.data)

        plan.refresh_from_db()
        self.assertEqual(plan.precio_mensual, Decimal('129.00'))

    def test_staff_borra_un_plan_sin_uso(self):
        plan = PlanSaaS.objects.create(nombre='Sin uso', precio_mensual=Decimal('10'))
        self.client.force_authenticate(user=self.staff)
        resp = self.client.delete(f'{PLANES_URL}{plan.id}/')
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(PlanSaaS.objects.filter(id=plan.id).exists())

    def test_no_se_puede_borrar_un_plan_en_uso(self):
        plan = PlanSaaS.objects.create(nombre='En uso', precio_mensual=Decimal('10'))
        self.negocio_con_plan = Negocio.objects.create(
            propietario=User.objects.create_user(username='dueno2', password='x'),
            nombre='Negocio Con Plan', plan=plan, fin_prueba=timezone.now() + timedelta(days=30))

        self.client.force_authenticate(user=self.staff)
        resp = self.client.delete(f'{PLANES_URL}{plan.id}/')
        self.assertEqual(resp.status_code, 400)
        self.assertTrue(PlanSaaS.objects.filter(id=plan.id).exists())
