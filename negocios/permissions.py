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


class SoloLecturaSalvoSuperUsuario(BasePermission):
    """
    Para catálogos GLOBALES compartidos por todos los negocios (ej. Rol).
    Cualquier autenticado puede leerlos (los necesitan para armar formularios,
    ej. elegir un rol al crear un empleado), pero solo el superusuario de la
    plataforma puede crearlos/editarlos/borrarlos — un dueño no debe poder
    tocar la configuración compartida de TODOS los demás negocios.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return bool(request.user.is_superuser)