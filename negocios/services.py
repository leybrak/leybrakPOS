from datetime import timedelta
from decimal import Decimal
from django.contrib.auth.models import User
from django.utils import timezone
from django.utils.crypto import get_random_string
from django.db.models import Q
from .models import ReglaNegocio, HorarioVisibilidad, Negocio, Sede, PlanSaaS


# Qué módulo del Negocio activa cada permiso del Plan contratado.
# mod_salon_activo, mod_clientes_activo y mod_facturacion_activo no están acá
# porque son módulos base (no dependen del plan, los prende el dueño a mano).
PLAN_MODULO_MAP = {
    'modulo_kds':        'mod_cocina_activo',
    'modulo_inventario': 'mod_inventario_activo',
    'modulo_delivery':   'mod_delivery_activo',
    'modulo_carta_qr':   'mod_carta_qr_activo',
    'modulo_bot_wsp':    'mod_bot_wsp_activo',
    'modulo_ml':         'mod_ml_activo',
}


def precargar_modulos_por_plan(negocio):
    """
    Prende (OR, nunca apaga) los módulos que el plan del negocio incluye.
    Se llama al crear el negocio o al cambiarle el plan — desde el admin
    (NegocioAdmin.save_model) y desde el panel de staff (crear_negocio_completo).
    """
    if not negocio.plan_id:
        return
    for campo_plan, campo_modulo in PLAN_MODULO_MAP.items():
        if getattr(negocio.plan, campo_plan):
            setattr(negocio, campo_modulo, True)


def crear_negocio_completo(
    nombre, propietario_username, propietario_email='', propietario_password=None,
    propietario=None, plan_id=None, fin_prueba=None, sede_nombre=None,
):
    """
    Crea (o reusa) el propietario, el Negocio y opcionalmente la primera
    Sede, en un solo paso — misma lógica para el admin de Django y para
    el endpoint del panel de staff, así no divergen con el tiempo.
    """
    if propietario is None:
        if User.objects.filter(username=propietario_username).exists():
            raise ValueError(f'Ya existe un usuario "{propietario_username}".')
        propietario = User.objects.create_user(
            username=propietario_username,
            email=propietario_email,
            password=propietario_password or get_random_string(16),
        )

    plan = None
    if plan_id:
        try:
            plan = PlanSaaS.objects.get(id=plan_id)
        except PlanSaaS.DoesNotExist:
            raise ValueError(f'No existe el plan con id={plan_id}.')

    negocio = Negocio(
        propietario=propietario,
        nombre=nombre,
        plan=plan,
        fin_prueba=fin_prueba or (timezone.now() + timedelta(days=30)),
    )
    precargar_modulos_por_plan(negocio)
    negocio.save()

    if sede_nombre:
        Sede.objects.create(negocio=negocio, nombre=sede_nombre)

    return negocio


def _evaluar_condiciones_regla(regla, orden, metodo_lower, ahora):
    """
    Evalúa si una regla cumple TODAS sus condiciones para aplicarse.
    Retorna True si aplica, False si no.
    """
    subtotal = orden.subtotal
    dia_hoy = ahora.weekday()   # 0=Lunes, 6=Domingo
    hora_hoy = ahora.time()

    if subtotal < regla.monto_minimo_orden:
        return False

    if regla.dia_semana is not None and regla.dia_semana != dia_hoy:
        return False

    if regla.condicion_tipo_orden and regla.condicion_tipo_orden != 'cualquiera':
        if orden.tipo != regla.condicion_tipo_orden:
            return False

    if regla.condicion_metodo_pago and regla.condicion_metodo_pago != 'cualquiera':
        if regla.condicion_metodo_pago not in metodo_lower:
            return False

    if regla.condicion_hora_inicio and regla.condicion_hora_fin:
        if not (regla.condicion_hora_inicio <= hora_hoy <= regla.condicion_hora_fin):
            return False
    elif regla.condicion_hora_inicio:
        if hora_hoy < regla.condicion_hora_inicio:
            return False
    elif regla.condicion_hora_fin:
        if hora_hoy > regla.condicion_hora_fin:
            return False

    return True


def _calcular_descuento_happy_hours(orden, ahora):
    """
    Calcula el descuento total de happy hours activas para la orden.
    Retorna (descuento_hh, lineas_hh).
    """
    dia_hoy = ahora.weekday()
    hora_hoy = ahora.time()
    fecha_hoy = ahora.date()

    negocio = orden.sede.negocio

    # Traemos HH activas del negocio filtradas por sede
    hhs = HorarioVisibilidad.objects.filter(
        negocio=negocio,
        activa=True
    ).filter(
        Q(sede=orden.sede) | Q(sede__isnull=True)
    ).select_related('producto', 'categoria', 'opcion_variacion')

    descuento_total = Decimal('0.00')
    lineas = []

    # Filtrar las que aplican hoy en día/hora/fecha
    hhs_activas = []
    for hh in hhs:
        if hh.dias_permitidos and dia_hoy not in hh.dias_permitidos:
            continue

        if hh.hora_inicio and hh.hora_fin:
            if not (hh.hora_inicio <= hora_hoy <= hh.hora_fin):
                continue
        elif hh.hora_inicio and hora_hoy < hh.hora_inicio:
            continue
        elif hh.hora_fin and hora_hoy > hh.hora_fin:
            continue

        if not hh.se_repite_semanalmente and hh.rangos_fechas:
            en_rango = False
            for rango in hh.rangos_fechas:
                try:
                    from datetime import date
                    inicio = date.fromisoformat(rango['inicio'])
                    fin = date.fromisoformat(rango['fin'])
                    if inicio <= fecha_hoy <= fin:
                        en_rango = True
                        break
                except (KeyError, ValueError):
                    continue
            if not en_rango:
                continue

        hhs_activas.append(hh)

    # Aplicar cada HH activa a los detalles de la orden
    for hh in hhs_activas:
        if hh.tipo_promo == 'visibilidad':
            continue

        for detalle in orden.detalles.all():
            producto = detalle.producto

            # Verificar si aplica a este producto o categoría
            aplica = False
            if hh.producto_id and hh.producto_id == producto.id:
                aplica = True
            elif hh.categoria_id and hh.categoria_id == producto.categoria_id:
                aplica = True

            if not aplica:
                continue

            # Si la HH es para una presentación específica, verificar que coincida
            if hh.opcion_variacion_id:
                opciones_del_detalle = detalle.opciones_seleccionadas.values_list(
                    'opcion_variacion_id', flat=True
                )
                if hh.opcion_variacion_id not in opciones_del_detalle:
                    continue

            precio_unitario = Decimal(str(detalle.precio_unitario))
            cantidad = detalle.cantidad

            if hh.tipo_promo == 'precio_especial' and hh.precio_especial:
                precio_nuevo = Decimal(str(hh.precio_especial))
                ahorro = (precio_unitario - precio_nuevo) * cantidad
                if ahorro > 0:
                    descuento_total += ahorro
                    lineas.append({
                        'label': f'{hh.nombre} → {producto.nombre}',
                        'tipo': 'descuento',
                        'monto': float(ahorro),
                    })

            elif hh.tipo_promo == 'porcentaje' and hh.porcentaje_descuento:
                porcentaje = Decimal(str(hh.porcentaje_descuento)) / 100
                ahorro = precio_unitario * cantidad * porcentaje
                descuento_total += ahorro
                lineas.append({
                    'label': f'{hh.nombre} (-{hh.porcentaje_descuento}%) → {producto.nombre}',
                    'tipo': 'descuento',
                    'monto': float(ahorro),
                })

            elif hh.tipo_promo == 'nx_y':
                compra_x = hh.compra_x
                lleva_y = hh.lleva_y
                if compra_x > 0 and cantidad >= compra_x:
                    grupos = cantidad // compra_x
                    unidades_gratis = grupos * lleva_y
                    ahorro = precio_unitario * unidades_gratis
                    descuento_total += ahorro
                    lineas.append({
                        'label': f'{hh.nombre} ({compra_x}x{compra_x - lleva_y}) → {producto.nombre}',
                        'tipo': 'descuento',
                        'monto': float(ahorro),
                        'unidades_gratis': unidades_gratis,
                    })

    return descuento_total.quantize(Decimal('0.01')), lineas


def aplicar_reglas_negocio(orden, metodo_pago=None):
    """
    Recalcula subtotal, descuento_total, recargo_total y total de una Orden
    aplicando todas las ReglaNegocio y HorarioVisibilidad activas del negocio.
    """
    subtotal = sum(
        d.precio_unitario * d.cantidad
        for d in orden.detalles.all()
    )
    subtotal = Decimal(str(subtotal))
    orden.subtotal = subtotal

    ahora = timezone.localtime()
    metodo_lower = str(metodo_pago or orden.metodo_pago_esperado or '').lower()
    costo_envio = Decimal(str(orden.costo_envio or 0))

    descuento = Decimal('0.00')
    recargo = Decimal('0.00')

    # Aplicar Happy Hours
    descuento_hh, _ = _calcular_descuento_happy_hours(orden, ahora)
    descuento += descuento_hh

    # Aplicar Reglas de Negocio
    reglas = ReglaNegocio.objects.filter(negocio=orden.sede.negocio, activa=True)

    for regla in reglas:
        if not _evaluar_condiciones_regla(regla, orden, metodo_lower, ahora):
            continue

        valor = Decimal(str(regla.valor))

        def monto_o_porcentaje(base, v=valor, r=regla):
            return base * v / 100 if r.es_porcentaje else v

        if regla.tipo == 'recargo_llevar' and orden.tipo == 'llevar':
            recargo += monto_o_porcentaje(subtotal)

        elif regla.tipo == 'delivery_gratis' and orden.tipo == 'delivery':
            costo_envio = Decimal('0.00')
            orden.costo_envio = Decimal('0.00')

        elif regla.tipo == 'descuento_dia':
            descuento += monto_o_porcentaje(subtotal)

        elif regla.tipo == 'descuento_yape_efectivo':
            metodos_descuento = ('yape', 'efectivo', 'plin')
            if any(m in metodo_lower for m in metodos_descuento):
                descuento += monto_o_porcentaje(subtotal)

        elif regla.tipo == 'recargo_nocturno':
            hora_hoy = ahora.hour
            if hora_hoy >= 22 or hora_hoy < 6:
                recargo += monto_o_porcentaje(subtotal)

        elif regla.tipo == 'servicio_grupo_grande':
            recargo += monto_o_porcentaje(subtotal)

        elif regla.tipo == 'personalizada':
            monto = monto_o_porcentaje(subtotal)
            if regla.accion_es_descuento:
                descuento += monto
            else:
                recargo += monto

    orden.descuento_total = descuento.quantize(Decimal('0.01'))
    orden.recargo_total = recargo.quantize(Decimal('0.01'))

    total = subtotal - descuento + recargo + costo_envio
    orden.total = max(total, Decimal('0.00')).quantize(Decimal('0.01'))


def calcular_preview_happy_hours(orden):
    """
    Devuelve las líneas de happy hours activas para una orden
    sin modificar nada — útil para el frontend en tiempo real.
    """
    ahora = timezone.localtime()
    _, lineas = _calcular_descuento_happy_hours(orden, ahora)
    return lineas