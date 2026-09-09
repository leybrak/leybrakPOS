"""
Recordatorio automático a clientes que cotizaron un pedido por el bot
(cotizar_bot) y desaparecieron sin pagar. cotizar_bot marca
Cliente.bot_ultima_actividad; carritos_pendientes_bot lo detecta 30-60 min
después; marcar_carrito_bot evita que se repita.
"""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from negocios.models import Negocio, Sede, Cliente, Orden


@override_settings(BOT_API_TOKEN='test-bot-token-123')
class CarritosAbandonadosTest(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user(username='dueno', password='x')
        self.negocio = Negocio.objects.create(
            propietario=self.user, nombre='Negocio',
            fin_prueba=timezone.now() + timedelta(days=30))
        self.sede = Sede.objects.create(
            negocio=self.negocio, nombre='Sede', whatsapp_instancia='brava_1_sede_1')

    def _cliente(self, telefono='987654321', minutos_atras=45, **extra):
        campos = dict(
            negocio=self.negocio, telefono=telefono, nombre='Juan',
            bot_ultima_actividad=timezone.now() - timedelta(minutes=minutos_atras),
            bot_ultima_sede=self.sede, bot_recordatorio_enviado=False,
        )
        campos.update(extra)
        return Cliente.objects.create(**campos)

    def _get(self, token='test-bot-token-123'):
        headers = {'HTTP_X_BOT_TOKEN': token} if token is not None else {}
        return self.client.get('/api/bot/carritos-pendientes/', **headers)

    def test_actividad_hace_45_min_aparece(self):
        cliente = self._cliente(minutos_atras=45)
        r = self._get()
        self.assertEqual(r.status_code, 200)
        ids = [p['cliente_id'] for p in r.data['pendientes']]
        self.assertIn(cliente.id, ids)

    def test_actividad_muy_reciente_no_aparece(self):
        cliente = self._cliente(minutos_atras=10)
        r = self._get()
        ids = [p['cliente_id'] for p in r.data['pendientes']]
        self.assertNotIn(cliente.id, ids)

    def test_actividad_muy_vieja_no_aparece(self):
        cliente = self._cliente(minutos_atras=180)
        r = self._get()
        ids = [p['cliente_id'] for p in r.data['pendientes']]
        self.assertNotIn(cliente.id, ids)

    def test_ya_tiene_orden_creada_no_aparece(self):
        cliente = self._cliente(minutos_atras=45)
        Orden.objects.create(
            sede=self.sede, tipo='delivery', estado_pago='pagado',
            total=Decimal('30'), cliente_telefono=cliente.telefono)
        r = self._get()
        ids = [p['cliente_id'] for p in r.data['pendientes']]
        self.assertNotIn(cliente.id, ids)

    def test_ya_se_le_mando_recordatorio_no_aparece(self):
        cliente = self._cliente(minutos_atras=45, bot_recordatorio_enviado=True)
        r = self._get()
        ids = [p['cliente_id'] for p in r.data['pendientes']]
        self.assertNotIn(cliente.id, ids)

    def test_token_invalido_responde_403(self):
        self._cliente(minutos_atras=45)
        r = self._get(token='token-incorrecto')
        self.assertEqual(r.status_code, 403)

    def test_marcar_evita_que_se_repita(self):
        cliente = self._cliente(minutos_atras=45)
        r1 = self._get()
        self.assertIn(cliente.id, [p['cliente_id'] for p in r1.data['pendientes']])

        r_marcar = self.client.post(
            '/api/bot/carritos-marcar/', {'cliente_id': cliente.id},
            format='json', HTTP_X_BOT_TOKEN='test-bot-token-123',
        )
        self.assertEqual(r_marcar.status_code, 200)

        r2 = self._get()
        self.assertNotIn(cliente.id, [p['cliente_id'] for p in r2.data['pendientes']])

    def test_cotizar_bot_marca_actividad(self):
        from negocios.models import Producto
        producto = Producto.objects.create(
            negocio=self.negocio, nombre='Pollo a la brasa', precio_base=Decimal('25'),
            disponible=True, activo=True)
        cliente = Cliente.objects.create(negocio=self.negocio, telefono='987654321', nombre='Juan')

        r = self.client.post('/api/ordenes/cotizar_bot/', {
            'sede': self.sede.id, 'tipo': 'salon', 'metodo_pago_esperado': 'efectivo',
            'telefono': cliente.telefono,
            'detalles': [{'producto': producto.id, 'cantidad': 1}],
        }, format='json', HTTP_X_BOT_TOKEN=self.sede.bot_token)
        self.assertEqual(r.status_code, 200, r.data)

        cliente.refresh_from_db()
        self.assertIsNotNone(cliente.bot_ultima_actividad)
        self.assertEqual(cliente.bot_ultima_sede_id, self.sede.id)
        self.assertFalse(cliente.bot_recordatorio_enviado)
