# negocios/consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

# ✅ NO importamos nada de Django aquí arriba — causa AppRegistryNotReady
# Todos los imports de Django van dentro de las funciones


# ============================================================
# HELPERS
# ============================================================

def _usuario_valido(scope):
    """Retorna True si el scope tiene un usuario autenticado."""
    from django.contrib.auth.models import AnonymousUser
    user = scope.get('user')
    return user is not None and not isinstance(user, AnonymousUser) and user.is_authenticated


@database_sync_to_async
def _tiene_acceso_sede(user, sede_id):
    """
    Verifica que el usuario tiene acceso a la sede solicitada.
    """
    # 1. Si eres el SuperAdmin (IT), pasas directo
    if user.is_superuser:
        return True
        
    # 2. Si eres un Dueño, buscamos tu negocio en la base de datos
    from .models import Negocio, Sede
    negocio_del_usuario = Negocio.objects.filter(propietario=user).first()
    
    if negocio_del_usuario:
        # Validamos que la sede a la que intentas entrar le pertenezca a tu negocio
        return Sede.objects.filter(id=sede_id, negocio=negocio_del_usuario).exists()
        
    return False


# ============================================================
# COCINA CONSUMER
# ============================================================

class CocinaConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        if not _usuario_valido(self.scope):
            await self.close(code=4001)
            return

        self.sede_id = self.scope['url_route']['kwargs']['sede_id']

        if not await _tiene_acceso_sede(self.scope['user'], self.sede_id):
            await self.close(code=4003)
            return

        self.room_group_name = f"cocina_sede_{self.sede_id}"
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def orden_nueva(self, event):
        await self.send(text_data=json.dumps({
            'type': 'nueva_orden',
            'orden': event['orden']
        }))
    
    async def solicitud_cambio_nueva(self, event):
        await self.send(text_data=json.dumps(event))


# ============================================================
# SALON CONSUMER
# ============================================================

ESTADOS_MESA_VALIDOS = {"libre", "ocupada", "cobrando", "pidiendo"}


class SalonConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        if not _usuario_valido(self.scope):
            await self.close(code=4001)
            return

        self.sede_id = self.scope['url_route']['kwargs']['sede_id']

        if not await _tiene_acceso_sede(self.scope['user'], self.sede_id):
            await self.close(code=4003)
            return

        self.room_group_name = f"salon_sede_{self.sede_id}"
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)

            if data.get('type') == 'mesa_estado':
                mesa_id = data.get('mesa_id')
                estado  = data.get('estado')

                # Validar estado permitido
                if estado not in ESTADOS_MESA_VALIDOS:
                    await self.send(text_data=json.dumps({
                        'type': 'error',
                        'mensaje': 'Estado de mesa inválido.'
                    }))
                    return

                # ✨ NUEVO: Solo validamos que la mesa es tuya, sin intentar guardar en la BD
                mesa_valida = await self._validar_mesa(mesa_id)

                if mesa_valida:
                    # Retransmitimos el estado al resto de tablets del salón
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'mesa_actualizada',
                            'mesa_id': mesa_id,
                            'estado': estado,
                            'total': data.get('total', 0),
                        }
                    )
                else:
                    await self.send(text_data=json.dumps({
                        'type': 'error',
                        'mensaje': 'Mesa no encontrada o no pertenece a esta sede.'
                    }))

        except json.JSONDecodeError:
            pass

    async def pedido_listo(self, event):
        await self.send(text_data=json.dumps({
            'type': 'pedido_listo',
            'mesa': event['mesa'],
            'producto': event['producto']
        }))

    async def mesa_actualizada(self, event):
        await self.send(text_data=json.dumps({
            'type': 'mesa_actualizada',
            'mesa_id': event['mesa_id'],
            'estado': event['estado'],
            'total': event['total'],
        }))

    async def orden_llevar_actualizada(self, event):
        await self.send(text_data=json.dumps({
            'type': 'orden_llevar_actualizada',
            'orden': event['orden'],
            'accion': event['accion'],
        }))

    async def menu_actualizado(self, event):
        # La carta (Producto) cambió — le avisamos a las tablets/celulares
        # conectados para que invaliden su cache local y la vuelvan a
        # descargar (ver negocios/signals.py: avisar_menu_actualizado_*).
        await self.send(text_data=json.dumps({'type': 'menu_actualizado'}))

    async def solicitud_cambio_nueva(self, event):
        await self.send(text_data=json.dumps(event))
    @database_sync_to_async
    def _validar_mesa(self, mesa_id):
        """
        Solo verifica que la mesa exista en esta sede.
        No guardamos el estado en la BD porque es un estado visual temporal de las tablets.
        """
        # ✨ IMPORTAMOS EL MODELO AQUÍ ADENTRO
        from .models import Mesa
        
        return Mesa.objects.filter(id=mesa_id, sede_id=self.sede_id).exists()
    
# ============================================================
# PAGOS CONSUMER (Yape / Plin en tiempo real)
# ============================================================

@database_sync_to_async
def _tiene_acceso_negocio(user, negocio_id):
    """
    Verifica que el usuario tiene acceso al negocio solicitado.
    Reutiliza la misma lógica de seguridad que los otros consumers.
    """
    if user.is_superuser:
        return True

    from .models import Negocio
    return Negocio.objects.filter(propietario=user, id=negocio_id).exists()


class PagosConsumer(AsyncWebsocketConsumer):
    """
    Consumer que escucha el canal de pagos de un negocio específico.
    El frontend (React POS) se conecta aquí cuando el cajero hace clic en "Cobrar con Yape/Plin".
    El backend le envía los eventos de notificación push capturados por la app Android.
    """

    async def connect(self):
        if not _usuario_valido(self.scope):
            await self.close(code=4001)
            return

        self.negocio_id = self.scope['url_route']['kwargs']['negocio_id']

        if not await _tiene_acceso_negocio(self.scope['user'], self.negocio_id):
            await self.close(code=4003)
            return

        self.room_group_name = f"pagos_negocio_{self.negocio_id}"
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    # ----------------------------------------------------------
    # Evento disparado por el endpoint REST cuando llega un pago
    # Nombre del método = type del group_send (con punto → guión bajo)
    # ----------------------------------------------------------
    async def pago_recibido(self, event):
        """
        Retransmite la notificación de pago a todas las cajas conectadas de este negocio.
        El frontend decide qué hacer según el tipo (YAPE con código vs PLIN sin código).
        """
        await self.send(text_data=json.dumps({
            'type':              'pago_recibido',
            'notificacion_id':   event['notificacion_id'],
            'tipo':              event['tipo'],          # 'YAPE' o 'PLIN'
            'monto':             event['monto'],
            'codigo_seguridad':  event['codigo_seguridad'],  # None si es PLIN
            'nombre_cliente':    event['nombre_cliente'],
        }))

    async def notificacion_confirmada(self, event):
        """
        Otra caja del mismo negocio ya confirmó esta notificación — se la
        retransmitimos a todas para que la saquen de su lista de pagos
        pendientes (evita que alguien más intente confirmarla de nuevo).
        """
        await self.send(text_data=json.dumps({
            'type':            'notificacion_confirmada',
            'notificacion_id': event['notificacion_id'],
        }))