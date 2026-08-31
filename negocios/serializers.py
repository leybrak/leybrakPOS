from django.utils import timezone

from rest_framework import serializers
from .models import (
    ComboPromocional, ComponenteCombo, InsumoBase, InsumoSede, ItemComboPromocional, Negocio, PagoSuscripcion, PlanSaaS, ReglaNegocio, Sede, Mesa, Producto, Orden, DetalleOrden, Pago,
    ModificadorRapido, GrupoVariacion, OpcionVariacion, Rol, Empleado, SesionCaja,
    DetalleOrdenOpcion , Categoria, RecetaOpcion, Cliente, VariacionProducto, ZonaDelivery, HorarioVisibilidad,
    ModuloGlobal, TicketSoporte, DatosPagoPlataforma
)


class PlanSaaSSerializer(serializers.ModelSerializer):
    class Meta:
        model  = PlanSaaS
        fields = [
            'id', 'nombre', 'precio_mensual', 'max_sedes',
            'modulo_kds', 'modulo_inventario', 'modulo_delivery',
            'modulo_carta_qr', 'modulo_bot_wsp', 'modulo_ml',
        ]

class PagoSuscripcionSerializer(serializers.ModelSerializer):
    # Campo extra legible en el frontend: nombre del plan en lugar de ID
    plan_nombre = serializers.CharField(source='plan.nombre', read_only=True, default=None)
    negocio_nombre = serializers.ReadOnlyField(source='negocio.nombre')

    class Meta:
        model  = PagoSuscripcion
        fields = [
            'id', 'negocio', 'negocio_nombre', 'monto', 'estado', 'metodo_pago',
            'captura_pago', 'periodo', 'fecha_pago', 'notas',
            'referencia_externa', 'preference_id', 'plan_nombre', 'creado_en',
        ]
        read_only_fields = ['negocio']


class ModuloGlobalSerializer(serializers.ModelSerializer):
    class Meta:
        model = ModuloGlobal
        fields = [
            'salon_activo', 'cocina_activo', 'inventario_activo', 'delivery_activo',
            'clientes_activo', 'facturacion_activo', 'carta_qr_activo', 'bot_wsp_activo',
            'ml_activo', 'actualizado_en',
        ]


class DatosPagoPlataformaSerializer(serializers.ModelSerializer):
    class Meta:
        model = DatosPagoPlataforma
        fields = [
            'yape_numero', 'yape_titular', 'plin_numero', 'plin_titular',
            'banco', 'numero_cuenta', 'cci', 'titular_cuenta', 'actualizado_en',
        ]

class NegocioSerializer(serializers.ModelSerializer):
    plan_detalles = PlanSaaSSerializer(source='plan', read_only=True)
    propietario_username = serializers.ReadOnlyField(source='propietario.username')
    modulos_globales = serializers.SerializerMethodField()

    def get_modulos_globales(self, obj):
        """
        Interruptor maestro de Leybrak (ver ModuloGlobal). Se manda APARTE de
        los mod_*_activo del negocio a propósito: el frontend combina ambos
        solo para decidir qué mostrar, nunca reenvía este valor de vuelta al
        guardar la config del negocio, así que apagarlo acá no borra la
        preferencia real de nadie.
        """
        g = ModuloGlobal.actual()
        return {
            'salon':           g.salon_activo,
            'cocina':          g.cocina_activo,
            'inventario':      g.inventario_activo,
            'delivery':        g.delivery_activo,
            'clientes':        g.clientes_activo,
            'facturacion':     g.facturacion_activo,
            'cartaQr':         g.carta_qr_activo,
            'botWsp':          g.bot_wsp_activo,
            'machineLearning': g.ml_activo,
        }

    class Meta:
        model  = Negocio
        fields = [
            'id', 'propietario', 'propietario_username', 'nombre', 'ruc', 'razon_social', 'logo',
            'telefono_propietario', 'dni_propietario', 'nombre_propietario',
            'yape_numero', 'yape_qr', 'plin_numero', 'plin_qr',
            'confirmacion_automatica', 'device_token',
            'plan', 'plan_detalles', 'fecha_registro', 'fin_prueba', 'activo',
            'mod_salon_activo', 'mod_cocina_activo', 'mod_inventario_activo',
            'mod_delivery_activo', 'mod_clientes_activo', 'mod_facturacion_activo',
            'mod_carta_qr_activo', 'mod_bot_wsp_activo', 'mod_ml_activo',
            'modulos_globales',
            'color_primario', 'tema_fondo', 'carta_config',
            # Facturación electrónica (SUNAT / Nubefact)
            'facturacion_emision', 'facturacion_entorno',
            'facturacion_ruta', 'facturacion_token',
            'facturacion_serie_boleta', 'facturacion_serie_factura',
            # Personalidad del bot de WhatsApp
            'bot_nombre', 'bot_tono', 'bot_emojis', 'bot_reglas',
            'bot_personalidad', 'bot_instrucciones',
            # Programa de puntos / fidelización
            'puntos_activo', 'puntos_por_sol', 'puntos_canje_minimo', 'puntos_valor_soles',
        ]
        extra_kwargs = {
            # El token no se devuelve en claro; solo se escribe.
            'facturacion_token': {'write_only': True, 'required': False},
            'facturacion_ruta':  {'required': False},
        }

class SedeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sede
        fields = [
            'id', 'negocio', 'nombre', 'direccion', 'activo', 'columnas_salon',
            'latitud', 'longitud', 'whatsapp_instancia', 'whatsapp_numero',
            'enlace_carta_virtual', 'carta_pdf', 'hora_apertura', 'hora_cierre',
            'dias_atencion', 'bot_puntos_activos', 'bot_ingreso_automatico', 'bot_max_pedidos_pendientes',
            'bot_cumple_activo', 'bot_cumple_tipo', 'bot_cumple_valor',
            'bot_cumple_minimo', 'bot_cumple_productos',
        ]

class MesaSerializer(serializers.ModelSerializer):
    sede_nombre = serializers.ReadOnlyField(source='sede.nombre')

    class Meta:
        model = Mesa
        fields = [
            'id', 'sede', 'sede_nombre', 'numero_o_nombre', 'capacidad',
            'mesa_principal', 'activo', 'posicion_x', 'posicion_y', 'forma',
        ]

# ==========================================
# SERIALIZADORES: MODIFICADORES Y VARIACIONES
# ==========================================
class RecetaOpcionSerializer(serializers.ModelSerializer):
    nombre_insumo = serializers.CharField(source='insumo.nombre', read_only=True)
    unidad_medida = serializers.CharField(source='insumo.unidad_medida', read_only=True)

    class Meta:
        model = RecetaOpcion
        fields = ['id', 'opcion', 'insumo', 'nombre_insumo', 'unidad_medida', 'cantidad_necesaria']

class ModificadorRapidoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ModificadorRapido
        fields = ['id', 'negocio', 'nombre', 'precio', 'categorias_aplicables']

class OpcionVariacionSerializer(serializers.ModelSerializer):
    ingredientes = RecetaOpcionSerializer(many=True, required=False)
    class Meta:
        model = OpcionVariacion
        fields = ['id', 'nombre', 'precio_adicional', 'ingredientes']
        # 👇 Esto evita errores cuando actualizamos opciones que ya existen
        extra_kwargs = {'id': {'read_only': False, 'required': False}}

class GrupoVariacionSerializer(serializers.ModelSerializer):
    # 👇 Quitamos el read_only y ponemos required=False
    opciones = OpcionVariacionSerializer(many=True, required=False)

    class Meta:
        model = GrupoVariacion
        fields = ['id', 'nombre', 'obligatorio', 'seleccion_multiple', 'opciones']
        extra_kwargs = {'id': {'read_only': False, 'required': False}}

class VariacionProductoSerializer(serializers.ModelSerializer):
    class Meta:
        model = VariacionProducto
        fields = ['id', 'nombre', 'precio']

class ComponenteComboSerializer(serializers.ModelSerializer):
    producto_hijo_nombre = serializers.CharField(source='producto_hijo.nombre', read_only=True)
    
    class Meta:
        model = ComponenteCombo
        fields = ['id', 'producto_hijo', 'producto_hijo_nombre', 'cantidad',
                  'opcion_seleccionada', 'variacion_seleccionada']
        
class ProductoSerializer(serializers.ModelSerializer):
    grupos_variacion = GrupoVariacionSerializer(many=True, required=False)
    variaciones = VariacionProductoSerializer(many=True, read_only=True)
    items_combo = ComponenteComboSerializer(many=True, read_only=True) 
    precio_minimo = serializers.SerializerMethodField()
    precio_maximo = serializers.SerializerMethodField()

    class Meta:
        model = Producto
        fields = [
            'id', 'negocio', 'categoria', 'nombre', 'es_venta_rapida',
            'precio_base', 'disponible', 'tiene_variaciones', 'requiere_seleccion',
            'activo', 'imagen', 'es_combo', 'destacar_como_promocion','items_combo',
            'grupos_variacion', 'variaciones', 'precio_minimo', 'precio_maximo',
        ]

    def get_precio_minimo(self, obj):
        base = float(obj.precio_base)
        if not obj.tiene_variaciones:
            return base
        adicional = 0.0
        for grupo in obj.grupos_variacion.all():
            if grupo.obligatorio:
                precios = [float(op.precio_adicional) for op in grupo.opciones.all()]
                if precios:
                    adicional += min(precios)
        return base + adicional

    def get_precio_maximo(self, obj):
        base = float(obj.precio_base)
        if not obj.tiene_variaciones:
            return base
        adicional = 0.0
        for grupo in obj.grupos_variacion.all():
            precios = [float(op.precio_adicional) for op in grupo.opciones.all()]
            if precios:
                adicional += max(precios)
        return base + adicional

    # 🚀 MAGIA 1 ACTUALIZADA (Soporta Recetas de Opciones)
    def create(self, validated_data):
        grupos_data = validated_data.pop('grupos_variacion', [])
        producto = Producto.objects.create(**validated_data)

        for grupo_data in grupos_data:
            opciones_data = grupo_data.pop('opciones', [])
            grupo = GrupoVariacion.objects.create(producto=producto, **grupo_data)

            for opcion_data in opciones_data:
                # 👇 Sacamos los ingredientes antes de crear la opción
                ingredientes_data = opcion_data.pop('ingredientes', [])
                opcion = OpcionVariacion.objects.create(grupo=grupo, **opcion_data)

                # 👇 Guardamos los ingredientes físicos (La carne, el rachi, etc.)
                for ing_data in ingredientes_data:
                    insumo_obj = ing_data.get('insumo')
                    RecetaOpcion.objects.create(
                        opcion=opcion,
                        insumo=insumo_obj,
                        cantidad_necesaria=ing_data.get('cantidad_necesaria')
                    )

        return producto

    # 🚀 MAGIA 2 ACTUALIZADA (Actualización segura)
    def update(self, instance, validated_data):
        grupos_data = validated_data.pop('grupos_variacion', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if grupos_data is not None:
            instance.grupos_variacion.all().delete()

            for grupo_data in grupos_data:
                opciones_data = grupo_data.pop('opciones', [])
                grupo_data.pop('id', None)
                grupo = GrupoVariacion.objects.create(producto=instance, **grupo_data)

                for opcion_data in opciones_data:
                    ingredientes_data = opcion_data.pop('ingredientes', [])
                    opcion_data.pop('id', None)
                    opcion = OpcionVariacion.objects.create(grupo=grupo, **opcion_data)

                    for ing_data in ingredientes_data:
                        insumo_obj = ing_data.get('insumo')
                        RecetaOpcion.objects.create(
                            opcion=opcion,
                            insumo=insumo_obj,
                            cantidad_necesaria=ing_data.get('cantidad_necesaria')
                        )

        return instance

# ==========================================
# ORDEN Y DETALLES (Arquitectura 10/10)
# ==========================================

# ✨ NUEVO: Para que la cocina sepa qué opciones eligió el cliente
class DetalleOrdenOpcionSerializer(serializers.ModelSerializer):
    opcion_nombre = serializers.ReadOnlyField(source='opcion_variacion.nombre')

    class Meta:
        model = DetalleOrdenOpcion
        fields = ['id', 'opcion_nombre', 'precio_adicional_aplicado']

class DetalleOrdenSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.ReadOnlyField(source='producto.nombre')
    # ✨ NUEVO: Anidamos las opciones para que viajen junto con el plato
    opciones_seleccionadas = DetalleOrdenOpcionSerializer(many=True, read_only=True)

    class Meta:
        model = DetalleOrden
        fields = ['id', 'orden', 'producto', 'producto_nombre', 'cantidad',
                  'precio_unitario', 'notas_y_modificadores', 'notas_cocina',
                  'opciones_seleccionadas']
        read_only_fields = ['orden']

class OrdenSerializer(serializers.ModelSerializer):
    detalles = DetalleOrdenSerializer(many=True, read_only=True)
    mesa_nombre = serializers.ReadOnlyField(source='mesa.numero_o_nombre')
    sede_nombre = serializers.ReadOnlyField(source='sede.nombre')
    mesero_nombre = serializers.ReadOnlyField(source='mesero.nombre')

    class Meta:
        model = Orden
        fields = [
            'id', 'sede', 'sede_nombre', 'mesa', 'mesa_nombre',
            'mesero', 'mesero_nombre', 'tipo', 'estado', 'estado_pago',
            'subtotal', 'descuento_total', 'recargo_total', 'total',
            'cliente_nombre', 'cliente_telefono',
            'motivo_cancelacion', 'creado_en', 'detalles',
            'direccion_entrega', 'latitud', 'longitud',
            'costo_envio', 'metodo_pago_esperado'
        ]

class PagoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pago
        fields = ['id', 'orden', 'metodo', 'monto', 'sesion_caja', 'fecha_pago']

class RolSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rol
        fields = ['id', 'nombre', 'puede_cobrar', 'puede_configurar', 'puede_repartir']

class EmpleadoSerializer(serializers.ModelSerializer):
    rol_nombre = serializers.CharField(source='rol.nombre', read_only=True)
    sede_nombre = serializers.ReadOnlyField(source='sede.nombre')
    class Meta:
        model = Empleado
        # Ya no mostramos el PIN (hash) en las respuestas de la API por seguridad pura 🔒
        fields = ['id', 'nombre', 'rol','pin', 'rol_nombre', 'activo', 'ultimo_ingreso', 'sede', 'sede_nombre']
        extra_kwargs = {
            'pin': {'write_only': True}
        }

class SesionCajaSerializer(serializers.ModelSerializer):
    class Meta:
        model = SesionCaja
        fields = [
            'id', 'sede', 'empleado_abre', 'empleado_cierra',
            'hora_apertura', 'hora_cierre', 'fondo_inicial',
            'ventas_efectivo', 'ventas_digitales', 'estado',
            'esperado_efectivo', 'esperado_digital',
            'declarado_efectivo', 'declarado_yape', 'declarado_tarjeta',
            'diferencia',
        ]

class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = ['id', 'negocio', 'nombre', 'orden', 'activo']


class InsumoBaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = InsumoBase
        fields = ['id', 'nombre', 'negocio', 'unidad_medida', 'imagen', 'activo', 'stock_general']

class InsumoSedeSerializer(serializers.ModelSerializer):
    # Traemos el nombre del insumo base para que React lo vea fácil
    nombre_insumo = serializers.ReadOnlyField(source='insumo_base.nombre')
    unidad_medida = serializers.ReadOnlyField(source='insumo_base.unidad_medida')

    class Meta:
        model = InsumoSede
        fields = [
            'id', 'insumo_base', 'nombre_insumo', 'unidad_medida',
            'sede', 'stock_actual', 'stock_minimo', 'costo_unitario',
        ]

class ClienteSerializer(serializers.ModelSerializer):
    # ✨ Campo calculado: el bot solo lee un Booleano y sabe si saludar o no
    es_cumpleanos_hoy = serializers.SerializerMethodField()

    class Meta:
        model = Cliente
        fields = [
            'id', 'telefono', 'nombre', 'email', 'fecha_nacimiento',
            'puntos_acumulados', 'total_gastado', 'cantidad_pedidos',
            'ultima_compra', 'tags', 'es_cumpleanos_hoy','bot_estado', 'bot_memoria'
        ]
        # 🛡️ PROTECCIÓN: Estos campos solo los calcula el backend (Django)
        # No permitimos que se modifiquen vía POST o PUT.
        read_only_fields = [
            'puntos_acumulados', 'total_gastado',
            'cantidad_pedidos', 'ultima_compra'
        ]

    def get_es_cumpleanos_hoy(self, obj):
        """Lógica centralizada: Django decide si es el cumple, no el bot."""
        if obj.fecha_nacimiento:
            hoy = timezone.now().date()
            return (obj.fecha_nacimiento.day == hoy.day and
                    obj.fecha_nacimiento.month == hoy.month)
        return False


class ZonaDeliverySerializer(serializers.ModelSerializer):
    class Meta:
        model = ZonaDelivery
        fields = ['id', 'sede', 'nombre', 'radio_max_km', 'costo_envio', 'pedido_minimo', 'activa']

# ============================================================
# Agrega estos serializers al final de tu serializers.py
# (antes de la línea de ReglaNegocioSerializer que ya tienes)
# ============================================================

class HorarioVisibilidadSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)
    categoria_nombre = serializers.CharField(source='categoria.nombre', read_only=True)
    opcion_variacion_nombre = serializers.CharField(source='opcion_variacion.nombre', read_only=True)  # 👈
    sede_nombre = serializers.CharField(source='sede.nombre', read_only=True)
    class Meta:
        model = HorarioVisibilidad
        fields = [
            'id', 'negocio',
            'producto', 'producto_nombre',
            'categoria', 'categoria_nombre',
            'opcion_variacion', 'opcion_variacion_nombre',  # 👈
            'nombre', 'tipo_promo',
            'precio_especial', 'porcentaje_descuento',
            'compra_x', 'lleva_y','sede', 'sede_nombre', 
            'hora_inicio', 'hora_fin',
            'dias_permitidos', 'se_repite_semanalmente',
            'rangos_fechas', 'activa', 'creado_en',
        ]
        read_only_fields = ['negocio', 'creado_en']


class ReglaNegocioSerializer(serializers.ModelSerializer):
    # Nombres legibles para producto y categoría objetivo
    accion_producto_nombre = serializers.CharField(source='accion_producto.nombre', read_only=True)
    accion_categoria_nombre = serializers.CharField(source='accion_categoria.nombre', read_only=True)

    class Meta:
        model = ReglaNegocio
        fields = [
            'id', 'negocio', 'nombre', 'tipo',
            'valor', 'es_porcentaje',
            # Condiciones
            'monto_minimo_orden', 'dia_semana',
            'condicion_tipo_orden', 'condicion_metodo_pago',
            'condicion_hora_inicio', 'condicion_hora_fin',
            # Acción
            'accion_aplica_a', 'accion_es_descuento',
            'accion_producto', 'accion_producto_nombre',
            'accion_categoria', 'accion_categoria_nombre',
            'activa',
        ]
        read_only_fields = ['negocio']




class ProductoParaComboSerializer(serializers.ModelSerializer):
    """
    Versión liviana del producto para el selector de combos.
    Trae lo necesario para saber qué tipo es y mostrar sus opciones.
    """
    grupos_variacion = GrupoVariacionSerializer(many=True, read_only=True)

    class Meta:
        model = Producto
        fields = [
            'id', 'nombre', 'precio_base', 'imagen', 'categoria',
            'tiene_variaciones', 'requiere_seleccion',
            'grupos_variacion', 'variaciones',
        ]

class ItemComboPromocionalSerializer(serializers.ModelSerializer):
    producto_detalle = ProductoParaComboSerializer(source='producto', read_only=True)
    
    class Meta:
        model = ItemComboPromocional
        fields = [
            'id', 'producto', 'producto_detalle', 'cantidad',
            'opcion_seleccionada', 'variacion_seleccionada',
        ]

class ComboPromocionalSerializer(serializers.ModelSerializer):
    items = ItemComboPromocionalSerializer(many=True, read_only=True)
    sede_nombre = serializers.CharField(source='sede.nombre', read_only=True)
    class Meta:
        model = ComboPromocional
        fields = [
            'id', 'negocio', 'nombre', 'precio', 'imagen',
            'rangos_fechas', 'activo', 'creado_en', 'items','sede', 'sede_nombre',
        ]
        read_only_fields = ['negocio', 'creado_en']


class TicketSoporteSerializer(serializers.ModelSerializer):
    negocio_nombre = serializers.ReadOnlyField(source='negocio.nombre')

    class Meta:
        model = TicketSoporte
        fields = [
            'id', 'negocio', 'negocio_nombre', 'asunto', 'mensaje',
            'estado', 'prioridad', 'respuesta_staff', 'creado_en', 'actualizado_en',
        ]
        read_only_fields = ['negocio', 'creado_en', 'actualizado_en']