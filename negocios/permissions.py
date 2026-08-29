# negocios/permissions.py
from rest_framework.permissions import BasePermission, SAFE_METHODS


class EsDuenioOsoloLectura(BasePermission):

    def has_permission(self, request, view):
        # Debe estar autenticado para cualquier operación
        if not request.user or not request.user.is_authenticated:
            return False

        # Superusuario del sistema: acceso total
        if request.user.is_superuser:
            return True

        # Lectura: cualquier usuario autenticado puede leer
        if request.method in SAFE_METHODS:
            return True

        # Escritura: solo usuarios con negocio asociado (Dueños/Admins del sistema)
        return hasattr(request.user, 'negocio')


class EsSuperUsuario(BasePermission):
    """Solo el operador de la plataforma (Leybrak) — panel de staff."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)