"""
Tests del flujo core de cobro del POS: crear orden, cobrarla (completa,
dividida y parcial), RBAC de quién puede cobrar, no duplicar pagos en un
reintento, y aislamiento multi-tenant al cobrar.

Este es el flujo que genera la plata real de cada negocio cliente — es el
que más debe estar cubierto antes de vender el producto a terceros.
"""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APITestCase

from negocios.models import (
    Negocio, Sede, Producto, Orden, DetalleOrden, Empleado, Rol, Pago, SesionCaja,
)


def _hdr(empleado):
    return {'HTTP_X_EMPLEADO_ID': str(empleado.id)}


class CobroOrdenTest(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user(username='dueno', password='x')
        self.negocio = Negocio.objects.create(
            propietario=self.user, nombre='Mi Negocio',
            fin_prueba=timezone.now() + timedelta(days=30))
        self.sede = Sede.objects.create(negocio=self.negocio, nombre='Principal')

        self.rol_cajero = Rol.objects.create(nombre='Cajero', puede_cobrar=True)
        self.rol_mesero = Rol.objects.create(nombre='Mesero', puede_cobrar=False)
        self.cajero = Empleado.objects.create(
            negocio=self.negocio, sede=self.sede, nombre='Caja', pin='1111', rol=self.rol_cajero)
        self.mesero = Empleado.objects.create(
            negocio=self.negocio, sede=self.sede, nombre='Mesa', pin='2222', rol=self.rol_mesero)

        self.prod = Producto.objects.create(
            negocio=self.negocio, nombre='Lomo Saltado', precio_base=Decimal('25.00'))

        self.sesion_caja = SesionCaja.objects.create(
            sede=self.sede, estado='abierta', fondo_inicial=Decimal('100'))

        self.client.force_authenticate(user=self.user)

    def _crear_orden(self, cantidad=1):
        resp = self.client.post('/api/ordenes/', {
            'sede': self.sede.id,
            'tipo': 'llevar',
            'detalles': [{'producto': self.prod.id, 'cantidad': cantidad}],
        }, format='json', **_hdr(self.mesero))
        self.assertEqual(resp.status_code, 201, resp.data)
        return Orden.objects.get(id=resp.data['id'])

    def _cobrar(self, orden, pagos, empleado):
        return self.client.post(
            f'/api/ordenes/{orden.id}/cobrar_orden/',
            {'pagos': pagos, 'sesion_caja_id': self.sesion_caja.id},
            format='json', **_hdr(empleado))

    # ── Creación ───────────────────────────────────────────────────
    def test_crear_orden_calcula_total_desde_productos(self):
        orden = self._crear_orden(cantidad=2)
        self.assertEqual(orden.subtotal, Decimal('50.00'))
        self.assertEqual(orden.total, Decimal('50.00'))
        self.assertEqual(orden.estado_pago, 'pendiente')

    # ── Cobro completo ─────────────────────────────────────────────
    def test_cobro_efectivo_completo_marca_pagado(self):
        orden = self._crear_orden()
        resp = self._cobrar(orden, [{'metodo': 'efectivo', 'monto': '25.00'}], self.cajero)
        self.assertEqual(resp.status_code, 200, resp.data)

        orden.refresh_from_db()
        self.assertEqual(orden.estado_pago, 'pagado')
        self.assertEqual(orden.estado, 'completado')

        pago = Pago.objects.get(orden=orden)
        self.assertEqual(pago.monto, Decimal('25.00'))
        self.assertEqual(pago.metodo, 'efectivo')
        self.assertEqual(pago.sesion_caja_id, self.sesion_caja.id)

    def test_cobro_dividido_efectivo_y_tarjeta(self):
        orden = self._crear_orden()
        resp = self._cobrar(orden, [
            {'metodo': 'efectivo', 'monto': '10.00'},
            {'metodo': 'tarjeta', 'monto': '15.00'},
        ], self.cajero)
        self.assertEqual(resp.status_code, 200, resp.data)

        orden.refresh_from_db()
        self.assertEqual(orden.estado_pago, 'pagado')
        self.assertEqual(Pago.objects.filter(orden=orden).count(), 2)

    # ── Pago parcial ───────────────────────────────────────────────
    def test_pago_parcial_no_marca_pagado(self):
        orden = self._crear_orden()
        resp = self._cobrar(orden, [{'metodo': 'efectivo', 'monto': '10.00'}], self.cajero)
        self.assertEqual(resp.status_code, 200, resp.data)

        orden.refresh_from_db()
        self.assertEqual(orden.estado_pago, 'pendiente')
        self.assertNotEqual(orden.estado, 'completado')

    # ── RBAC ───────────────────────────────────────────────────────
    def test_mesero_sin_permiso_no_puede_cobrar(self):
        orden = self._crear_orden()
        resp = self._cobrar(orden, [{'metodo': 'efectivo', 'monto': '25.00'}], self.mesero)
        self.assertEqual(resp.status_code, 403)

        orden.refresh_from_db()
        self.assertEqual(orden.estado_pago, 'pendiente')
        self.assertEqual(Pago.objects.filter(orden=orden).count(), 0)

    # ── No duplicar pagos en un reintento ───────────────────────────
    def test_recobrar_misma_orden_no_deja_pagos_pendientes_duplicados(self):
        orden = self._crear_orden()
        # Primer intento: se equivocan y cobran de menos.
        self._cobrar(orden, [{'metodo': 'efectivo', 'monto': '10.00'}], self.cajero)
        # Segundo intento: corrigen con el monto completo.
        resp = self._cobrar(orden, [{'metodo': 'efectivo', 'monto': '25.00'}], self.cajero)
        self.assertEqual(resp.status_code, 200, resp.data)

        orden.refresh_from_db()
        self.assertEqual(orden.estado_pago, 'pagado')
        # El pago de S/10 del primer intento queda cancelado, no sumado al de S/25.
        self.assertEqual(
            Pago.objects.filter(orden=orden, estado='confirmado').count(), 1)
        self.assertEqual(
            Pago.objects.filter(orden=orden, estado='cancelado').count(), 1)

    # ── Aislamiento multi-tenant ─────────────────────────────────────
    def test_no_puede_cobrar_orden_de_otro_negocio(self):
        otro_user = User.objects.create_user(username='otro_dueno', password='x')
        otro_negocio = Negocio.objects.create(
            propietario=otro_user, nombre='Otro Negocio',
            fin_prueba=timezone.now() + timedelta(days=30))
        otra_sede = Sede.objects.create(negocio=otro_negocio, nombre='Otra sede')
        otro_prod = Producto.objects.create(
            negocio=otro_negocio, nombre='Otro plato', precio_base=Decimal('10.00'))
        otra_orden = Orden.objects.create(sede=otra_sede, tipo='llevar', total=Decimal('10.00'))
        DetalleOrden.objects.create(
            orden=otra_orden, producto=otro_prod, cantidad=1, precio_unitario=Decimal('10.00'))

        resp = self._cobrar(otra_orden, [{'metodo': 'efectivo', 'monto': '10.00'}], self.cajero)
        self.assertEqual(resp.status_code, 404)

        otra_orden.refresh_from_db()
        self.assertEqual(otra_orden.estado_pago, 'pendiente')
