"""
Cubre el enganche entre Combos Normales (Producto.es_combo + ComponenteCombo)
y el descuento de stock de inventario (negocios/signals.py).

Bug encontrado en auditoría manual (sin tests previos de combos): el signal
que descuenta stock al cobrar buscaba la receta (RecetaDetalle) del producto
vendido tal cual — para un combo eso es casi siempre una lista vacía, porque
la receta real vive en los productos que lo componen (ComponenteCombo), no
en el combo. Resultado: vender un combo no descontaba nada del inventario.
"""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APITestCase

from negocios.models import (
    Negocio, Sede, Producto, Orden, Empleado, Rol, SesionCaja,
    ComponenteCombo, InsumoBase, InsumoSede, RecetaDetalle,
    GrupoVariacion, OpcionVariacion, RecetaOpcion,
)


def _hdr(empleado):
    return {'HTTP_X_EMPLEADO_ID': str(empleado.id)}


class DescuentoStockComboTest(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user(username='dueno', password='x')
        self.negocio = Negocio.objects.create(
            propietario=self.user, nombre='Mi Negocio',
            fin_prueba=timezone.now() + timedelta(days=30))
        self.sede = Sede.objects.create(negocio=self.negocio, nombre='Principal')
        self.rol_cajero = Rol.objects.create(nombre='Cajero', puede_cobrar=True)
        self.cajero = Empleado.objects.create(
            negocio=self.negocio, sede=self.sede, nombre='Caja', pin='1111', rol=self.rol_cajero)
        self.sesion_caja = SesionCaja.objects.create(
            sede=self.sede, estado='abierta', fondo_inicial=Decimal('100'))
        self.client.force_authenticate(user=self.user)

        # Insumos con stock inicial
        self.pan = InsumoBase.objects.create(negocio=self.negocio, nombre='Pan', unidad_medida='unidades')
        self.carne = InsumoBase.objects.create(negocio=self.negocio, nombre='Carne', unidad_medida='g')
        self.gaseosa = InsumoBase.objects.create(negocio=self.negocio, nombre='Gaseosa', unidad_medida='ml')
        InsumoSede.objects.create(sede=self.sede, insumo_base=self.pan, stock_actual=Decimal('100'))
        InsumoSede.objects.create(sede=self.sede, insumo_base=self.carne, stock_actual=Decimal('5000'))
        InsumoSede.objects.create(sede=self.sede, insumo_base=self.gaseosa, stock_actual=Decimal('10000'))

        # Productos reales que componen el combo, cada uno con su receta
        self.hamburguesa = Producto.objects.create(
            negocio=self.negocio, nombre='Hamburguesa', precio_base=Decimal('15.00'))
        RecetaDetalle.objects.create(producto=self.hamburguesa, insumo=self.pan, cantidad_necesaria=Decimal('1'))
        RecetaDetalle.objects.create(producto=self.hamburguesa, insumo=self.carne, cantidad_necesaria=Decimal('150'))

        self.gaseosa_prod = Producto.objects.create(
            negocio=self.negocio, nombre='Gaseosa 500ml', precio_base=Decimal('5.00'))
        RecetaDetalle.objects.create(producto=self.gaseosa_prod, insumo=self.gaseosa, cantidad_necesaria=Decimal('500'))

        # El combo en sí — sin receta propia, como lo arma el modal de combos
        self.combo = Producto.objects.create(
            negocio=self.negocio, nombre='Combo Hamburguesa', precio_base=Decimal('18.00'), es_combo=True)
        ComponenteCombo.objects.create(combo=self.combo, producto_hijo=self.hamburguesa, cantidad=1)
        ComponenteCombo.objects.create(combo=self.combo, producto_hijo=self.gaseosa_prod, cantidad=1)

    def _cobrar_combo(self, cantidad=1):
        resp = self.client.post('/api/ordenes/', {
            'sede': self.sede.id, 'tipo': 'llevar',
            'detalles': [{'producto': self.combo.id, 'cantidad': cantidad}],
        }, format='json', **_hdr(self.cajero))
        self.assertEqual(resp.status_code, 201, resp.data)
        orden = Orden.objects.get(id=resp.data['id'])

        resp = self.client.post(
            f'/api/ordenes/{orden.id}/cobrar_orden/',
            {'pagos': [{'metodo': 'efectivo', 'monto': str(self.combo.precio_base * cantidad)}],
             'sesion_caja_id': self.sesion_caja.id},
            format='json', **_hdr(self.cajero))
        self.assertEqual(resp.status_code, 200, resp.data)
        return orden

    def test_vender_combo_descuenta_stock_de_sus_componentes(self):
        self._cobrar_combo(cantidad=1)

        self.assertEqual(
            InsumoSede.objects.get(sede=self.sede, insumo_base=self.pan).stock_actual, Decimal('99'))
        self.assertEqual(
            InsumoSede.objects.get(sede=self.sede, insumo_base=self.carne).stock_actual, Decimal('4850'))
        self.assertEqual(
            InsumoSede.objects.get(sede=self.sede, insumo_base=self.gaseosa).stock_actual, Decimal('9500'))

    def test_vender_dos_combos_descuenta_el_doble(self):
        self._cobrar_combo(cantidad=2)

        self.assertEqual(
            InsumoSede.objects.get(sede=self.sede, insumo_base=self.pan).stock_actual, Decimal('98'))
        self.assertEqual(
            InsumoSede.objects.get(sede=self.sede, insumo_base=self.carne).stock_actual, Decimal('4700'))
        self.assertEqual(
            InsumoSede.objects.get(sede=self.sede, insumo_base=self.gaseosa).stock_actual, Decimal('9000'))

    def test_combo_con_opcion_preseleccionada_descuenta_tambien_esa_receta(self):
        # El componente "Gaseosa" del combo viene con tamaño preseleccionado
        # (ej. "1 Litro" en vez del 500ml base), y esa opción tiene su propia receta.
        grupo = GrupoVariacion.objects.create(producto=self.gaseosa_prod, nombre='Tamaño')
        opcion_litro = OpcionVariacion.objects.create(grupo=grupo, nombre='1 Litro', precio_adicional=Decimal('2.00'))
        litro_insumo = InsumoBase.objects.create(negocio=self.negocio, nombre='Gaseosa 1L', unidad_medida='ml')
        InsumoSede.objects.create(sede=self.sede, insumo_base=litro_insumo, stock_actual=Decimal('20000'))
        RecetaOpcion.objects.create(opcion=opcion_litro, insumo=litro_insumo, cantidad_necesaria=Decimal('1000'))

        comp_gaseosa = ComponenteCombo.objects.get(combo=self.combo, producto_hijo=self.gaseosa_prod)
        comp_gaseosa.opcion_seleccionada = opcion_litro
        comp_gaseosa.save()

        self._cobrar_combo(cantidad=1)

        # La receta base de la gaseosa 500ml SÍ se descuenta (queda tal cual el combo la definió)...
        self.assertEqual(
            InsumoSede.objects.get(sede=self.sede, insumo_base=self.gaseosa).stock_actual, Decimal('9500'))
        # ...y ADEMÁS se descuenta la receta de la opción "1 Litro" preseleccionada.
        self.assertEqual(
            InsumoSede.objects.get(sede=self.sede, insumo_base=litro_insumo).stock_actual, Decimal('19000'))

    def test_vender_plato_normal_sigue_descontando_su_propia_receta_como_antes(self):
        # Regresión: un producto que NO es combo debe seguir funcionando exactamente igual.
        resp = self.client.post('/api/ordenes/', {
            'sede': self.sede.id, 'tipo': 'llevar',
            'detalles': [{'producto': self.hamburguesa.id, 'cantidad': 1}],
        }, format='json', **_hdr(self.cajero))
        self.assertEqual(resp.status_code, 201, resp.data)
        orden = Orden.objects.get(id=resp.data['id'])

        resp = self.client.post(
            f'/api/ordenes/{orden.id}/cobrar_orden/',
            {'pagos': [{'metodo': 'efectivo', 'monto': '15.00'}], 'sesion_caja_id': self.sesion_caja.id},
            format='json', **_hdr(self.cajero))
        self.assertEqual(resp.status_code, 200, resp.data)

        self.assertEqual(
            InsumoSede.objects.get(sede=self.sede, insumo_base=self.pan).stock_actual, Decimal('99'))
        self.assertEqual(
            InsumoSede.objects.get(sede=self.sede, insumo_base=self.carne).stock_actual, Decimal('4850'))
