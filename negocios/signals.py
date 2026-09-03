from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from django.db.models import F
from django.db import transaction
from django.core.mail import EmailMultiAlternatives, send_mail
from core import settings # ✨ 1. Importamos la transacción
from .models import Empleado, HorarioVisibilidad, Negocio, Pago, InsumoSede, PagoSuscripcion, Producto, RecetaDetalle, RecetaOpcion, ReglaNegocio, ComponenteCombo

@receiver(post_save, sender=Pago)
def procesar_descuento_stock(sender, instance, created, **kwargs):
    """
    Cuando se crea un Pago, recorremos la orden y descontamos el stock
    de la receta base Y de las opciones extras elegidas.
    """
    if created:
        orden = instance.orden
        sede = orden.sede

        with transaction.atomic():
            for detalle in orden.detalles.all():
                producto = detalle.producto
                cantidad_vendida = detalle.cantidad

                # 🔪 1. DESCONTAMOS LA RECETA BASE DEL PLATO. Si es un Combo
                # Normal (es_combo=True), el combo casi nunca tiene receta
                # propia — lo que hay que descontar es la receta de cada
                # producto real que lo compone (ComponenteCombo).
                componentes = ComponenteCombo.objects.filter(combo=producto) if producto.es_combo else []

                if componentes:
                    for comp in componentes:
                        gasto_unidades = float(comp.cantidad) * float(cantidad_vendida)
                        for receta in RecetaDetalle.objects.filter(producto=comp.producto_hijo):
                            gasto_total = float(receta.cantidad_necesaria) * gasto_unidades
                            InsumoSede.objects.filter(
                                sede=sede, insumo_base=receta.insumo
                            ).update(stock_actual=F('stock_actual') - gasto_total)
                        # Si el componente preseleccionó una opción (ej. "Papas Grandes"
                        # dentro del combo), también descontamos la receta de esa opción.
                        if comp.opcion_seleccionada_id:
                            for receta_opc in RecetaOpcion.objects.filter(opcion=comp.opcion_seleccionada):
                                gasto_total_opcion = float(receta_opc.cantidad_necesaria) * gasto_unidades
                                InsumoSede.objects.filter(
                                    sede=sede, insumo_base=receta_opc.insumo
                                ).update(stock_actual=F('stock_actual') - gasto_total_opcion)
                else:
                    recetas_base = RecetaDetalle.objects.filter(producto=producto)
                    for receta in recetas_base:
                        gasto_total = float(receta.cantidad_necesaria) * float(cantidad_vendida)
                        InsumoSede.objects.filter(
                            sede=sede, insumo_base=receta.insumo
                        ).update(stock_actual=F('stock_actual') - gasto_total)

                # 🔪 2. ✨ NUEVO: DESCONTAMOS LAS VARIACIONES Y EXTRAS
                # Recorremos qué opciones eligió el cliente (Ej: Tamaño Familiar, Extra Rachi)
                for opcion_seleccionada in detalle.opciones_seleccionadas.all():
                    
                    # Buscamos la receta de esa opción específica
                    recetas_opcion = RecetaOpcion.objects.filter(opcion=opcion_seleccionada.opcion_variacion)
                    
                    for receta_opc in recetas_opcion:
                        # Si compró 2 pizzas familiares, gastamos 2 veces los insumos de la "Familiar"
                        gasto_total_opcion = float(receta_opc.cantidad_necesaria) * float(cantidad_vendida)
                        InsumoSede.objects.filter(
                            sede=sede, insumo_base=receta_opc.insumo
                        ).update(stock_actual=F('stock_actual') - gasto_total_opcion)

LOGO_URL = 'https://pos.leybrak.com/static/img/logo.png'
 
def _enviar_email_auditoria(negocio, accion, objeto, detalle):
    email_dueno = negocio.propietario.email
    if not email_dueno:
        return
 
    # Color e ícono según tipo de acción
    if 'Eliminado' in accion:
        color = '#ef4444'; emoji = '🗑️'
    elif 'Creado' in accion:
        color = '#10b981'; emoji = '✅'
    elif 'Precio' in accion:
        color = '#f59e0b'; emoji = '💰'
    elif 'Pago' in accion or 'Suscripción' in accion:
        color = '#8b5cf6'; emoji = '💳'
    elif 'Caja' in accion:
        color = '#06b6d4'; emoji = '🏦'
    else:
        color = '#ff5a1f'; emoji = '✏️'
 
    html = f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 16px;">
<tr><td align="center">
<table width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0">
 
  <!-- CARD -->
  <tr><td style="background:#111111;border-radius:20px;border:1px solid #222222;overflow:hidden;">
  <table width="100%" cellpadding="0" cellspacing="0">
 
    <!-- HEADER -->
    <tr>
      <td style="background:#0a0a0a;padding:28px 32px;text-align:center;border-bottom:1px solid #1a1a1a;">
        <img src="{LOGO_URL}" width="48" height="48" alt="Logo" style="display:block;margin:0 auto 12px;border-radius:10px;">
        <p style="margin:0;font-size:20px;font-weight:900;letter-spacing:-0.5px;color:#ffffff;">
          LEYBRAK <span style="color:#ff5a1f;">POS</span>
        </p>
        <p style="margin:4px 0 0;font-size:10px;font-weight:700;letter-spacing:3px;color:#525252;text-transform:uppercase;">
          Notificación de Auditoría
        </p>
      </td>
    </tr>
 
    <!-- BADGE -->
    <tr>
      <td style="padding:28px 32px 0;text-align:center;">
        <span style="display:inline-block;background:{color}18;color:{color};border:1px solid {color}40;padding:7px 18px;border-radius:100px;font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;">
          {emoji}&nbsp;&nbsp;{accion}
        </span>
      </td>
    </tr>
 
    <!-- NEGOCIO -->
    <tr>
      <td style="padding:14px 32px 0;text-align:center;">
        <p style="margin:0;font-size:22px;font-weight:900;color:#ffffff;">"{negocio.nombre}"</p>
        <p style="margin:6px 0 0;font-size:13px;color:#525252;">Se realizó el siguiente cambio en tu negocio</p>
      </td>
    </tr>
 
    <!-- DETALLE CARD -->
    <tr>
      <td style="padding:24px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:14px;border:1px solid #2a2a2a;">
          <tr>
            <td style="padding:22px 24px;">
 
              <!-- Objeto -->
              <p style="margin:0 0 4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#525252;">Objeto</p>
              <p style="margin:0 0 18px;font-size:16px;font-weight:800;color:#ffffff;padding-bottom:16px;border-bottom:1px solid #2a2a2a;">{objeto}</p>
 
              <!-- Detalle -->
              <p style="margin:0 0 4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#525252;">Detalle</p>
              <p style="margin:0;font-size:14px;color:#a3a3a3;line-height:1.7;">{detalle}</p>
 
            </td>
          </tr>
        </table>
      </td>
    </tr>
 
    <!-- ALERTA -->
    <tr>
      <td style="padding:0 32px 28px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#2a1a00;border-radius:10px;border:1px solid #451a00;">
          <tr>
            <td style="padding:14px 18px;">
              <p style="margin:0;font-size:12px;font-weight:600;color:#fb923c;">
                ⚠️&nbsp; Si no reconoces este cambio, contacta a soporte inmediatamente.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
 
    <!-- FOOTER -->
    <tr>
      <td style="background:#0a0a0a;border-top:1px solid #1a1a1a;padding:18px 32px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#404040;">
          Correo automático de <strong style="color:#737373;">Leybrak POS</strong> &nbsp;·&nbsp;
          <a href="https://leybrak.com" style="color:#ff5a1f;text-decoration:none;">leybrak.com</a>
        </p>
      </td>
    </tr>
 
  </table>
  </td></tr>
 
</table>
</td></tr>
</table>
</body>
</html>"""
 
    texto_plano = (
        f"[Leybrak POS] {accion}: {objeto}\n\n"
        f"Negocio: {negocio.nombre}\n"
        f"Detalle: {detalle}\n\n"
        f"Si no reconoces este cambio, contacta a soporte."
    )
 
    try:
        msg = EmailMultiAlternatives(
            subject=f'[Leybrak POS] {accion}: {objeto}',
            body=texto_plano,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[email_dueno],
        )
        msg.attach_alternative(html, 'text/html')
        msg.send(fail_silently=True)
    except Exception:
        pass

@receiver(post_save, sender=HorarioVisibilidad)
def auditoria_happy_hour(sender, instance, created, **kwargs):
    accion = 'Creado' if created else 'Editado'
    objetivo = instance.producto.nombre if instance.producto else (instance.categoria.nombre if instance.categoria else 'Sin objetivo')
    _enviar_email_auditoria(
        negocio=instance.negocio,
        accion=f'Happy Hour {accion}',
        objeto=instance.nombre,
        detalle=f'Tipo: {instance.get_tipo_promo_display()} | Aplica a: {objetivo} | Activo: {instance.activa}'
    )

@receiver(post_delete, sender=HorarioVisibilidad)
def auditoria_happy_hour_delete(sender, instance, **kwargs):
    objetivo = instance.producto.nombre if instance.producto else (instance.categoria.nombre if instance.categoria else 'Sin objetivo')
    _enviar_email_auditoria(
        negocio=instance.negocio,
        accion='Happy Hour Eliminado',
        objeto=instance.nombre,
        detalle=f'Aplica a: {objetivo}'
    )

@receiver(post_save, sender=ReglaNegocio)
def auditoria_regla(sender, instance, created, **kwargs):
    accion = 'Creada' if created else 'Editada'
    _enviar_email_auditoria(
        negocio=instance.negocio,
        accion=f'Regla de Negocio {accion}',
        objeto=instance.nombre or instance.get_tipo_display(),
        detalle=f'Tipo: {instance.get_tipo_display()} | Valor: {instance.valor} | Activa: {instance.activa}'
    )

@receiver(post_delete, sender=ReglaNegocio)
def auditoria_regla_delete(sender, instance, **kwargs):
    _enviar_email_auditoria(
        negocio=instance.negocio,
        accion='Regla de Negocio Eliminada',
        objeto=instance.nombre or instance.get_tipo_display(),
        detalle=f'Tipo: {instance.get_tipo_display()}'
    )

# ══════════════════════════════════════════════════════
# 💰 CAMBIO DE PRECIO DE PRODUCTO
# ══════════════════════════════════════════════════════
@receiver(post_save, sender=Producto)
def auditoria_precio_producto(sender, instance, created, **kwargs):
    if created:
        return  # No emailar al crear, solo al editar precio
    
    # Solo si cambió el precio — comparamos con el valor en BD
    # usando update_fields si viene del admin
    _enviar_email_auditoria(
        negocio=instance.negocio,
        accion='Precio Modificado',
        objeto=instance.nombre,
        detalle=f'Precio base actual: S/ {instance.precio_base} | Disponible: {instance.disponible}'
    )


# ══════════════════════════════════════════════════════
# 👤 EMPLEADO CREADO / EDITADO
# ══════════════════════════════════════════════════════
@receiver(post_save, sender=Empleado)
def auditoria_empleado(sender, instance, created, **kwargs):
    accion = 'Empleado Creado' if created else 'Empleado Editado'
    _enviar_email_auditoria(
        negocio=instance.negocio,
        accion=accion,
        objeto=instance.nombre,
        detalle=f'Rol: {instance.rol} | Sede: {instance.sede} | Activo: {instance.activo}'
    )

@receiver(post_delete, sender=Empleado)
def auditoria_empleado_delete(sender, instance, **kwargs):
    _enviar_email_auditoria(
        negocio=instance.negocio,
        accion='Empleado Eliminado',
        objeto=instance.nombre,
        detalle=f'Rol: {instance.rol} | Sede: {instance.sede}'
    )


# ══════════════════════════════════════════════════════
# 💳 SUSCRIPCIÓN CONFIRMADA
# ══════════════════════════════════════════════════════
@receiver(post_save, sender=PagoSuscripcion)
def reactivar_negocio_al_pagar(sender, instance, created, **kwargs):
    """
    Cuando un PagoSuscripcion queda 'pagado', reactiva el negocio
    si estaba bloqueado (activo=False).
    """
    if instance.estado == 'pagado' and not instance.negocio.activo:
        Negocio.objects.filter(id=instance.negocio.id).update(activo=True)

@receiver(post_save, sender=PagoSuscripcion)
def auditoria_pago_suscripcion(sender, instance, created, **kwargs):
    if instance.estado == 'pagado':
        _enviar_email_auditoria(
            negocio=instance.negocio,
            accion='Pago de Suscripción Confirmado',
            objeto=f'Plan {instance.plan.nombre if instance.plan else ""}',
            detalle=f'Monto: S/ {instance.monto} | Método: {instance.metodo_pago} | Periodo: {instance.periodo or "—"}'
        )