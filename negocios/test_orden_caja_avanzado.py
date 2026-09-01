"""
Cobertura adicional del núcleo POS que no estaba en test_cobro.py/test_caja.py:
agregar productos y anular ítems de una orden en curso, que las reglas de
negocio (recargos/descuentos) se reflejen en el total a cobrar, que un pago
ya confirmado por la app de Yape/Plin sobreviva a un reintento de cobro
manual, movimientos de caja chica vía el endpoint real (no solo el ORM), y
el aislamiento multi-tenant de abrir/cerrar caja — este último es un bug de
seguridad real encontrado y corregido en la misma sesión que este archivo
(abrir_caja/cerrar_caja/estado_actual tomaban el sede_id del body sin
validar que perteneciera al negocio de quien llama).
"""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APITestCase

from negocios.models import (
    Negocio, Sede, Producto, Orden, Empleado, Rol, Pago, SesionCaja,
    NotificacionPago, RegistroAuditoria, ReglaNegocio,
)


def _hdr(empleado):
    return {'HTTP_X_EMPLEADO_ID': str(empleado.id)}


class BaseOrdenTest(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user(username='dueno', password='x')
        self.negocio = Negocio.objects.create(
            propietario=self.user, nombre='Mi Negocio',
            fin_prueba=timezone.now() + timedelta(days=30))
        self.sede = Sede.objects.create(negocio=self.negocio, nombre='Principal')
        self.rol_cajero = Rol.objects.create(nombre='Cajero', puede_cobrar=True)
        self.cajero = Empleado.objects.create(
            negocio=self.negocio, sede=self.sede, nombre='Caja', pin='1111', rol=self.rol_cajero)
        self.prod = Producto.objects.create(
            negocio=self.negocio, nombre='Lomo Saltado', precio_base=Decimal('25.00'))
        self.sesion_caja = SesionCaja.objects.create(
            sede=self.sede, estado='abierta', fondo_inicial=Decimal('100'))
        self.client.force_authenticate(user=self.user)

    def _crear_orden(self, cantidad=1, producto=None):
        resp = self.client.post('/api/ordenes/', {
            'sede': self.sede.id, 'tipo': 'llevar',
            'detalles': [{'producto': (producto or self.prod).id, 'cantidad': cantidad}],
        }, format='json', **_hdr(self.cajero))
        self.assertEqual(resp.status_code, 201, resp.data)
        return Orden.objects.get(id=resp.data['id'])


class AgregarProductosTest(BaseOrdenTest):

    def test_agregar_productos_recalcula_el_total(self):
        orden = self._crear_orden()  # 25.00
        prod2 = Producto.objects.create(negocio=self.negocio, nombre='Chicha Morada', precio_base=Decimal('8.00'))
        resp = self.client.post(f'/api/ordenes/{orden.id}/agregar_productos/', {
            'detalles': [{'producto': prod2.id, 'cantidad': 2}],
        }, format='json', **_hdr(self.cajero))
        self.assertEqual(resp.status_code, 200, resp.data)

        orden.refresh_from_db()
        self.assertEqual(orden.total, Decimal('41.00'))  # 25 + 8*2
        self.assertEqual(orden.detalles.count(), 2)

    def test_no_se_puede_agregar_a_orden_pagada(self):
        orden = self._crear_orden()
        orden.estado_pago = 'pagado'
        orden.estado = 'completado'
        orden.save()

        resp = self.client.post(f'/api/ordenes/{orden.id}/agregar_productos/', {
            'detalles': [{'producto': self.prod.id, 'cantidad': 1}],
        }, format='json', **_hdr(self.cajero))
        self.assertEqual(resp.status_code, 400)
        orden.refresh_from_db()
        self.assertEqual(orden.detalles.count(), 1)

    def test_no_se_puede_agregar_a_orden_cancelada(self):
        # Nota: el queryset de OrdenViewSet ya excluye 'cancelado' para el
        # empleado (lista de trabajo del día) — nunca llega al chequeo
        # explícito del action; da 404 en vez de 400, pero el resultado
        # (no se puede modificar) es el mismo.
        orden = self._crear_orden()
        orden.estado = 'cancelado'
        orden.estado_pago = 'reembolsado'
        orden.save()

        resp = self.client.post(f'/api/ordenes/{orden.id}/agregar_productos/', {
            'detalles': [{'producto': self.prod.id, 'cantidad': 1}],
        }, format='json', **_hdr(self.cajero))
        self.assertEqual(resp.status_code, 404)
        orden.refresh_from_db()
        self.assertEqual(orden.detalles.count(), 1)


class AnularItemTest(BaseOrdenTest):

    def test_anular_item_recalcula_total_y_deja_auditoria(self):
        orden = self._crear_orden(cantidad=2)  # 50.00
        detalle = orden.detalles.first()

        resp = self.client.post(f'/api/ordenes/{orden.id}/anular_item/', {
            'detalle_id': detalle.id, 'motivo': 'Cliente se arrepintió',
        }, format='json', **_hdr(self.cajero))
        self.assertEqual(resp.status_code, 200, resp.data)

        orden.refresh_from_db()
        self.assertEqual(orden.detalles.count(), 0)
        self.assertEqual(orden.total, Decimal('0.00'))

        auditoria = RegistroAuditoria.objects.get(orden=orden)
        self.assertEqual(auditoria.accion, 'anular_plato')
        self.assertIn('Cliente se arrepintió', auditoria.descripcion)

    def test_anular_item_inexistente_da_error_controlado(self):
        orden = self._crear_orden()
        resp = self.client.post(f'/api/ordenes/{orden.id}/anular_item/', {
            'detalle_id': 99999,
        }, format='json', **_hdr(self.cajero))
        self.assertEqual(resp.status_code, 400)


class ReglasDeNegocioEnCobroTest(BaseOrdenTest):

    def test_recargo_por_llevar_se_refleja_en_el_total_a_cobrar(self):
        ReglaNegocio.objects.create(
            negocio=self.negocio, tipo='recargo_llevar', valor=Decimal('2.00'),
            es_porcentaje=False, condicion_tipo_orden='cualquiera')

        orden = self._crear_orden()  # 25.00 + 2.00 recargo
        orden.refresh_from_db()
        self.assertEqual(orden.total, Decimal('27.00'))

        resp = self.client.post(f'/api/ordenes/{orden.id}/cobrar_orden/', {
            'pagos': [{'metodo': 'efectivo', 'monto': '27.00'}],
            'sesion_caja_id': self.sesion_caja.id,
        }, format='json', **_hdr(self.cajero))
        self.assertEqual(resp.status_code, 200, resp.data)
        orden.refresh_from_db()
        self.assertEqual(orden.estado_pago, 'pagado')

    def test_descuento_por_dia_reduce_el_total(self):
        hoy = timezone.localtime().weekday()
        ReglaNegocio.objects.create(
            negocio=self.negocio, tipo='descuento_dia', valor=Decimal('5.00'),
            es_porcentaje=False, dia_semana=hoy, condicion_tipo_orden='cualquiera')

        orden = self._crear_orden()  # 25.00 - 5.00
        orden.refresh_from_db()
        self.assertEqual(orden.total, Decimal('20.00'))


class PagoConfirmadoPorAppSobreviveReintentoTest(BaseOrdenTest):

    def test_pago_confirmado_por_notificacion_no_se_cancela_ni_se_duplica(self):
        orden = self._crear_orden()  # total 25.00
        notif = NotificacionPago.objects.create(
            negocio=self.negocio, tipo='YAPE', monto=Decimal('25.00'), nombre_cliente='Juan Pérez')
        pago_app = Pago.objects.create(
            orden=orden, metodo='yape', monto=Decimal('25.00'), sesion_caja=self.sesion_caja,
            notificacion_origen=notif, estado='confirmado')

        # El cajero, sin saber que la app ya validó el Yape, intenta cobrar de nuevo.
        resp = self.client.post(f'/api/ordenes/{orden.id}/cobrar_orden/', {
            'pagos': [{'metodo': 'yape', 'monto': '25.00'}],
            'sesion_caja_id': self.sesion_caja.id,
        }, format='json', **_hdr(self.cajero))
        self.assertEqual(resp.status_code, 200, resp.data)

        pago_app.refresh_from_db()
        self.assertEqual(pago_app.estado, 'confirmado')  # sobrevive, no se cancela
        self.assertEqual(
            Pago.objects.filter(orden=orden, metodo='yape', estado='confirmado').count(), 1)  # no se duplica

        orden.refresh_from_db()
        self.assertEqual(orden.estado_pago, 'pagado')


class ProductoNoDisponibleTest(BaseOrdenTest):

    def test_no_se_puede_crear_orden_con_producto_agotado(self):
        self.prod.disponible = False
        self.prod.save()

        resp = self.client.post('/api/ordenes/', {
            'sede': self.sede.id, 'tipo': 'llevar',
            'detalles': [{'producto': self.prod.id, 'cantidad': 1}],
        }, format='json', **_hdr(self.cajero))
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(Orden.objects.count(), 0)


class MovimientoCajaEndpointTest(BaseOrdenTest):

    def test_registrar_movimiento_via_endpoint(self):
        resp = self.client.post('/api/movimientos-caja/', {
            'sesion_caja_id': self.sesion_caja.id, 'empleado_id': self.cajero.id,
            'tipo': 'egreso', 'monto': '15.00', 'concepto': 'Compra de hielo',
        }, format='json', **_hdr(self.cajero))
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(self.sesion_caja.movimientos.count(), 1)

    def test_no_puede_registrar_movimiento_en_sesion_de_otro_negocio(self):
        otro_user = User.objects.create_user(username='otro_dueno', password='x')
        otro_negocio = Negocio.objects.create(
            propietario=otro_user, nombre='Otro Negocio',
            fin_prueba=timezone.now() + timedelta(days=30))
        otra_sede = Sede.objects.create(negocio=otro_negocio, nombre='Otra sede')
        otra_sesion = SesionCaja.objects.create(sede=otra_sede, estado='abierta', fondo_inicial=Decimal('0'))

        resp = self.client.post('/api/movimientos-caja/', {
            'sesion_caja_id': otra_sesion.id, 'empleado_id': self.cajero.id,
            'tipo': 'ingreso', 'monto': '999.00', 'concepto': 'Intento cruzado',
        }, format='json', **_hdr(self.cajero))
        self.assertEqual(resp.status_code, 403)
        self.assertEqual(otra_sesion.movimientos.count(), 0)


class CajaCrossTenantTest(APITestCase):
    """
    Regresión del bug de seguridad: abrir_caja/cerrar_caja/estado_actual
    tomaban el sede_id tal cual del body/query, sin validar que la sede
    perteneciera al negocio autenticado — cualquier negocio podía abrir,
    cerrar o ver el fondo de caja de OTRO negocio con solo adivinar un
    sede_id (son enteros correlativos).
    """

    def setUp(self):
        self.user = User.objects.create_user(username='dueno', password='x')
        self.negocio = Negocio.objects.create(
            propietario=self.user, nombre='Mi Negocio',
            fin_prueba=timezone.now() + timedelta(days=30))
        self.sede = Sede.objects.create(negocio=self.negocio, nombre='Principal')

        self.otro_user = User.objects.create_user(username='otro_dueno', password='x')
        self.otro_negocio = Negocio.objects.create(
            propietario=self.otro_user, nombre='Otro Negocio',
            fin_prueba=timezone.now() + timedelta(days=30))
        self.otra_sede = Sede.objects.create(negocio=self.otro_negocio, nombre='Otra sede')

        self.client.force_authenticate(user=self.user)

    def test_no_puede_abrir_caja_en_sede_de_otro_negocio(self):
        resp = self.client.post('/api/sesiones_caja/abrir_caja/', {
            'sede_id': self.otra_sede.id, 'fondo_inicial': '100.00',
        }, format='json')
        self.assertEqual(resp.status_code, 403)
        self.assertFalse(SesionCaja.objects.filter(sede=self.otra_sede).exists())

    def test_no_puede_cerrar_caja_de_otro_negocio(self):
        sesion_ajena = SesionCaja.objects.create(
            sede=self.otra_sede, estado='abierta', fondo_inicial=Decimal('500'))

        resp = self.client.post('/api/sesiones_caja/cerrar_caja/', {
            'sede_id': self.otra_sede.id, 'conteo_efectivo': '0',
        }, format='json')
        self.assertEqual(resp.status_code, 403)

        sesion_ajena.refresh_from_db()
        self.assertEqual(sesion_ajena.estado, 'abierta')  # sigue abierta

    def test_no_puede_ver_estado_de_caja_de_otro_negocio(self):
        SesionCaja.objects.create(sede=self.otra_sede, estado='abierta', fondo_inicial=Decimal('777'))

        resp = self.client.get('/api/sesiones_caja/estado_actual/', {'sede_id': self.otra_sede.id})
        self.assertEqual(resp.status_code, 403)

    def test_si_puede_abrir_y_ver_su_propia_sede(self):
        resp = self.client.post('/api/sesiones_caja/abrir_caja/', {
            'sede_id': self.sede.id, 'fondo_inicial': '100.00',
        }, format='json')
        self.assertEqual(resp.status_code, 200, resp.data)

        resp = self.client.get('/api/sesiones_caja/estado_actual/', {'sede_id': self.sede.id})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['estado'], 'abierto')


class ZonaHorariaNocturnaTest(BaseOrdenTest):
    """
    Regresión de un bug real encontrado escribiendo estos tests: varios
    lugares calculaban "hoy" con timezone.now().date() (día calendario en
    UTC) en vez de timezone.localtime().date() (día calendario en Lima,
    TIME_ZONE del proyecto). Lima es UTC-5, así que entre las 19:00 y la
    medianoche hora de Lima, el UTC ya está en el día siguiente — durante
    esa ventana (justo la hora pico de cena de un restaurante) "hoy" en
    UTC no coincidía con "hoy" en Lima, y órdenes recién creadas
    desaparecían de la lista de trabajo del día y del dashboard de ventas.
    Se fuerza un "ahora" a las 22:00 hora de Lima (03:00 UTC del día
    siguiente) para reproducir esa ventana exacta.
    """

    def _ahora_lima_22h(self):
        # 2026-08-31 22:00 America/Lima == 2026-09-01 03:00 UTC
        import datetime
        return datetime.datetime(2026, 9, 1, 3, 0, 0, tzinfo=datetime.timezone.utc)

    def test_orden_creada_de_noche_sigue_visible_en_la_lista_del_dia(self):
        from unittest.mock import patch
        with patch('django.utils.timezone.now', return_value=self._ahora_lima_22h()):
            orden = self._crear_orden()
            orden.estado_pago = 'pagado'
            orden.estado = 'completado'
            orden.save()

            resp = self.client.get('/api/ordenes/', **_hdr(self.cajero))
            self.assertEqual(resp.status_code, 200)
            filas = resp.data if isinstance(resp.data, list) else resp.data['results']
            self.assertIn(orden.id, [f['id'] for f in filas])

    def test_dashboard_de_ventas_cuenta_las_ordenes_de_la_noche(self):
        from unittest.mock import patch
        with patch('django.utils.timezone.now', return_value=self._ahora_lima_22h()):
            orden = self._crear_orden()
            resp = self.client.post(f'/api/ordenes/{orden.id}/cobrar_orden/', {
                'pagos': [{'metodo': 'efectivo', 'monto': '25.00'}],
                'sesion_caja_id': self.sesion_caja.id,
            }, format='json', **_hdr(self.cajero))
            self.assertEqual(resp.status_code, 200, resp.data)

            resp = self.client.get('/api/dashboard/metricas/', {'sede_id': self.sede.id})
            self.assertEqual(resp.status_code, 200, resp.data)
            self.assertEqual(resp.data['ordenes'], 1)
            self.assertEqual(resp.data['ventas'], 25.0)
