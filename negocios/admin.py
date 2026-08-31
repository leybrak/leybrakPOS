from datetime import timedelta

from django import forms
from django.contrib import admin
from django.utils import timezone
from django.utils.crypto import get_random_string
# ✨ IMPORTAMOS LAS HERRAMIENTAS DE UNFOLD ✨
from unfold.admin import ModelAdmin, TabularInline, StackedInline

from .models import (
    InsumoSede, InsumoBase, Negocio, RecetaDetalle, Rol, MovimientoCaja, 
    Empleado, Mesa, Sede, Producto, Orden, DetalleOrden, Pago, 
    ModificadorRapido, GrupoVariacion, OpcionVariacion, PlanSaaS,
    # ✨ IMPORTAMOS TUS NUEVOS MODELOS DE CRM Y MARKETING ✨
    Cliente, ZonaDelivery, ReglaNegocio, CuponPromocional,
    HorarioVisibilidad, ComponenteCombo, VersionApp, Comprobante, SerieComprobante,
    HistoriaProgramada, FeedbackCliente, CanjePuntos, BotSticker, ModuloGlobal,
    TicketSoporte, DatosPagoPlataforma
)
from .services import precargar_modulos_por_plan
from django.contrib import admin
from unfold.admin import ModelAdmin, TabularInline, StackedInline

# ✨ 1. IMPORTAMOS LOS MODELOS NATIVOS DE DJANGO
from django.contrib.auth.models import User, Group
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.admin import GroupAdmin as BaseGroupAdmin

# ✨ 2. LOS DESVINCULAMOS DEL DISEÑO VIEJO
admin.site.unregister(User)
admin.site.unregister(Group)

# ✨ 3. LOS REGISTRAMOS CON UNFOLD
@admin.register(User)
class UserAdmin(BaseUserAdmin, ModelAdmin):
    pass

@admin.register(Group)
class GroupAdmin(BaseGroupAdmin, ModelAdmin):
    pass
# A los registros simples les pasamos ModelAdmin para que agarren el diseño
admin.site.register(Rol, ModelAdmin)
admin.site.register(Mesa, ModelAdmin)
admin.site.register(Orden, ModelAdmin)
admin.site.register(DetalleOrden, ModelAdmin)
admin.site.register(Pago, ModelAdmin) 
admin.site.register(InsumoBase, ModelAdmin)
admin.site.register(InsumoSede, ModelAdmin)
admin.site.register(RecetaDetalle, ModelAdmin)
admin.site.register(ModificadorRapido, ModelAdmin)

# ==========================================
# 1. VARIACIONES DE PRODUCTO
# ==========================================
class OpcionVariacionInline(TabularInline): # ✨ UNFOLD
    model = OpcionVariacion
    extra = 1  

@admin.register(GrupoVariacion)
class GrupoVariacionAdmin(ModelAdmin): # ✨ UNFOLD
    list_display = ['nombre', 'producto', 'obligatorio']
    list_filter = ['producto']
    inlines = [OpcionVariacionInline] 

# ==========================================
# 2. GESTIÓN DE EMPLEADOS Y CAJA
# ==========================================
@admin.register(Empleado)
class EmpleadoAdmin(ModelAdmin): # ✨ UNFOLD
    list_display = ('nombre', 'rol', 'negocio', 'sede', 'pin', 'activo', 'ultimo_ingreso')
    search_fields = ('nombre', 'pin')
    list_filter = ('negocio', 'sede', 'rol', 'activo')

@admin.register(MovimientoCaja)
class MovimientoCajaAdmin(ModelAdmin): # ✨ UNFOLD
    list_display = ('id', 'sede', 'sesion_caja', 'get_tipo_display', 'monto', 'concepto', 'empleado', 'fecha')
    list_filter = ('tipo', 'fecha', 'sede', 'empleado')
    search_fields = ('concepto', 'empleado__nombre')
    readonly_fields = ('fecha',)
    ordering = ('-fecha',)

# ==========================================
# 🚀 3. CONFIGURACIÓN DEL SAAS MULTI-TENANT
# ==========================================
@admin.register(PlanSaaS)
class PlanSaaSAdmin(ModelAdmin): # ✨ UNFOLD
    list_display = ('nombre', 'precio_mensual', 'max_sedes', 'modulo_kds', 'modulo_inventario', 'modulo_delivery')
    list_editable = ('modulo_kds', 'modulo_inventario', 'modulo_delivery')


@admin.register(ModuloGlobal)
class ModuloGlobalAdmin(ModelAdmin): # ✨ UNFOLD
    """
    Interruptor único de Leybrak: apaga acá un módulo que todavía tiene
    cosas pendientes y desaparece para TODOS los negocios (sin tocar el
    flag de cada uno). Es un singleton, por eso no se permite crear otra
    fila ni borrar la única que existe.
    """
    list_display = (
        'actualizado_en',
        'salon_activo', 'cocina_activo', 'inventario_activo', 'delivery_activo',
        'clientes_activo', 'facturacion_activo', 'carta_qr_activo', 'bot_wsp_activo',
        'ml_activo',
    )
    list_display_links = ('actualizado_en',)
    list_editable = (
        'salon_activo', 'cocina_activo', 'inventario_activo', 'delivery_activo',
        'clientes_activo', 'facturacion_activo', 'carta_qr_activo', 'bot_wsp_activo',
        'ml_activo',
    )

    def has_add_permission(self, request):
        return not ModuloGlobal.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False

    def changelist_view(self, request, extra_context=None):
        ModuloGlobal.actual()  # crea la fila si todavía no existe
        return super().changelist_view(request, extra_context)


@admin.register(DatosPagoPlataforma)
class DatosPagoPlataformaAdmin(ModelAdmin): # ✨ UNFOLD
    """
    A qué Yape/Plin/cuenta le pagan los negocios su mensualidad a Leybrak.
    Singleton — respaldo del mismo formulario que ya vive en el panel de staff.
    """
    fieldsets = (
        ('Yape', {'fields': ('yape_numero', 'yape_titular')}),
        ('Plin', {'fields': ('plin_numero', 'plin_titular')}),
        ('Transferencia bancaria', {'fields': ('banco', 'numero_cuenta', 'cci', 'titular_cuenta')}),
    )

    def has_add_permission(self, request):
        return not DatosPagoPlataforma.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False

    def changelist_view(self, request, extra_context=None):
        DatosPagoPlataforma.actual()
        return super().changelist_view(request, extra_context)


class SedeInline(TabularInline): # ✨ UNFOLD
    model = Sede
    extra = 1
    fields = ('nombre', 'direccion', 'activo')


class NegocioAdminForm(forms.ModelForm):
    """
    Permite crear el Negocio y su propietario (User) en un solo paso,
    en vez de tener que crear el Usuario aparte antes de poder elegirlo.
    """
    propietario_username = forms.CharField(
        max_length=150, required=False, label='Usuario (login) del propietario',
        help_text='Solo para crear un propietario nuevo. Si ya existe, elígelo arriba en "Propietario".'
    )
    propietario_email = forms.EmailField(required=False, label='Email del propietario')
    propietario_password = forms.CharField(
        required=False, widget=forms.PasswordInput, label='Contraseña del propietario',
    )

    class Meta:
        model = Negocio
        fields = '__all__'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['propietario'].required = False
        self.fields['fin_prueba'].required = False
        self.fields['fin_prueba'].help_text = 'Vacío = 30 días de prueba desde hoy.'

    def clean(self):
        cleaned = super().clean()
        propietario = cleaned.get('propietario')
        username = cleaned.get('propietario_username')
        if not propietario and not username:
            raise forms.ValidationError(
                'Elige un Propietario existente o completa "Usuario (login) del propietario" para crear uno nuevo.'
            )
        if username and not propietario and User.objects.filter(username=username).exists():
            raise forms.ValidationError(
                f'Ya existe un usuario "{username}". Selecciónalo en el campo Propietario en vez de recrearlo.'
            )
        return cleaned


@admin.register(Negocio)
class NegocioAdmin(ModelAdmin): # ✨ UNFOLD
    form = NegocioAdminForm
    inlines = [SedeInline]
    list_display = ('nombre', 'propietario', 'telefono_propietario', 'plan', 'activo')
    list_filter = ('plan', 'activo')
    search_fields = ('nombre', 'propietario__username')

    fieldsets = (
        ('Propietario', {
            'fields': ('propietario', 'propietario_username', 'propietario_email', 'propietario_password'),
            'description': 'Elige un usuario existente, o completa usuario/email/contraseña para crear uno nuevo automáticamente al guardar.',
        }),
        ('Datos del negocio', {
            'fields': ('nombre', 'ruc', 'razon_social', 'logo', 'telefono_propietario', 'plan', 'fin_prueba', 'activo'),
        }),
        ('Billeteras digitales', {
            'fields': ('yape_numero', 'yape_qr', 'plin_numero', 'plin_qr'),
            'classes': ('collapse',),
        }),
        ('Módulos habilitados', {
            'fields': (
                'mod_salon_activo', 'mod_cocina_activo', 'mod_inventario_activo',
                'mod_delivery_activo', 'mod_clientes_activo', 'mod_facturacion_activo',
                'mod_carta_qr_activo', 'mod_bot_wsp_activo', 'mod_ml_activo',
            ),
            'classes': ('collapse',),
        }),
    )

    def save_model(self, request, obj, form, change):
        if not obj.propietario_id:
            username = form.cleaned_data['propietario_username']
            email = form.cleaned_data.get('propietario_email', '')
            password = form.cleaned_data.get('propietario_password') or get_random_string(16)
            obj.propietario = User.objects.create_user(username=username, email=email, password=password)
        if not obj.fin_prueba:
            obj.fin_prueba = timezone.now() + timedelta(days=30)

        # Precarga los módulos que incluye el plan (al crear, o al cambiar de plan).
        # Solo prende módulos (OR): si ya habías activado uno a mano que el plan
        # no trae, se queda activado igual. Misma lógica que usa el panel de
        # staff al crear un negocio (negocios/services.py).
        if obj.plan_id and (not change or 'plan' in form.changed_data):
            precargar_modulos_por_plan(obj)

        super().save_model(request, obj, form, change)

# ==========================================
# 📊 4. CRM Y MARKETING (¡LO NUEVO!)
# ==========================================
@admin.register(Cliente)
class ClienteAdmin(ModelAdmin): # ✨ UNFOLD
    list_display = ('nombre', 'telefono', 'negocio', 'puntos_acumulados', 'total_gastado', 'cantidad_pedidos')
    search_fields = ('nombre', 'telefono')
    list_filter = ('negocio', 'tags') # Permite filtrar para ver quiénes son "VIP"
    readonly_fields = ('ultima_compra',)

@admin.register(ReglaNegocio)
class ReglaNegocioAdmin(ModelAdmin): # ✨ UNFOLD
    list_display = ('tipo', 'valor', 'es_porcentaje', 'negocio', 'activa')
    list_filter = ('tipo', 'activa', 'negocio')

@admin.register(CuponPromocional)
class CuponPromocionalAdmin(ModelAdmin): # ✨ UNFOLD
    list_display = ('codigo', 'monto_descuento', 'es_porcentaje', 'fecha_expiracion', 'activo')
    list_filter = ('activo', 'negocio')
    search_fields = ('codigo',)

# ==========================================
# 🍔 5. PRODUCTOS AVANZADOS (COMBOS Y HORARIOS)
# ==========================================
class ComponenteComboInline(TabularInline): # ✨ UNFOLD
    model = ComponenteCombo
    fk_name = 'combo' # Especificamos cuál llave foránea usar (porque hay 2 hacia Producto)
    extra = 1

class HorarioVisibilidadInline(StackedInline): # ✨ UNFOLD
    model = HorarioVisibilidad
    extra = 0

@admin.register(Producto)
class ProductoAdmin(ModelAdmin): # ✨ UNFOLD
    list_display = ('nombre', 'precio_base', 'categoria', 'negocio', 'es_combo', 'destacar_como_promocion', 'disponible')
    list_filter = ('negocio', 'categoria', 'es_combo', 'destacar_como_promocion', 'disponible')
    search_fields = ('nombre',)
    # Permitir editar cosas rápidas sin entrar al detalle
    list_editable = ('precio_base', 'disponible', 'es_combo', 'destacar_como_promocion')
    
    # ¡Magia! Mostrar los componentes y horarios dentro del mismo producto
    inlines = [HorarioVisibilidadInline, ComponenteComboInline]

@admin.register(Sede)
class SedeAdmin(ModelAdmin): # ✨ UNFOLD
    # Agregamos los horarios a la vista rápida para que sea fácil revisarlos
    list_display = ('nombre', 'negocio', 'hora_apertura', 'hora_cierre', 'activo')
    list_editable = ('activo',) 
    search_fields = ('nombre', 'negocio__nombre')
    
    # Organizamos los campos en el formulario de edición por bloques visuales
    fieldsets = (
        ('Información Principal', {
            'fields': ('negocio', 'nombre', 'direccion', 'activo', 'columnas_salon')
        }),
        ('Horarios de Atención', {
            'fields': ('hora_apertura', 'hora_cierre', 'dias_atencion'),
            'description': 'Configura los días y horas en que el local y el bot están activos.'
        }),
        ('Geolocalización', {
            'fields': ('latitud', 'longitud'),
            'classes': ('collapse',), # Esto hace que se pueda "ocultar" si no se usa mucho
        }),
        ('WhatsApp Config', {
            'fields': ('whatsapp_instancia', 'whatsapp_numero'),
        }),
        ('Menú y Carta Virtual', {
            'fields': ('enlace_carta_virtual', 'carta_pdf'),
        }),
    )

# ==========================================
# 📱 6. VERSIÓN DE LA APP MÓVIL (Forzar updates)
# ==========================================
@admin.register(VersionApp)
class VersionAppAdmin(ModelAdmin): # ✨ UNFOLD
    list_display = ('plataforma', 'version_code_minima', 'version_name_ultima', 'activa', 'actualizado_en')
    list_editable = ('version_code_minima', 'version_name_ultima', 'activa')


# ==========================================
# 🧾 7. FACTURACIÓN ELECTRÓNICA (SUNAT)
# ==========================================
@admin.register(Comprobante)
class ComprobanteAdmin(ModelAdmin): # ✨ UNFOLD
    list_display = ('tipo', 'serie', 'numero', 'negocio', 'estado_sunat', 'total', 'creado_en')
    list_filter = ('tipo', 'estado_sunat', 'negocio')
    search_fields = ('serie', 'numero', 'receptor_num_doc', 'receptor_denominacion')
    readonly_fields = ('payload_enviado', 'respuesta', 'codigo_hash', 'creado_en')


@admin.register(SerieComprobante)
class SerieComprobanteAdmin(ModelAdmin): # ✨ UNFOLD
    list_display = ('negocio', 'tipo', 'serie', 'ultimo_numero')
    list_filter = ('negocio', 'tipo')


@admin.register(ZonaDelivery)
class ZonaDeliveryAdmin(ModelAdmin): # ✨ UNFOLD
    # Cambiamos distritos por radio_max_km
    list_display = ('nombre', 'sede', 'radio_max_km', 'costo_envio', 'activa')
    list_editable = ('radio_max_km', 'costo_envio', 'activa')
    list_filter = ('sede', 'activa')
    # Eliminamos distritos_cobertura de la búsqueda si ya no lo usas
    search_fields = ('nombre',)

# ==========================================
# 📲 8. HISTORIAS PROGRAMADAS (Bot WhatsApp)
# ==========================================
@admin.register(HistoriaProgramada)
class HistoriaProgramadaAdmin(ModelAdmin):  # ✨ UNFOLD
    list_display = ('sede', 'fecha_programada', 'estado', 'publicada_en', 'creado_en')
    list_filter = ('estado', 'sede')
    search_fields = ('texto',)


# ==========================================
# 💬 9. FEEDBACK DE CLIENTES (Bot WhatsApp)
# ==========================================
@admin.register(FeedbackCliente)
class FeedbackClienteAdmin(ModelAdmin):  # ✨ UNFOLD
    list_display = ('creado_en', 'calificacion', 'telefono', 'cliente', 'orden', 'visto')
    list_filter = ('visto', 'calificacion', 'negocio')
    list_editable = ('visto',)
    search_fields = ('telefono', 'comentario')


# ==========================================
# 🎫 TICKETS DE SOPORTE (respaldo — la UI principal es el panel de staff)
# ==========================================
@admin.register(TicketSoporte)
class TicketSoporteAdmin(ModelAdmin):  # ✨ UNFOLD
    list_display = ('creado_en', 'asunto', 'negocio', 'estado', 'prioridad')
    list_filter = ('estado', 'prioridad', 'negocio')
    list_editable = ('estado',)
    search_fields = ('asunto', 'mensaje', 'negocio__nombre')


# ==========================================
# 🎁 10. CANJES DE PUNTOS (Fidelización)
# ==========================================
@admin.register(CanjePuntos)
class CanjePuntosAdmin(ModelAdmin):  # ✨ UNFOLD
    list_display = ('creado_en', 'cliente', 'puntos', 'valor_soles', 'negocio')
    list_filter = ('negocio',)
    search_fields = ('cliente__nombre', 'cliente__telefono')


# ==========================================
# 🎟️ 11. STICKERS DEL BOT
# ==========================================
@admin.register(BotSticker)
class BotStickerAdmin(ModelAdmin):  # ✨ UNFOLD
    list_display = ('contexto', 'negocio', 'activo', 'creado_en')
    list_filter = ('contexto', 'activo', 'negocio')
    list_editable = ('activo',)
