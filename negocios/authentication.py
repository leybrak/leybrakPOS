# negocios/authentication.py
import os

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework.authentication import BaseAuthentication
from django.conf import settings


def _jtis_revocados():
    """
    jti de access tokens que hay que rechazar aunque su firma/expiración
    sigan siendo válidas — para JWTs de vida artificialmente larga que se
    filtraron (p.ej. minteados a mano para n8n) y que el blacklist normal de
    SimpleJWT no cubre (ese blacklist solo trackea refresh tokens, no access
    tokens usados directo como Bearer). Configurable por env
    (JWT_JTI_REVOCADOS, separados por coma) por si hay que sumar otro más
    adelante; trae de fábrica el que se encontró filtrado en un export de
    n8n (access token de ~10 años, atado a un solo negocio, reemplazado por
    BotTokenAuthentication).
    """
    default = '80f927245b0f48e2a947f12faa0fe51c'
    crudo = os.environ.get('JWT_JTI_REVOCADOS', default)
    return {j.strip() for j in crudo.split(',') if j.strip()}


JTIS_REVOCADOS = _jtis_revocados()


class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        header = self.get_header(request)

        if header is None:
            # 🛡️ Si no hay header, intentamos sacar el token de la cookie segura
            raw_token = request.COOKIES.get(settings.SIMPLE_JWT['AUTH_COOKIE'])
        else:
            raw_token = self.get_raw_token(header)

        if raw_token is None:
            return None

        validated_token = self.get_validated_token(raw_token)
        if str(validated_token.get('jti')) in JTIS_REVOCADOS:
            raise InvalidToken('Este token fue revocado.')

        return self.get_user(validated_token), validated_token


def bot_token_valido(request):
    """
    Valida el token compartido del bot/cron de n8n (header X-Bot-Token).
    Usado tanto por BotTokenAuthentication como por las vistas AllowAny que
    ya seguían esta convención (historias programadas, info_bot, tickets).
    """
    esperado = getattr(settings, 'BOT_API_TOKEN', '') or getattr(settings, 'EVO_GLOBAL_KEY', '')
    if not esperado:
        return False    # sin token configurado no se expone nada
    recibido = request.headers.get('X-Bot-Token', '') or request.query_params.get('token', '')
    return recibido == esperado


class BotUsuario:
    """
    Identidad liviana (no un User de Django) para requests del bot de WhatsApp
    autenticadas con X-Bot-Token + sede_id. Expone lo mínimo que el código de
    vistas ya espera de request.user (negocio, is_authenticated, is_superuser)
    para que la lógica de negocio/IDOR existente (filtrada por
    request.user.negocio) funcione sin cambios.
    """
    is_authenticated = True
    is_superuser = False
    is_staff = False
    id = None
    pk = None

    def __init__(self, negocio):
        self.negocio = negocio

    def __str__(self):
        return f'BotUsuario(negocio={self.negocio_id})'

    @property
    def negocio_id(self):
        return self.negocio.id


class BotTokenAuthentication(BaseAuthentication):
    """
    Autenticación del bot de WhatsApp (n8n): header X-Bot-Token + un sede_id
    explícito en la request (query param o body: sede_id, o "sede" para
    compatibilidad con Crear_Orden).

    ⚠️ El token NO es un secreto global compartido por todos los negocios —
    es Sede.bot_token, propio de CADA sede (ver Sede.save()). Si validáramos
    contra un solo secreto global, cualquiera que lo tuviera podría pasar el
    sede_id de OTRO negocio y quedar autenticado como su dueño (se detectó
    este error exacto en test_bot_token_auth.py durante el desarrollo). Con
    el token por-sede, tener el de la Sede A nunca sirve para actuar como la
    Sede B — la misma propiedad que daba el JWT-por-negocio anterior, pero
    sin necesitar un JWT ni un User de Django por negocio.

    n8n obtiene el bot_token de la sede una vez por conversación (lo devuelve
    info_bot, ver negocio_views.py) y lo reenvía en cada llamada posterior.

    Reemplaza al JWT de un solo usuario que antes minteábamos a mano para que
    n8n llamara al backend — con eso el bot solo podía servir a UN negocio.
    Las validaciones anti-IDOR ya existentes en las vistas (comparar contra
    request.user.negocio) siguen aplicando igual.

    No interfiere con CookieJWTAuthentication: el POS/ERP nunca manda
    X-Bot-Token, así que para esas requests esta clase simplemente no aplica.

    Importante: esta clase corre para TODA request que traiga X-Bot-Token,
    incluidas las vistas AllowAny que ya validan ese header ellas mismas con
    su propio criterio (info_bot, historias-pendientes, el webhook de
    tickets — que no mandan sede_id ni lo necesitan). Por eso nunca lanza
    AuthenticationFailed: si no puede resolver una sede, simplemente no se
    aplica (devuelve None) y deja que la vista decida. Las vistas que sí
    exigen IsAuthenticated (los tools del bot) igual terminan rechazando la
    request con 401 al no quedar autenticada por ninguna clase.
    """

    def authenticate(self, request):
        token = request.headers.get('X-Bot-Token')
        if not token:
            return None  # deja que otra clase de auth (o AnonymousUser) resuelva

        sede_id = (
            request.query_params.get('sede_id')
            or request.data.get('sede_id')
            or request.data.get('sede')
        )
        if not sede_id:
            return None

        from .models import Sede
        sede = (
            Sede.objects.select_related('negocio')
            .filter(id=sede_id, bot_token=token)
            .exclude(bot_token='')
            .first()
        )
        if sede is None:
            return None

        return BotUsuario(sede.negocio), None