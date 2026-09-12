# negocios/middleware.py
import logging
from urllib.parse import parse_qs
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from django.conf import settings
from http.cookies import SimpleCookie

logger = logging.getLogger(__name__)

@database_sync_to_async
def get_user_from_token(token_str):
    from django.contrib.auth.models import AnonymousUser
    from django.contrib.auth import get_user_model
    from rest_framework_simplejwt.tokens import AccessToken
    from rest_framework_simplejwt.exceptions import TokenError, InvalidToken

    User = get_user_model()
    try:
        token = AccessToken(token_str)
        user_id = token['user_id']
        user = User.objects.get(id=user_id)
        logger.debug('WS: usuario %s autenticado.', user.username)
        return user
    except Exception as e:
        logger.warning('WS: token inválido o expirado (%s).', e)
        return AnonymousUser()

class JWTWebSocketMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        from django.contrib.auth.models import AnonymousUser
        try:
            headers = dict(scope.get('headers', []))
            raw_token = None

            # 1️⃣ Intentar desde cookie HttpOnly (producción)
            if b'cookie' in headers:
                cookies_str = headers[b'cookie'].decode('utf-8')
                parsed_cookies = SimpleCookie(cookies_str)
                cookie_name = settings.SIMPLE_JWT.get('AUTH_COOKIE', 'access_token')
                if cookie_name in parsed_cookies:
                    raw_token = parsed_cookies[cookie_name].value
                    logger.debug('WS: token encontrado en cookie.')

            # 2️⃣ Fallback: query string ?token=... (desarrollo con orígenes distintos)
            if not raw_token:
                query_string = scope.get('query_string', b'').decode('utf-8')
                params = parse_qs(query_string)
                token_list = params.get('token', [])
                if token_list:
                    raw_token = token_list[0]
                    logger.debug('WS: token encontrado en query string.')
                else:
                    logger.warning('WS: no se encontró token en cookie ni query string.')

            scope['user'] = await get_user_from_token(raw_token) if raw_token else AnonymousUser()
            return await super().__call__(scope, receive, send)

        except Exception:
            logger.error('Error crítico en middleware WS.', exc_info=True)
            scope['user'] = AnonymousUser()
            return await super().__call__(scope, receive, send)