"""
Tests de apertura y cierre de caja: fondo inicial, no permitir dos cajas
abiertas a la vez, y el arqueo al cerrar (ventas por método, movimientos
de caja chica, y la diferencia contra lo declarado por el cajero).
"""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APITestCase

from negocios.models import (
    Negocio, Sede, Producto, Orden, Pago, Empleado, Rol, SesionCaja, MovimientoCaja,
)

ABRIR_URL = '/api/sesiones_caja/abrir_caja/'
CERRAR_URL = '/api/sesiones_caja/cerrar_caja/'
ESTADO_URL = '/api/sesiones_caja/estado_actual/'
MOVIMIENTO_URL = '/api/movimientos-caja/'


class CajaTest(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user(username='dueno', password='x')
        self.negocio = Negocio.objects.create(
            propietario=self.user, nombre='Mi Negocio',
            fin_prueba=timezone.now() + timedelta(days=30))
        self.sede = Sede.objects.create(negocio=self.negocio, nombre='Principal')
        self.rol_cajero = Rol.objects.create(nombre='Cajero', puede_cobrar=True)
        self.cajero = Empleado.objects.create(
            negocio=self.negocio, sede=self.sede, nombre='Caja', pin='1111', rol=self.rol_cajero)
        self.client.force_authenticate(user=self.user)

    def _orden_pagada(self, metodo, monto, sesion):
        orden = Orden.objects.create(
            sede=self.sede, tipo='llevar', estado='completado', estado_pago='pagado',
            total=Decimal(str(monto)))
        Pago.objects.create(orden=orden, metodo=metodo, monto=Decimal(str(monto)), sesion_caja=sesion)
        return orden

    # ── Apertura ───────────────────────────────────────────────────
    def test_abrir_caja_crea_sesion_abierta(self):
        resp = self.client.post(ABRIR_URL, {
            'sede_id': self.sede.id, 'empleado_id': self.cajero.id, 'fondo_inicial': '100.00',
        }, format='json')
        self.assertEqual(resp.status_code, 200, resp.data)

        sesion = SesionCaja.objects.get(id=resp.data['id'])
        self.assertEqual(sesion.estado, 'abierta')
        self.assertEqual(sesion.fondo_inicial, Decimal('100.00'))
        self.assertEqual(sesion.sede_id, self.sede.id)

    def test_estado_actual_refleja_caja_abierta(self):
        SesionCaja.objects.create(sede=self.sede, estado='abierta', fondo_inicial=Decimal('50'))
        resp = self.client.get(ESTADO_URL, {'sede_id': self.sede.id})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['estado'], 'abierto')

    def test_no_se_puede_abrir_dos_cajas_en_la_misma_sede(self):
        SesionCaja.objects.create(sede=self.sede, estado='abierta', fondo_inicial=Decimal('100'))
        resp = self.client.post(ABRIR_URL, {
            'sede_id': self.sede.id, 'empleado_id': self.cajero.id, 'fondo_inicial': '50.00',
        }, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(SesionCaja.objects.filter(sede=self.sede, estado='abierta').count(), 1)

    # ── Cierre: arqueo básico ─────────────────────────────────────
    def test_cerrar_caja_sin_sesion_abierta_da_error(self):
        resp = self.client.post(CERRAR_URL, {'sede_id': self.sede.id}, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_cerrar_caja_calcula_esperado_efectivo_con_fondo_y_ventas(self):
        sesion = SesionCaja.objects.create(sede=self.sede, estado='abierta', fondo_inicial=Decimal('100'))
        self._orden_pagada('efectivo', '50.00', sesion)

        resp = self.client.post(CERRAR_URL, {
            'sede_id': self.sede.id, 'empleado_id': self.cajero.id,
            'conteo_efectivo': '150.00', 'conteo_yape': '0', 'conteo_tarjeta': '0',
        }, format='json')
        self.assertEqual(resp.status_code, 200, resp.data)

        sesion.refresh_from_db()
        self.assertEqual(sesion.estado, 'cerrada')
        # esperado = fondo_inicial(100) + efectivo(50) = 150
        self.assertEqual(sesion.esperado_efectivo, Decimal('150.00'))
        self.assertEqual(sesion.ventas_efectivo, Decimal('50.00'))
        self.assertEqual(sesion.diferencia, Decimal('0.00'))

    def test_cerrar_caja_detecta_faltante_de_efectivo(self):
        sesion = SesionCaja.objects.create(sede=self.sede, estado='abierta', fondo_inicial=Decimal('100'))
        self._orden_pagada('efectivo', '50.00', sesion)

        resp = self.client.post(CERRAR_URL, {
            'sede_id': self.sede.id, 'conteo_efectivo': '140.00',
        }, format='json')
        self.assertEqual(resp.status_code, 200, resp.data)
        # esperado 150, declarado 140 -> faltan 10
        self.assertEqual(Decimal(str(resp.data['diferencia'])), Decimal('-10.00'))

    # ── Cierre: ventas por Yape y Plin (bug ya arreglado) ──────────
    def test_cerrar_caja_suma_yape_y_plin_como_digital(self):
        sesion = SesionCaja.objects.create(sede=self.sede, estado='abierta', fondo_inicial=Decimal('0'))
        self._orden_pagada('yape', '30.00', sesion)
        self._orden_pagada('plin', '20.00', sesion)

        resp = self.client.post(CERRAR_URL, {
            'sede_id': self.sede.id, 'conteo_efectivo': '0', 'conteo_yape': '50.00',
        }, format='json')
        self.assertEqual(resp.status_code, 200, resp.data)

        sesion.refresh_from_db()
        # Yape + Plin deben sumarse juntos: el sistema esperaba 50, el cajero declaró 50.
        self.assertEqual(sesion.ventas_digitales, Decimal('50.00'))
        self.assertEqual(Decimal(str(resp.data['diferencia_yape'])), Decimal('0.00'))

    # ── Cierre: caja chica (ingresos/egresos) ──────────────────────
    def test_cerrar_caja_considera_ingresos_y_egresos_de_caja_chica(self):
        sesion = SesionCaja.objects.create(sede=self.sede, estado='abierta', fondo_inicial=Decimal('100'))
        MovimientoCaja.objects.create(
            sede=self.sede, sesion_caja=sesion, tipo='ingreso', monto=Decimal('20'), concepto='Vuelto extra')
        MovimientoCaja.objects.create(
            sede=self.sede, sesion_caja=sesion, tipo='egreso', monto=Decimal('15'), concepto='Compra de hielo')

        resp = self.client.post(CERRAR_URL, {
            'sede_id': self.sede.id, 'conteo_efectivo': '105.00',
        }, format='json')
        self.assertEqual(resp.status_code, 200, resp.data)

        sesion.refresh_from_db()
        # esperado = fondo(100) + ventas(0) + ingresos(20) - egresos(15) = 105
        self.assertEqual(sesion.esperado_efectivo, Decimal('105.00'))
        self.assertEqual(sesion.diferencia, Decimal('0.00'))

    # ── Aislamiento multi-tenant ─────────────────────────────────────
    def test_no_ve_sesiones_de_caja_de_otro_negocio(self):
        propia = SesionCaja.objects.create(sede=self.sede, estado='abierta', fondo_inicial=Decimal('100'))

        otro_user = User.objects.create_user(username='otro_dueno', password='x')
        otro_negocio = Negocio.objects.create(
            propietario=otro_user, nombre='Otro Negocio',
            fin_prueba=timezone.now() + timedelta(days=30))
        otra_sede = Sede.objects.create(negocio=otro_negocio, nombre='Otra sede')
        SesionCaja.objects.create(sede=otra_sede, estado='abierta', fondo_inicial=Decimal('999'))

        resp = self.client.get('/api/sesiones_caja/')
        self.assertEqual(resp.status_code, 200)
        filas = resp.data if isinstance(resp.data, list) else resp.data['results']
        self.assertEqual([f['id'] for f in filas], [propia.id])
