"""
Panel de staff — fase 2: crear negocios, bloquear/activar, pagos manuales
(Yape/Plin/Transferencia) y edición de ModuloGlobal/DatosPagoPlataforma.
Todo gateado a superusuario, salvo que un dueño reporte SU propio pago.
"""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APITestCase

from negocios.models import Negocio, PagoSuscripcion, PlanSaaS

CREAR_NEGOCIO_URL = '/api/staff/negocios/crear/'
PAGOS_PENDIENTES_URL = '/api/staff/pagos-pendientes/'
MODULOS_GLOBALES_URL = '/api/staff/modulos-globales/'
DATOS_PAGO_STAFF_URL = '/api/staff/datos-pago/'
DATOS_PAGO_NEGOCIO_URL = '/api/negocio/suscripcion/datos-pago/'
PAGOS_URL = '/api/pagos-suscripcion/'


class CrearNegocioStaffTest(APITestCase):

    def setUp(self):
        self.staff = User.objects.create_superuser(username='leybrak', password='x', email='l@l.com')
        self.dueno = User.objects.create_user(username='dueno', password='x')
        Negocio.objects.create(
            propietario=self.dueno, nombre='Negocio Existente', fin_prueba=timezone.now() + timedelta(days=30))

    def test_staff_crea_negocio_con_propietario_y_sede_en_un_paso(self):
        self.client.force_authenticate(user=self.staff)
        resp = self.client.post(CREAR_NEGOCIO_URL, {
            'nombre': 'Negocio Nuevo',
            'propietario_username': 'nuevo_dueno',
            'propietario_email': 'n@n.com',
            'propietario_password': 'clave123',
            'sede_nombre': 'Sede Principal',
        }, format='json')
        self.assertEqual(resp.status_code, 201, resp.data)

        negocio = Negocio.objects.get(nombre='Negocio Nuevo')
        self.assertEqual(negocio.propietario.username, 'nuevo_dueno')
        self.assertTrue(negocio.propietario.check_password('clave123'))
        self.assertEqual(list(negocio.sedes.values_list('nombre', flat=True)), ['Sede Principal'])

    def test_precarga_modulos_segun_el_plan(self):
        plan = PlanSaaS.objects.create(nombre='Pro', precio_mensual=99, modulo_kds=True, modulo_delivery=True)
        self.client.force_authenticate(user=self.staff)
        resp = self.client.post(CREAR_NEGOCIO_URL, {
            'nombre': 'Negocio Con Plan',
            'propietario_username': 'dueno_plan',
            'plan': plan.id,
        }, format='json')
        self.assertEqual(resp.status_code, 201, resp.data)

        negocio = Negocio.objects.get(nombre='Negocio Con Plan')
        self.assertTrue(negocio.mod_cocina_activo)
        self.assertTrue(negocio.mod_delivery_activo)
        self.assertFalse(negocio.mod_bot_wsp_activo)

    def test_no_deja_crear_dos_veces_el_mismo_usuario(self):
        self.client.force_authenticate(user=self.staff)
        resp = self.client.post(CREAR_NEGOCIO_URL, {
            'nombre': 'Otro Negocio', 'propietario_username': 'dueno',  # ya existe
        }, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_dueno_no_puede_crear_negocios(self):
        self.client.force_authenticate(user=self.dueno)
        resp = self.client.post(CREAR_NEGOCIO_URL, {
            'nombre': 'X', 'propietario_username': 'y',
        }, format='json')
        self.assertEqual(resp.status_code, 403)


class BloquearNegocioTest(APITestCase):

    def setUp(self):
        self.staff = User.objects.create_superuser(username='leybrak', password='x', email='l@l.com')
        self.dueno = User.objects.create_user(username='dueno', password='x')
        self.negocio = Negocio.objects.create(
            propietario=self.dueno, nombre='Negocio', fin_prueba=timezone.now() + timedelta(days=30))

    def test_staff_puede_bloquear_y_reactivar_un_negocio(self):
        self.client.force_authenticate(user=self.staff)
        resp = self.client.patch(f'/api/negocios/{self.negocio.id}/', {'activo': False}, format='json')
        self.assertEqual(resp.status_code, 200, resp.data)
        self.negocio.refresh_from_db()
        self.assertFalse(self.negocio.activo)

        resp = self.client.patch(f'/api/negocios/{self.negocio.id}/', {'activo': True}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.negocio.refresh_from_db()
        self.assertTrue(self.negocio.activo)

    def test_dueno_no_puede_bloquear_otro_negocio(self):
        otro_user = User.objects.create_user(username='otro', password='x')
        otro_negocio = Negocio.objects.create(
            propietario=otro_user, nombre='Otro', fin_prueba=timezone.now() + timedelta(days=30))

        self.client.force_authenticate(user=self.dueno)
        resp = self.client.patch(f'/api/negocios/{otro_negocio.id}/', {'activo': False}, format='json')
        self.assertEqual(resp.status_code, 404)  # ni siquiera está en su queryset


class PagoSuscripcionManualTest(APITestCase):

    def setUp(self):
        self.staff = User.objects.create_superuser(username='leybrak', password='x', email='l@l.com')
        self.dueno = User.objects.create_user(username='dueno', password='x')
        self.negocio = Negocio.objects.create(
            propietario=self.dueno, nombre='Negocio', fin_prueba=timezone.now() - timedelta(days=1), activo=True)

    def test_dueno_reporta_su_propio_pago_yape_queda_pendiente(self):
        self.client.force_authenticate(user=self.dueno)
        resp = self.client.post(PAGOS_URL, {
            'monto': '99.00', 'metodo_pago': 'yape',
        }, format='json')
        self.assertEqual(resp.status_code, 201, resp.data)

        pago = PagoSuscripcion.objects.get(id=resp.data['id'])
        self.assertEqual(pago.negocio_id, self.negocio.id)
        self.assertEqual(pago.estado, 'pendiente')

    def test_dueno_no_puede_reportar_con_metodo_no_autorreportable(self):
        self.client.force_authenticate(user=self.dueno)
        resp = self.client.post(PAGOS_URL, {'monto': '99.00', 'metodo_pago': 'tarjeta'}, format='json')
        self.assertEqual(resp.status_code, 403)

    def test_dueno_no_puede_auto_aprobarse_el_pago(self):
        # Regresión del hallazgo de seguridad: antes no había perform_update,
        # así que un dueño podía PATCHear su propio pago a 'pagado'.
        self.negocio.activo = False
        self.negocio.save(update_fields=['activo'])
        pago = PagoSuscripcion.objects.create(negocio=self.negocio, monto=99, metodo_pago='yape', estado='pendiente')

        self.client.force_authenticate(user=self.dueno)
        resp = self.client.patch(f'{PAGOS_URL}{pago.id}/', {'estado': 'pagado'}, format='json')
        self.assertEqual(resp.status_code, 403)

        pago.refresh_from_db()
        self.assertEqual(pago.estado, 'pendiente')
        self.negocio.refresh_from_db()
        self.assertFalse(self.negocio.activo)  # la señal de reactivación NO debió dispararse

    def test_staff_aprueba_pago_y_reactiva_el_negocio(self):
        self.negocio.activo = False
        self.negocio.save(update_fields=['activo'])
        pago = PagoSuscripcion.objects.create(negocio=self.negocio, monto=99, metodo_pago='plin', estado='pendiente')

        self.client.force_authenticate(user=self.staff)
        resp = self.client.patch(f'{PAGOS_URL}{pago.id}/', {'estado': 'pagado'}, format='json')
        self.assertEqual(resp.status_code, 200, resp.data)

        self.negocio.refresh_from_db()
        self.assertTrue(self.negocio.activo)  # reusa reactivar_negocio_al_pagar

    def test_pagos_pendientes_staff_solo_lista_metodos_autorreportables(self):
        PagoSuscripcion.objects.create(negocio=self.negocio, monto=99, metodo_pago='yape', estado='pendiente')
        PagoSuscripcion.objects.create(negocio=self.negocio, monto=99, metodo_pago='otro', estado='pendiente')  # MP a mitad de checkout
        PagoSuscripcion.objects.create(negocio=self.negocio, monto=99, metodo_pago='plin', estado='pagado')  # ya resuelto

        self.client.force_authenticate(user=self.staff)
        resp = self.client.get(PAGOS_PENDIENTES_URL)
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]['metodo_pago'], 'yape')

    def test_dueno_no_puede_ver_pagos_pendientes_de_todos(self):
        self.client.force_authenticate(user=self.dueno)
        resp = self.client.get(PAGOS_PENDIENTES_URL)
        self.assertEqual(resp.status_code, 403)


class ConfiguracionStaffTest(APITestCase):

    def setUp(self):
        self.staff = User.objects.create_superuser(username='leybrak', password='x', email='l@l.com')
        self.dueno = User.objects.create_user(username='dueno', password='x')
        Negocio.objects.create(
            propietario=self.dueno, nombre='Negocio', fin_prueba=timezone.now() + timedelta(days=30))

    def test_staff_edita_modulos_globales(self):
        self.client.force_authenticate(user=self.staff)
        resp = self.client.patch(MODULOS_GLOBALES_URL, {'bot_wsp_activo': False}, format='json')
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertFalse(resp.data['bot_wsp_activo'])

    def test_dueno_no_puede_editar_modulos_globales(self):
        self.client.force_authenticate(user=self.dueno)
        resp = self.client.patch(MODULOS_GLOBALES_URL, {'bot_wsp_activo': False}, format='json')
        self.assertEqual(resp.status_code, 403)

    def test_staff_edita_datos_de_pago_y_negocio_los_puede_leer(self):
        self.client.force_authenticate(user=self.staff)
        resp = self.client.patch(DATOS_PAGO_STAFF_URL, {'yape_numero': '999888777', 'yape_titular': 'Leybrak SAC'}, format='json')
        self.assertEqual(resp.status_code, 200, resp.data)

        self.client.force_authenticate(user=self.dueno)
        resp = self.client.get(DATOS_PAGO_NEGOCIO_URL)
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data['yape_numero'], '999888777')

    def test_dueno_no_puede_editar_datos_de_pago(self):
        self.client.force_authenticate(user=self.dueno)
        resp = self.client.patch(DATOS_PAGO_STAFF_URL, {'yape_numero': '111'}, format='json')
        self.assertEqual(resp.status_code, 403)
