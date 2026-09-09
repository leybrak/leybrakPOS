"""
Regresión de la ronda de fugas entre negocios encontrada en la auditoría
general (todas menos el bloqueo de Rol, que tiene su propio test aparte
más abajo en este mismo archivo): un negocio no debe poder leer ni tocar
datos de OTRO negocio cambiando un id/parámetro en la URL.
"""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APITestCase

from negocios.models import (
    Negocio, Sede, Empleado, Rol, Orden, Producto, GrupoVariacion,
    OpcionVariacion, InsumoBase, InsumoSede,
)


def _hdr(emp):
    return {'HTTP_X_EMPLEADO_ID': str(emp.id)}


class SeguridadMultiTenancyTest(APITestCase):

    def setUp(self):
        self.user_a = User.objects.create_user(username='duenoA2', password='x')
        self.negocio_a = Negocio.objects.create(
            propietario=self.user_a, nombre='Negocio A',
            fin_prueba=timezone.now() + timedelta(days=30))
        self.sede_a = Sede.objects.create(negocio=self.negocio_a, nombre='Sede A')

        self.user_b = User.objects.create_user(username='duenoB2', password='x')
        self.negocio_b = Negocio.objects.create(
            propietario=self.user_b, nombre='Negocio B',
            fin_prueba=timezone.now() + timedelta(days=30))
        self.sede_b = Sede.objects.create(negocio=self.negocio_b, nombre='Sede B')

        self.client.force_authenticate(user=self.user_a)

    # ── perform_create: X-Empleado-Id de otro negocio ───────────────
    def test_no_puede_crear_orden_con_empleado_de_otro_negocio(self):
        rol = Rol.objects.create(nombre=f'Mesero-{self.id()}', puede_cobrar=True)
        empleado_b = Empleado.objects.create(
            negocio=self.negocio_b, sede=self.sede_b, nombre='Mesero B', pin='1234', rol=rol)
        producto_a = Producto.objects.create(negocio=self.negocio_a, nombre='Plato A', precio_base=Decimal('10'))

        r = self.client.post('/api/ordenes/', {
            'sede': self.sede_a.id, 'tipo': 'salon',
            'detalles': [{'producto': producto_a.id, 'cantidad': 1}],
        }, format='json', **_hdr(empleado_b))

        # Con el empleado ajeno ignorado (get_empleado_verificado devuelve None),
        # cae al flujo de dueño: debe exigir/validar `sede` contra negocio_a, no
        # colarse en negocio_b usando la sede del empleado ajeno.
        self.assertEqual(r.status_code, 201, r.data)
        orden = Orden.objects.get(id=r.data['id'])
        self.assertEqual(orden.sede_id, self.sede_a.id)
        self.assertIsNone(orden.mesero_id)

    # ── metricas_dashboard ───────────────────────────────────────────
    def test_no_puede_ver_metricas_de_otro_negocio_por_sede(self):
        r = self.client.get('/api/dashboard/metricas/', {'sede_id': self.sede_b.id})
        self.assertEqual(r.status_code, 403)

    def test_no_puede_ver_metricas_de_otro_negocio_por_negocio_id(self):
        r = self.client.get('/api/dashboard/metricas/', {'negocio_id': self.negocio_b.id})
        self.assertEqual(r.status_code, 403)

    def test_si_puede_ver_sus_propias_metricas(self):
        r = self.client.get('/api/dashboard/metricas/', {'sede_id': self.sede_a.id})
        self.assertEqual(r.status_code, 200, r.data)

    # ── buscar_por_telefono (usado por el bot) ────────────────────
    def test_no_puede_buscar_cliente_de_otro_negocio(self):
        r = self.client.get('/api/clientes/buscar_por_telefono/', {
            'telefono': '987654321', 'negocio_id': self.negocio_b.id,
        })
        self.assertEqual(r.status_code, 403)

    def test_si_puede_buscar_cliente_de_su_propio_negocio(self):
        r = self.client.get('/api/clientes/buscar_por_telefono/', {
            'telefono': '987654321', 'negocio_id': self.negocio_a.id,
        })
        self.assertEqual(r.status_code, 200, r.data)

    # ── cotizar_bot: producto/opción de otro negocio ─────────────────
    def test_cotizar_bot_ignora_producto_de_otro_negocio(self):
        producto_b = Producto.objects.create(negocio=self.negocio_b, nombre='Plato B', precio_base=Decimal('99'))
        r = self.client.post('/api/ordenes/cotizar_bot/', {
            'sede': self.sede_a.id, 'tipo': 'salon', 'metodo_pago_esperado': 'efectivo',
            'detalles': [{'producto': producto_b.id, 'cantidad': 1}],
        }, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        # El producto ajeno no existe para este negocio -> no se cotiza ninguna línea.
        self.assertEqual(r.data.get('total') or 0, 0)

    def test_cotizar_bot_ignora_opcion_de_otro_negocio(self):
        producto_a = Producto.objects.create(negocio=self.negocio_a, nombre='Plato A', precio_base=Decimal('10'))
        producto_b = Producto.objects.create(negocio=self.negocio_b, nombre='Plato B', precio_base=Decimal('0'))
        grupo_b = GrupoVariacion.objects.create(producto=producto_b, nombre='Tamaño')
        opcion_b = OpcionVariacion.objects.create(grupo=grupo_b, nombre='Descuento', precio_adicional=Decimal('-50'))

        r = self.client.post('/api/ordenes/cotizar_bot/', {
            'sede': self.sede_a.id, 'tipo': 'salon', 'metodo_pago_esperado': 'efectivo',
            'detalles': [{'producto': producto_a.id, 'cantidad': 1, 'opciones': [opcion_b.id]}],
        }, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        # La opción (con descuento de -50) de otro negocio NO debe aplicarse.
        self.assertGreaterEqual(float(r.data.get('total') or 0), 10)

    # ── ingreso_masivo: reparto a una sede de otro negocio ──────────
    def test_no_puede_repartir_stock_a_sede_de_otro_negocio(self):
        insumo = InsumoBase.objects.create(negocio=self.negocio_a, nombre='Papa', unidad_medida='kg')
        r = self.client.post('/api/insumo-sede/ingreso_masivo/', {
            'insumo_base_id': insumo.id,
            'ingreso_global': 10,
            'distribucion': {str(self.sede_b.id): 5},
        }, format='json')
        self.assertEqual(r.status_code, 403)
        self.assertFalse(InsumoSede.objects.filter(insumo_base=insumo, sede=self.sede_b).exists())

    def test_si_puede_repartir_stock_a_su_propia_sede(self):
        insumo = InsumoBase.objects.create(negocio=self.negocio_a, nombre='Papa', unidad_medida='kg')
        r = self.client.post('/api/insumo-sede/ingreso_masivo/', {
            'insumo_base_id': insumo.id,
            'ingreso_global': 10,
            'distribucion': {str(self.sede_a.id): 5},
        }, format='json')
        self.assertEqual(r.status_code, 200, r.data)


class RolBloqueadoTest(APITestCase):
    """Rol es un catálogo global (sin FK a Negocio): ningún dueño debe poder
    editarlo/borrarlo, solo leerlo — ver SoloLecturaSalvoSuperUsuario."""

    def setUp(self):
        self.user = User.objects.create_user(username='dueno_rol', password='x')
        self.negocio = Negocio.objects.create(
            propietario=self.user, nombre='Negocio Rol',
            fin_prueba=timezone.now() + timedelta(days=30))
        self.rol = Rol.objects.create(nombre=f'Cajero-{self.id()}', puede_cobrar=True)
        self.client.force_authenticate(user=self.user)

    def test_dueno_puede_listar_roles(self):
        r = self.client.get('/api/roles/')
        self.assertEqual(r.status_code, 200)

    def test_dueno_no_puede_editar_un_rol(self):
        r = self.client.patch(f'/api/roles/{self.rol.id}/', {'puede_cobrar': False}, format='json')
        self.assertEqual(r.status_code, 403)
        self.rol.refresh_from_db()
        self.assertTrue(self.rol.puede_cobrar)

    def test_dueno_no_puede_borrar_un_rol(self):
        r = self.client.delete(f'/api/roles/{self.rol.id}/')
        self.assertEqual(r.status_code, 403)
        self.assertTrue(Rol.objects.filter(id=self.rol.id).exists())

    def test_dueno_no_puede_crear_un_rol(self):
        r = self.client.post('/api/roles/', {'nombre': 'Nuevo Rol'}, format='json')
        self.assertEqual(r.status_code, 403)

    def test_superusuario_si_puede_editar_un_rol(self):
        su = User.objects.create_superuser(username='staff_leybrak', password='x', email='x@x.com')
        self.client.force_authenticate(user=su)
        r = self.client.patch(f'/api/roles/{self.rol.id}/', {'puede_cobrar': False}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
