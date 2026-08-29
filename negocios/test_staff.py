"""
Panel de staff (Leybrak): aislamiento de tickets de soporte entre negocios,
permisos de superusuario en los endpoints de métricas/salud, y que
metricas_staff clasifique bien activo/prueba/vencido/bloqueado.
"""
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APITestCase

from negocios.models import Negocio, PagoSuscripcion, TicketSoporte

METRICAS_URL = '/api/staff/metricas/'
SALUD_BOT_URL = '/api/staff/salud-bot/'
SALUD_SERVIDOR_URL = '/api/staff/salud-servidor/'
TICKETS_URL = '/api/tickets-soporte/'


class TicketSoporteTest(APITestCase):

    def setUp(self):
        self.staff = User.objects.create_superuser(username='leybrak', password='x', email='l@l.com')
        self.dueno1 = User.objects.create_user(username='dueno1', password='x')
        self.dueno2 = User.objects.create_user(username='dueno2', password='x')
        self.negocio1 = Negocio.objects.create(
            propietario=self.dueno1, nombre='Negocio Uno', fin_prueba=timezone.now() + timedelta(days=30))
        self.negocio2 = Negocio.objects.create(
            propietario=self.dueno2, nombre='Negocio Dos', fin_prueba=timezone.now() + timedelta(days=30))

    def test_dueno_crea_ticket_ligado_a_su_propio_negocio(self):
        self.client.force_authenticate(user=self.dueno1)
        resp = self.client.post(TICKETS_URL, {
            'asunto': 'No puedo emitir boleta', 'mensaje': 'Me da error 500',
            # Intenta colar el negocio de otro — debe ser ignorado.
            'negocio': self.negocio2.id,
        }, format='json')
        self.assertEqual(resp.status_code, 201, resp.data)
        ticket = TicketSoporte.objects.get(id=resp.data['id'])
        self.assertEqual(ticket.negocio_id, self.negocio1.id)

    def test_dueno_no_ve_tickets_de_otro_negocio(self):
        TicketSoporte.objects.create(negocio=self.negocio1, asunto='A', mensaje='a')
        TicketSoporte.objects.create(negocio=self.negocio2, asunto='B', mensaje='b')

        self.client.force_authenticate(user=self.dueno1)
        resp = self.client.get(TICKETS_URL)
        self.assertEqual(resp.status_code, 200)
        asuntos = [t['asunto'] for t in resp.data]
        self.assertEqual(asuntos, ['A'])

    def test_staff_ve_todos_los_tickets(self):
        TicketSoporte.objects.create(negocio=self.negocio1, asunto='A', mensaje='a')
        TicketSoporte.objects.create(negocio=self.negocio2, asunto='B', mensaje='b')

        self.client.force_authenticate(user=self.staff)
        resp = self.client.get(TICKETS_URL)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 2)

    def test_dueno_no_puede_cambiar_estado_de_su_propio_ticket(self):
        ticket = TicketSoporte.objects.create(negocio=self.negocio1, asunto='A', mensaje='a')

        self.client.force_authenticate(user=self.dueno1)
        resp = self.client.patch(f'{TICKETS_URL}{ticket.id}/', {'estado': 'resuelto'}, format='json')
        self.assertEqual(resp.status_code, 403)

        ticket.refresh_from_db()
        self.assertEqual(ticket.estado, 'abierto')

    def test_staff_puede_resolver_un_ticket(self):
        ticket = TicketSoporte.objects.create(negocio=self.negocio1, asunto='A', mensaje='a')

        self.client.force_authenticate(user=self.staff)
        resp = self.client.patch(
            f'{TICKETS_URL}{ticket.id}/',
            {'estado': 'resuelto', 'respuesta_staff': 'Ya quedó'}, format='json')
        self.assertEqual(resp.status_code, 200, resp.data)

        ticket.refresh_from_db()
        self.assertEqual(ticket.estado, 'resuelto')


class StaffEndpointsPermisosTest(APITestCase):

    def setUp(self):
        self.staff = User.objects.create_superuser(username='leybrak', password='x', email='l@l.com')
        self.dueno = User.objects.create_user(username='dueno', password='x')
        Negocio.objects.create(
            propietario=self.dueno, nombre='Negocio', fin_prueba=timezone.now() + timedelta(days=30))

    def test_dueno_no_puede_ver_metricas_staff(self):
        self.client.force_authenticate(user=self.dueno)
        self.assertEqual(self.client.get(METRICAS_URL).status_code, 403)
        self.assertEqual(self.client.get(SALUD_BOT_URL).status_code, 403)
        self.assertEqual(self.client.get(SALUD_SERVIDOR_URL).status_code, 403)

    def test_anonimo_no_puede_ver_metricas_staff(self):
        self.assertEqual(self.client.get(METRICAS_URL).status_code, 401)

    def test_staff_si_puede_ver_metricas(self):
        self.client.force_authenticate(user=self.staff)
        resp = self.client.get(METRICAS_URL)
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertIn('negocios', resp.data)

    def test_staff_puede_ver_salud_servidor(self):
        self.client.force_authenticate(user=self.staff)
        resp = self.client.get(SALUD_SERVIDOR_URL)
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertIn('cpu_percent', resp.data)
        self.assertIn('memoria', resp.data)

    def test_staff_salud_bot_sin_n8n_configurado(self):
        self.client.force_authenticate(user=self.staff)
        resp = self.client.get(SALUD_BOT_URL)
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertFalse(resp.data['n8n']['configurado'])


class MetricasClasificacionTest(APITestCase):

    def setUp(self):
        self.staff = User.objects.create_superuser(username='leybrak', password='x', email='l@l.com')
        self.client.force_authenticate(user=self.staff)
        ahora = timezone.now()

        u1 = User.objects.create_user(username='n_activo', password='x')
        self.n_activo = Negocio.objects.create(
            propietario=u1, nombre='Activo', fin_prueba=ahora - timedelta(days=100))
        PagoSuscripcion.objects.create(
            negocio=self.n_activo, monto=Decimal('99'), estado='pagado', fecha_pago=ahora - timedelta(days=5))

        u2 = User.objects.create_user(username='n_prueba', password='x')
        self.n_prueba = Negocio.objects.create(
            propietario=u2, nombre='Prueba', fin_prueba=ahora + timedelta(days=10))

        u3 = User.objects.create_user(username='n_vencido', password='x')
        self.n_vencido = Negocio.objects.create(
            propietario=u3, nombre='Vencido', fin_prueba=ahora - timedelta(days=5))

        u4 = User.objects.create_user(username='n_bloqueado', password='x')
        self.n_bloqueado = Negocio.objects.create(
            propietario=u4, nombre='Bloqueado', fin_prueba=ahora + timedelta(days=30), activo=False)

    def test_clasifica_cada_negocio_en_su_estado(self):
        resp = self.client.get(METRICAS_URL)
        self.assertEqual(resp.status_code, 200, resp.data)
        negocios = resp.data['negocios']
        self.assertEqual(negocios['total'], 4)
        self.assertEqual(negocios['activo'], 1)
        self.assertEqual(negocios['prueba'], 1)
        self.assertEqual(negocios['vencido'], 1)
        self.assertEqual(negocios['bloqueado'], 1)
