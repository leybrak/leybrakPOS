"""
Tests del módulo de Pedidos/Compras (Proveedores + reabastecimiento interno).
Flujo: borrador → solicitado → confirmado → en_camino → recibido(_parcial),
con permisos por rol/sede y el aviso opcional de WhatsApp al proveedor.
"""
from decimal import Decimal
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APITestCase

from negocios.models import (
    Negocio, Sede, Empleado, Rol, InsumoBase, InsumoSede, Proveedor, OrdenCompra,
)


def _hdr(emp):
    return {'HTTP_X_EMPLEADO_ID': str(emp.id)}


class OrdenCompraTest(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user(username='dueno', password='x')
        self.negocio = Negocio.objects.create(
            propietario=self.user, nombre='Mi Negocio',
            fin_prueba=timezone.now() + timedelta(days=30))
        self.sede = Sede.objects.create(
            negocio=self.negocio, nombre='Principal', whatsapp_instancia='inst-1')
        self.sede2 = Sede.objects.create(negocio=self.negocio, nombre='Sucursal')

        self.rol_encargado = Rol.objects.create(nombre='Encargado', puede_configurar=True)
        self.rol_mesero = Rol.objects.create(nombre='Mesero')
        self.encargado = Empleado.objects.create(
            negocio=self.negocio, sede=self.sede, nombre='Enc', pin='1111', rol=self.rol_encargado)
        self.mesero = Empleado.objects.create(
            negocio=self.negocio, sede=self.sede, nombre='Mes', pin='2222', rol=self.rol_mesero)
        self.mesero_sede2 = Empleado.objects.create(
            negocio=self.negocio, sede=self.sede2, nombre='Mes2', pin='3333', rol=self.rol_mesero)

        self.insumo = InsumoBase.objects.create(
            negocio=self.negocio, nombre='Harina', unidad_medida='kg', stock_general=Decimal('0'))
        self.proveedor = Proveedor.objects.create(
            negocio=self.negocio, nombre='Distribuidora ABC', telefono='987654321')

        self.client.force_authenticate(user=self.user)

    def _crear_orden(self, origen='proveedor', **extra):
        payload = {
            'origen': origen,
            'lineas': [{'insumo_base': self.insumo.id, 'cantidad_pedida': '10.000'}],
        }
        payload.update(extra)
        return self.client.post('/api/ordenes-compra/', payload, format='json')

    # ── Creación ───────────────────────────────────────────────
    def test_dueno_crea_pedido_a_proveedor(self):
        r = self._crear_orden(origen='proveedor', proveedor=self.proveedor.id)
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data['estado'], 'borrador')
        self.assertEqual(len(r.data['lineas']), 1)

    def test_mesero_no_puede_crear_pedido_a_proveedor(self):
        payload = {
            'origen': 'proveedor', 'proveedor': self.proveedor.id,
            'lineas': [{'insumo_base': self.insumo.id, 'cantidad_pedida': '10.000'}],
        }
        r = self.client.post('/api/ordenes-compra/', payload, format='json', **_hdr(self.mesero))
        self.assertEqual(r.status_code, 403)

    def test_mesero_puede_crear_pedido_interno_para_su_sede(self):
        payload = {
            'origen': 'interno', 'sede_solicitante': self.sede.id,
            'lineas': [{'insumo_base': self.insumo.id, 'cantidad_pedida': '5.000'}],
        }
        r = self.client.post('/api/ordenes-compra/', payload, format='json', **_hdr(self.mesero))
        self.assertEqual(r.status_code, 201, r.data)

    def test_mesero_no_puede_crear_pedido_interno_para_otra_sede(self):
        payload = {
            'origen': 'interno', 'sede_solicitante': self.sede2.id,
            'lineas': [{'insumo_base': self.insumo.id, 'cantidad_pedida': '5.000'}],
        }
        r = self.client.post('/api/ordenes-compra/', payload, format='json', **_hdr(self.mesero))
        self.assertEqual(r.status_code, 403)

    # ── Flujo feliz completo ─────────────────────────────────────
    def test_flujo_completo_actualiza_stock_solo_al_recibir(self):
        r = self._crear_orden(origen='proveedor', proveedor=self.proveedor.id, sede_destino=self.sede.id)
        orden_id = r.data['id']
        detalle_id = r.data['lineas'][0]['id']

        for accion in ('solicitar', 'confirmar', 'marcar_en_camino'):
            r = self.client.post(f'/api/ordenes-compra/{orden_id}/{accion}/', {}, format='json')
            self.assertEqual(r.status_code, 200, r.data)

        self.assertFalse(InsumoSede.objects.filter(insumo_base=self.insumo, sede=self.sede).exists())

        r = self.client.post(
            f'/api/ordenes-compra/{orden_id}/recibir/',
            {'lineas': [{'detalle_id': detalle_id, 'cantidad_recibida': '10.000'}]},
            format='json',
        )
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data['estado'], 'recibido')

        insumo_sede = InsumoSede.objects.get(insumo_base=self.insumo, sede=self.sede)
        self.assertEqual(insumo_sede.stock_actual, Decimal('10.000'))

    def test_recepcion_parcial_y_completar_despues(self):
        r = self._crear_orden(origen='proveedor', proveedor=self.proveedor.id, sede_destino=self.sede.id)
        orden_id = r.data['id']
        detalle_id = r.data['lineas'][0]['id']
        self.client.post(f'/api/ordenes-compra/{orden_id}/solicitar/', {}, format='json')

        r = self.client.post(
            f'/api/ordenes-compra/{orden_id}/recibir/',
            {'lineas': [{'detalle_id': detalle_id, 'cantidad_recibida': '4.000'}]},
            format='json',
        )
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data['estado'], 'recibido_parcial')
        insumo_sede = InsumoSede.objects.get(insumo_base=self.insumo, sede=self.sede)
        self.assertEqual(insumo_sede.stock_actual, Decimal('4.000'))

        r = self.client.post(
            f'/api/ordenes-compra/{orden_id}/recibir/',
            {'lineas': [{'detalle_id': detalle_id, 'cantidad_recibida': '6.000'}]},
            format='json',
        )
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data['estado'], 'recibido')
        insumo_sede.refresh_from_db()
        self.assertEqual(insumo_sede.stock_actual, Decimal('10.000'))

    def test_recibir_sin_sede_destino_va_a_matriz(self):
        r = self._crear_orden(origen='proveedor', proveedor=self.proveedor.id)
        orden_id = r.data['id']
        detalle_id = r.data['lineas'][0]['id']
        self.client.post(f'/api/ordenes-compra/{orden_id}/solicitar/', {}, format='json')
        r = self.client.post(
            f'/api/ordenes-compra/{orden_id}/recibir/',
            {'lineas': [{'detalle_id': detalle_id, 'cantidad_recibida': '10.000'}]},
            format='json',
        )
        self.assertEqual(r.status_code, 200, r.data)
        self.insumo.refresh_from_db()
        self.assertEqual(self.insumo.stock_general, Decimal('10.000'))

    # ── Transiciones inválidas ─────────────────────────────────
    def test_no_se_puede_confirmar_un_borrador(self):
        r = self._crear_orden(origen='proveedor', proveedor=self.proveedor.id)
        orden_id = r.data['id']
        r = self.client.post(f'/api/ordenes-compra/{orden_id}/confirmar/', {}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_no_se_puede_recibir_un_cancelado(self):
        r = self._crear_orden(origen='proveedor', proveedor=self.proveedor.id)
        orden_id = r.data['id']
        detalle_id = r.data['lineas'][0]['id']
        self.client.post(f'/api/ordenes-compra/{orden_id}/solicitar/', {}, format='json')
        self.client.post(f'/api/ordenes-compra/{orden_id}/cancelar/', {}, format='json')
        r = self.client.post(
            f'/api/ordenes-compra/{orden_id}/recibir/',
            {'lineas': [{'detalle_id': detalle_id, 'cantidad_recibida': '10.000'}]},
            format='json',
        )
        self.assertEqual(r.status_code, 400)

    # ── Permisos ─────────────────────────────────────────────────
    def test_mesero_no_puede_confirmar(self):
        r = self._crear_orden(origen='proveedor', proveedor=self.proveedor.id)
        orden_id = r.data['id']
        self.client.post(f'/api/ordenes-compra/{orden_id}/solicitar/', {}, format='json')
        r = self.client.post(f'/api/ordenes-compra/{orden_id}/confirmar/', {}, format='json', **_hdr(self.mesero))
        self.assertEqual(r.status_code, 403)

    def test_encargado_si_puede_confirmar(self):
        r = self._crear_orden(origen='proveedor', proveedor=self.proveedor.id)
        orden_id = r.data['id']
        self.client.post(f'/api/ordenes-compra/{orden_id}/solicitar/', {}, format='json')
        r = self.client.post(f'/api/ordenes-compra/{orden_id}/confirmar/', {}, format='json', **_hdr(self.encargado))
        self.assertEqual(r.status_code, 200, r.data)

    # ── Aviso por WhatsApp (solo con confirmación explícita) ─────
    @patch('negocios.views.compras_views.enviar_mensaje_whatsapp')
    def test_avisar_proveedor_envia_solo_si_se_confirma(self, mock_enviar):
        mock_enviar.return_value = True
        r = self._crear_orden(origen='proveedor', proveedor=self.proveedor.id, sede_destino=self.sede.id)
        orden_id = r.data['id']

        mock_enviar.assert_not_called()  # crear la orden NO dispara nada

        r = self.client.post(f'/api/ordenes-compra/{orden_id}/avisar_proveedor/', {}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        mock_enviar.assert_called_once()
        args, _ = mock_enviar.call_args
        self.assertEqual(args[1], self.proveedor.telefono)

        orden = OrdenCompra.objects.get(id=orden_id)
        self.assertTrue(orden.whatsapp_enviado)

    def test_avisar_proveedor_falla_sin_telefono(self):
        proveedor_sin_tel = Proveedor.objects.create(negocio=self.negocio, nombre='Sin Tel')
        r = self._crear_orden(origen='proveedor', proveedor=proveedor_sin_tel.id, sede_destino=self.sede.id)
        orden_id = r.data['id']
        r = self.client.post(f'/api/ordenes-compra/{orden_id}/avisar_proveedor/', {}, format='json')
        self.assertEqual(r.status_code, 400)

    # ── Alertas de bajo stock (para armar un pedido sugerido) ─────
    def test_alertas_bajo_stock(self):
        InsumoSede.objects.create(insumo_base=self.insumo, sede=self.sede, stock_actual=2, stock_minimo=10)
        otro_insumo = InsumoBase.objects.create(negocio=self.negocio, nombre='Aceite', unidad_medida='l')
        InsumoSede.objects.create(insumo_base=otro_insumo, sede=self.sede, stock_actual=50, stock_minimo=5)

        r = self.client.get('/api/insumo-sede/alertas_bajo_stock/')
        self.assertEqual(r.status_code, 200)
        nombres = [x['nombre_insumo'] for x in r.data]
        self.assertIn('Harina', nombres)
        self.assertNotIn('Aceite', nombres)
