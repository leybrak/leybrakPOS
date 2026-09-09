"""
Gate de caja en el login por PIN: sin sesión de caja abierta, los empleados que
NO pueden abrir caja (mesero, cocinero, motorizado) quedan bloqueados. El cajero/
admin sí entra (para poder abrirla).
"""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APITestCase

from negocios.models import Negocio, Sede, Empleado, Rol, SesionCaja

_URL = '/api/empleados/login-pin/'


class LoginCajaGateTest(APITestCase):

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username='dueno', password='x')
        self.negocio = Negocio.objects.create(
            propietario=self.user, nombre='N', fin_prueba=timezone.now() + timedelta(days=30))
        self.sede = Sede.objects.create(negocio=self.negocio, nombre='S')
        self.rol_mesero = Rol.objects.create(nombre='Mesero')
        self.rol_cajero = Rol.objects.create(nombre='Cajero', puede_cobrar=True)
        self.mesero = Empleado.objects.create(
            negocio=self.negocio, sede=self.sede, nombre='Mesa', pin='1111', rol=self.rol_mesero)
        self.cajero = Empleado.objects.create(
            negocio=self.negocio, sede=self.sede, nombre='Caja', pin='2222', rol=self.rol_cajero)

    def _login(self, pin):
        return self.client.post(_URL, {'pin': pin, 'sede_id': self.sede.id}, format='json')

    def _abrir_caja(self):
        SesionCaja.objects.create(sede=self.sede, estado='abierta', fondo_inicial=Decimal('100'))

    def test_mesero_bloqueado_sin_caja(self):
        r = self._login('1111')
        self.assertEqual(r.status_code, 403)
        self.assertTrue(r.data.get('caja_cerrada'))

    def test_mesero_entra_con_caja_abierta(self):
        self._abrir_caja()
        r = self._login('1111')
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data['caja_abierta'])

    def test_cajero_entra_sin_caja(self):
        # El cajero puede entrar aunque la caja esté cerrada (para abrirla).
        r = self._login('2222')
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.data['caja_abierta'])


class LoginTurnoAbiertoTest(APITestCase):
    """
    turno_abierto le dice al frontend si este empleado ya marcó su ingreso y
    todavía no marcó su salida — para no volver a pedirle "Marcar Ingreso" si
    tuvo que reingresar el PIN a mitad de turno (sesión perdida, error de red).
    """

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username='dueno2', password='x')
        self.negocio = Negocio.objects.create(
            propietario=self.user, nombre='N2', fin_prueba=timezone.now() + timedelta(days=30))
        self.sede = Sede.objects.create(negocio=self.negocio, nombre='S2')
        self.rol_mesero = Rol.objects.create(nombre='Mesero')
        self.mesero = Empleado.objects.create(
            negocio=self.negocio, sede=self.sede, nombre='Mesa', pin='3333', rol=self.rol_mesero)
        SesionCaja.objects.create(sede=self.sede, estado='abierta', fondo_inicial=Decimal('100'))

    def _login(self):
        return self.client.post(_URL, {'pin': '3333', 'sede_id': self.sede.id}, format='json')

    def test_sin_ingreso_previo_turno_no_esta_abierto(self):
        r = self._login()
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.data['turno_abierto'])

    def test_con_ingreso_y_sin_salida_turno_esta_abierto(self):
        self.mesero.ultimo_ingreso = timezone.now()
        self.mesero.save(update_fields=['ultimo_ingreso'])
        r = self._login()
        self.assertTrue(r.data['turno_abierto'])

    def test_con_salida_posterior_al_ingreso_turno_no_esta_abierto(self):
        self.mesero.ultimo_ingreso = timezone.now() - timedelta(hours=8)
        self.mesero.ultima_salida = timezone.now() - timedelta(hours=1)
        self.mesero.save(update_fields=['ultimo_ingreso', 'ultima_salida'])
        r = self._login()
        self.assertFalse(r.data['turno_abierto'])

    def test_con_ingreso_nuevo_tras_una_salida_vieja_turno_esta_abierto(self):
        # Cerró turno ayer, hoy volvió a marcar ingreso (por el flujo normal
        # o por accion='asistencia') — el turno de HOY está abierto de nuevo.
        self.mesero.ultima_salida = timezone.now() - timedelta(hours=20)
        self.mesero.ultimo_ingreso = timezone.now() - timedelta(minutes=5)
        self.mesero.save(update_fields=['ultimo_ingreso', 'ultima_salida'])
        r = self._login()
        self.assertTrue(r.data['turno_abierto'])
