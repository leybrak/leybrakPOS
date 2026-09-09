import React, { useState, useEffect, useCallback, useRef } from 'react';
import usePosStore from '../../store/usePosStore';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import api, { enviarTicketWhatsapp, emitirComprobante } from '../../api/api';
import { usePagosWS } from '../../features/POS/hooks/usePagosWS';
import ModalEmitirComprobante from './ModalEmitirComprobante';
import {
  X, Banknote, Smartphone, CreditCard, CheckCircle2,
  Users, Receipt, MessageCircle, ArrowLeft, Loader2, FileText, Download, Building2
} from 'lucide-react';

export default function ModalCobroMejorado({ isOpen, onClose, total, onCobroExitoso, carrito = [], esVentaRapida = false, ordenId = null }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { configuracionGlobal } = usePosStore();
  const config = configuracionGlobal || {};
  const tema = config.temaFondo || 'dark';
  const colorPrimario = config.colorPrimario || '#8b5cf6';
  const isDark = tema === 'dark';

  // ─── Flags del negocio ───────────────────────────────────────
  const negocioId                 = config.negocio_id;
  const usaConfirmacionAutomatica = !!(config.confirmacion_automatica);
  const facturacionEmision        = config.facturacion_emision || 'desactivado';

  // ─── Facturación SUNAT ───────────────────────────────────────
  const [mostrarComprobante, setMostrarComprobante] = useState(false);
  const [comprobanteOrdenId, setComprobanteOrdenId] = useState(null);
  const cobroComprometidoRef = useRef(false);
  const ticketEnviadoRef = useRef(false);   // evita doble envío del ticket por WhatsApp
  // ─── Estados principales ─────────────────────────────────────
  const [paso, setPaso]                             = useState('cobro');
  const [tab, setTab]                               = useState('completo');
  const [metodo, setMetodo]                         = useState('efectivo');
  const [montoIngresado, setMontoIngresado]         = useState('');
  const [dividirEntre, setDividirEntre]             = useState(2);
  const [itemsSeleccionados, setItemsSeleccionados] = useState({});
  const [pagosAcumulados, setPagosAcumulados]       = useState([]);
  const [telefonoTicket, setTelefonoTicket]         = useState('');
  // Emisión inline del comprobante (boleta) en la pantalla de éxito
  const [dniBoleta, setDniBoleta]                   = useState('');
  const [emitiendoComp, setEmitiendoComp]           = useState(false);
  const [resultadoComp, setResultadoComp]           = useState(null);
  const [errorComp, setErrorComp]                   = useState(null);

  // ─── Estados Yape / Plin automático ──────────────────────────
  const [notificaciones, setNotificaciones]           = useState([]);
  const [notificacionElegida, setNotificacionElegida] = useState(null);
  const esperaTimeoutRef = useRef(null);

  // ─── Preview descuento/recargo ───────────────────────────────
  const [preview, setPreview]               = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // ─── Refs para el callback del WS (evita stale closures) ─────
  const pasoRef       = useRef(paso);
  const metodoRef     = useRef(metodo);
  const montoCobroRef = useRef(0);
  useEffect(() => { pasoRef.current   = paso;   }, [paso]);
  useEffect(() => { metodoRef.current = metodo; }, [metodo]);

  // ─── Callback que maneja los mensajes del canal de pagos por WS ─
  const manejarMensajePagos = useCallback((data) => {
    if (data.type === 'notificacion_confirmada') {
      // Otra caja del mismo negocio ya usó esta notificación (pagó una
      // mesa distinta con el mismo monto) — la sacamos de la lista antes
      // de que alguien acá intente tocarla pensando que sigue disponible.
      setNotificaciones(prev => prev.filter(n => n.notificacion_id !== data.notificacion_id));
      return;
    }

    if (data.type !== 'pago_recibido') return;
    if (pasoRef.current   !== 'qr')   return;
    if (metodoRef.current !== 'yape' && metodoRef.current !== 'plin') return;

    const montoNotificacion = parseFloat(data.monto);
    const montoEsperado     = parseFloat(montoCobroRef.current.toFixed(2));
    if (Math.abs(montoNotificacion - montoEsperado) >= 0.01) return;

    setNotificaciones(prev => {
      if (prev.some(n => n.notificacion_id === data.notificacion_id)) return prev;
      return [...prev, data];
    });
  }, []);

  // ─── Hook WebSocket de pagos ──────────────────────────────────
  usePagosWS(
    usaConfirmacionAutomatica ? negocioId : null,
    manejarMensajePagos
  );

  // ─── Reset al abrir / cerrar ──────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setPaso('cobro');
      setTab('completo');
      setMetodo('efectivo');
      setMontoIngresado('');
      setDividirEntre(2);
      setItemsSeleccionados({});
      setPagosAcumulados([]);
      setTelefonoTicket('');
      setPreview(null);
      setNotificaciones([]);
      setNotificacionElegida(null);
      setMostrarComprobante(false);
      setComprobanteOrdenId(null);
      cobroComprometidoRef.current = false;
      ticketEnviadoRef.current = false;
      setDniBoleta('');
      setEmitiendoComp(false);
      setResultadoComp(null);
      setErrorComp(null);
      if (esperaTimeoutRef.current) clearTimeout(esperaTimeoutRef.current);
    }
    return () => {
      if (esperaTimeoutRef.current) clearTimeout(esperaTimeoutRef.current);
    };
  }, [isOpen]);

  // ─── Preview de descuento/recargo ────────────────────────────
  const fetchPreview = useCallback(async (metodoActual) => {
    if (!ordenId) return;
    setLoadingPreview(true);
    try {
      const res = await api.post(`/ordenes/${ordenId}/preview_cobro/`, { metodo: metodoActual });
      setPreview(res.data);
    } catch {
      setPreview(null);
    } finally {
      setLoadingPreview(false);
    }
  }, [ordenId]);

  useEffect(() => {
    if (isOpen && ordenId) fetchPreview(metodo);
  }, [metodo, isOpen, ordenId, fetchPreview]);

  if (!isOpen) return null;

  // ─── Cálculos de montos ───────────────────────────────────────
  const totalEfectivo = preview ? preview.total : total;
  const totalPagado   = pagosAcumulados.reduce((sum, p) => sum + p.monto, 0);
  const restante      = totalEfectivo - totalPagado;

  const calcularMontoCobro = () => {
    if (tab === 'completo') return restante;
    if (tab === 'dividir')  return restante / dividirEntre;
    if (tab === 'items') {
      return carrito.reduce((sum, item) => {
        const cant   = itemsSeleccionados[item.id] || 0;
        const precio = parseFloat(item.precio_unitario || item.precio || 0);
        return sum + (cant * precio);
      }, 0);
    }
    return 0;
  };

  const montoCobro      = calcularMontoCobro();
  montoCobroRef.current = montoCobro;
  const montoRecibido   = parseFloat(montoIngresado) || 0;
  const vuelto          = montoRecibido > montoCobro ? montoRecibido - montoCobro : 0;

  const toggleItem = (itemId, maxCant) => {
    setItemsSeleccionados(prev => {
      const current = prev[itemId] || 0;
      if (current === 0)     return { ...prev, [itemId]: 1 };
      if (current < maxCant) return { ...prev, [itemId]: current + 1 };
      return { ...prev, [itemId]: 0 };
    });
  };

  const registrarPago = (monto, vueltoCalculado = 0, yaConfirmado = false) => {
  const nuevos = [...pagosAcumulados, { metodo, monto, vuelto: vueltoCalculado, yaConfirmado }];
  setPagosAcumulados(nuevos);
  const nuevoTotal = totalPagado + monto;
  if (nuevoTotal >= totalEfectivo - 0.01) {
    setPaso('exito');
  } else   {
      const restanteNuevo = totalEfectivo - nuevoTotal;
      toast.success(`Pago de S/ ${monto.toFixed(2)} registrado. Falta: S/ ${restanteNuevo.toFixed(2)}`);
      setMontoIngresado('');
      setTab('completo');
      setItemsSeleccionados({});
      setNotificaciones([]);
      setNotificacionElegida(null);
      setPaso('cobro');
    }
  };

  // ─── Confirmar notificación recibida por WS ───────────────────
 const confirmarNotificacion = async (notificacion) => {
  // 🛡️ Si hay 2+ pagos del mismo monto a la vez (dos clientes pagando lo
  // mismo casi juntos), nada impide tocar el que no corresponde — el
  // sistema no sabe cuál mesa mandó cuál Yape, solo el cajero puede
  // verificarlo leyendo el nombre/código. Con un solo pago en pantalla no
  // hay ambigüedad posible, así que no agregamos este paso de más.
  if (notificaciones.length >= 2) {
    const esYape = notificacion.tipo === 'YAPE';
    const detalle = esYape && notificacion.codigo_seguridad
      ? `el código de seguridad es ${notificacion.codigo_seguridad}`
      : `el nombre es "${notificacion.nombre_cliente}"`;
    const ok = await confirm({
      titulo: 'Hay más de un pago con este monto',
      mensaje: `Verifica con el cliente que ${detalle} antes de confirmar — hay otro pago de S/ ${parseFloat(notificacion.monto).toFixed(2)} esperando al mismo tiempo.`,
      textoConfirmar: 'Sí, coincide',
      textoCancelar: 'Cancelar',
      peligroso: false,
    });
    if (!ok) return;
  }

  setNotificacionElegida(notificacion);
  try {
    await api.post('/yape/confirmar/', {
      notificacion_id: notificacion.notificacion_id,
      orden_id:        ordenId,
    });
    setNotificaciones([]);
    // ✅ Flag que indica que el backend ya procesó el pago
    registrarPago(parseFloat(notificacion.monto), 0, true);
  } catch (e) {
    toast.error(e?.response?.data?.error || 'Error al confirmar el pago. Intenta de nuevo.');
    setNotificacionElegida(null);
  }
};

  // ─── Navegación ───────────────────────────────────────────────
  const procesarCobro = () => {
    if (metodo !== 'efectivo') {
      setNotificaciones([]);
      setNotificacionElegida(null);
      setPaso('qr');
      return;
    }
    if (!montoIngresado || montoRecibido <= 0) {
      toast.warning('Ingresa el monto recibido del cliente.');
      return;
    }
    if (montoRecibido < montoCobro) {
      registrarPago(montoRecibido, 0);
      return;
    }
    registrarPago(montoCobro, vuelto);
  };

  const volverACobro = () => {
    setNotificaciones([]);
    setNotificacionElegida(null);
    setPaso('cobro');
  };

  // Persiste el cobro UNA sola vez y devuelve el ordenId real (importante para
  // venta rápida, donde la orden se crea aquí). Idempotente.
  const comprometerCobro = async (pagosOverride) => {
    if (cobroComprometidoRef.current) return comprobanteOrdenId;
    cobroComprometidoRef.current = true;
    try {
      const r = await onCobroExitoso({
        pagos: pagosOverride || pagosAcumulados,
        telefono: telefonoTicket,
      });
      const id = (r && r.ordenId) || ordenId;
      setComprobanteOrdenId(id);
      return id;
    } catch (e) {
      cobroComprometidoRef.current = false;   // permite reintentar
      throw e;
    }
  };

  // Dispara el envío del ticket por WhatsApp (una sola vez). El backend decide
  // si manda el PDF de la boleta o un recibo de texto, según exista comprobante.
  const dispararTicket = async (id) => {
    const tel = (telefonoTicket || '').trim();
    if (!tel || !id || ticketEnviadoRef.current) return;
    ticketEnviadoRef.current = true;
    try { await enviarTicketWhatsapp(id, tel); } catch (_) { /* fire-and-forget */ }
  };

  // "Finalizar" (modo desactivado): comitea, manda ticket de texto y cierra.
  const finalizarCobro = async () => {
    let id;
    try { id = await comprometerCobro(); } catch { return; }   // si falla, no cierra
    await dispararTicket(id);      // sin comprobante → recibo de texto
    onClose({ pagado: true });
  };

  // "Finalizar y emitir boleta": comitea, emite la boleta inline (DNI opcional),
  // muestra el resultado en el mismo modal y manda el PDF por WhatsApp.
  const finalizarConBoleta = async () => {
    if (dniBoleta && dniBoleta.length !== 8) {
      setErrorComp('El DNI debe tener 8 dígitos (o déjalo vacío).');
      return;
    }
    let id;
    try { id = await comprometerCobro(); } catch { return; }
    setErrorComp(null); setEmitiendoComp(true);
    try {
      const receptor = dniBoleta ? { num_doc: dniBoleta } : {};
      const r = await emitirComprobante(id, { tipo: 'boleta', receptor });
      setResultadoComp(r.data);
      dispararTicket(id);   // ya hay comprobante → manda el PDF por WhatsApp
    } catch (e) {
      setErrorComp(e?.response?.data?.error || 'No se pudo emitir la boleta.');
    } finally {
      setEmitiendoComp(false);
    }
  };

  // "¿Factura con RUC?": comitea y abre el modal completo (RUC + razón social).
  const abrirFactura = async () => {
    try { await comprometerCobro(); } catch { return; }
    setMostrarComprobante(true);
  };

  // "Cerrar" / "Finalizar sin comprobante": comitea y cierra, sin emitir.
  const cerrarCobro = async () => {
    let id;
    try { id = await comprometerCobro(); } catch { return; }
    await dispararTicket(id);   // sin comprobante → recibo de texto
    onClose({ pagado: true });
  };

  const metodosDisponibles = [
    { id: 'efectivo', nombre: 'Efectivo', icono: Banknote,   disponible: true },
    { id: 'yape',     nombre: 'Yape',     icono: Smartphone, disponible: !!(config.yape_numero || config.yape_qr), color: '#6d28d9' },
    { id: 'plin',     nombre: 'Plin',     icono: Smartphone, disponible: !!(config.plin_numero || config.plin_qr), color: '#14b8a6' },
    { id: 'tarjeta',  nombre: 'Tarjeta',  icono: CreditCard, disponible: true, color: '#3b82f6' },
  ].filter(m => m.disponible);

  // ══════════════════════════════════════════════
  // RENDER: Pantalla principal de cobro
  // ══════════════════════════════════════════════
  if (paso === 'cobro') {
    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4">
        <div className={`w-full max-w-lg md:rounded-3xl shadow-2xl border h-[95vh] md:h-auto md:max-h-[90vh] flex flex-col ${isDark ? 'bg-[#0a0a0a] border-[#1a1a1a]' : 'bg-white border-gray-200'}`}>

          {/* Header */}
          <div className={`p-6 border-b flex-shrink-0 ${isDark ? 'border-[#1a1a1a]' : 'border-gray-100'}`}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className={`text-2xl font-black mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>Procesar Pago</h2>
                <p className={`text-sm ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
                  {restante < total ? 'Pago parcial' : 'Selecciona el método de pago'}
                </p>
              </div>
              <button onClick={onClose} className={`p-2 rounded-xl transition-colors ${isDark ? 'hover:bg-[#1a1a1a] text-neutral-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                <X size={20} />
              </button>
            </div>

            {/* Totales */}
            <div className={`rounded-2xl p-6 text-center ${isDark ? 'bg-[#111]' : 'bg-gradient-to-br from-gray-50 to-gray-100'}`}>
              {totalPagado > 0 && (
                <div className={`mb-4 pb-4 border-b ${isDark ? 'border-[#1a1a1a]' : 'border-gray-200'}`}>
                  <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>Progreso del pago</p>
                  <div className={`w-full h-2 rounded-full mb-2 ${isDark ? 'bg-[#0a0a0a]' : 'bg-gray-200'}`}>
                    <div className="h-full rounded-full bg-green-500 transition-all duration-500" style={{ width: `${(totalPagado / total) * 100}%` }} />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className={isDark ? 'text-green-400' : 'text-green-600'}>✓ Pagado: S/ {totalPagado.toFixed(2)}</span>
                    <span className={isDark ? 'text-neutral-500' : 'text-gray-500'}>de S/ {total.toFixed(2)}</span>
                  </div>
                </div>
              )}
              <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
                {restante < totalEfectivo ? 'Por cobrar' : 'Total'}
              </p>
              <p className={`text-5xl font-black tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {loadingPreview
                  ? <span className="text-2xl opacity-50">Calculando...</span>
                  : `S/ ${restante.toFixed(2)}`}
              </p>
              {preview && (preview.descuento_total > 0 || preview.recargo_total > 0) && (
                <div className={`mt-4 pt-4 border-t text-left space-y-1 ${isDark ? 'border-[#1a1a1a]' : 'border-gray-200'}`}>
                  <div className="flex justify-between text-xs">
                    <span className={isDark ? 'text-neutral-500' : 'text-gray-500'}>Subtotal</span>
                    <span className={isDark ? 'text-neutral-300' : 'text-gray-700'}>S/ {preview.subtotal.toFixed(2)}</span>
                  </div>
                  {preview.descuento_total > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-green-400 font-bold">Descuento aplicado</span>
                      <span className="text-green-400 font-bold">− S/ {preview.descuento_total.toFixed(2)}</span>
                    </div>
                  )}
                  {preview.recargo_total > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-orange-400 font-bold">Recargo</span>
                      <span className="text-orange-400 font-bold">+ S/ {preview.recargo_total.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}
              {pagosAcumulados.length > 0 && (
                <div className={`mt-4 pt-4 border-t ${isDark ? 'border-[#1a1a1a]' : 'border-gray-200'}`}>
                  <p className={`text-xs font-bold mb-2 ${isDark ? 'text-neutral-500' : 'text-gray-600'}`}>Pagos registrados:</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {pagosAcumulados.map((pago, idx) => (
                      <div key={idx} className={`px-3 py-1 rounded-lg text-xs font-bold ${isDark ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                        {pago.metodo.charAt(0).toUpperCase() + pago.metodo.slice(1)}: S/ {pago.monto.toFixed(2)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">

            {/* Métodos */}
            <div className="mb-4">
              <p className={`text-xs font-bold uppercase tracking-wider mb-3 ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>Método de pago</p>
              <div className="flex gap-2">
                {metodosDisponibles.map(({ id, nombre, icono: Icon, color }) => (
                  <button
                    key={id}
                    onClick={() => setMetodo(id)}
                    className={`flex-1 p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                      metodo === id
                        ? isDark ? 'border-white/20 bg-[#1a1a1a]' : 'border-gray-300 bg-gray-50'
                        : `border-transparent ${isDark ? 'bg-[#111] hover:bg-[#151515]' : 'bg-gray-50 hover:bg-gray-100'}`
                    }`}
                    style={metodo === id && color ? { borderColor: color } : {}}
                  >
                    <Icon size={20} className={metodo === id ? '' : isDark ? 'text-neutral-500' : 'text-gray-400'} style={metodo === id && color ? { color } : {}} />
                    <p className={`font-bold text-xs ${metodo === id ? isDark ? 'text-white' : 'text-gray-900' : isDark ? 'text-neutral-500' : 'text-gray-600'}`}>{nombre}</p>
                  </button>
                ))}
              </div>
              {(metodo === 'yape' || metodo === 'plin') && usaConfirmacionAutomatica && (
                <div className={`mt-2 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 ${isDark ? 'bg-green-500/10 text-green-400' : 'bg-green-50 text-green-700'}`}>
                  <CheckCircle2 size={12} />
                  <span className="font-bold">Validación automática activa</span>
                </div>
              )}
            </div>

            {/* Tabs */}
            {!esVentaRapida && (
              <div className={`flex gap-2 p-1 rounded-xl mb-4 ${isDark ? 'bg-[#111]' : 'bg-gray-100'}`}>
                {[{ id: 'completo', label: 'Todo', icon: Receipt }, { id: 'dividir', label: 'Dividir', icon: Users }, { id: 'items', label: 'Items', icon: Receipt }].map(({ id, label, icon: Icon }) => (
                  <button key={id} onClick={() => setTab(id)} className={`flex-1 py-2.5 px-3 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-2 ${tab === id ? isDark ? 'bg-[#1a1a1a] text-white' : 'bg-white text-gray-900 shadow-sm' : isDark ? 'text-neutral-500 hover:text-neutral-300' : 'text-gray-600 hover:text-gray-900'}`}>
                    <Icon size={14} />{label}
                  </button>
                ))}
              </div>
            )}

            {/* Tab dividir */}
            {!esVentaRapida && tab === 'dividir' && (
              <div className={`p-4 rounded-xl mb-4 ${isDark ? 'bg-[#111]' : 'bg-gray-50'}`}>
                <p className={`text-xs font-bold mb-3 ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>Dividir cuenta entre:</p>
                <div className="flex items-center gap-3">
                  <button onClick={() => setDividirEntre(Math.max(2, dividirEntre - 1))} className={`w-10 h-10 rounded-xl font-bold ${isDark ? 'bg-[#1a1a1a] text-white' : 'bg-white text-gray-900'}`}>-</button>
                  <div className="flex-1 text-center">
                    <p className={`text-3xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>{dividirEntre}</p>
                    <p className={`text-xs ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>personas</p>
                  </div>
                  <button onClick={() => setDividirEntre(dividirEntre + 1)} className={`w-10 h-10 rounded-xl font-bold ${isDark ? 'bg-[#1a1a1a] text-white' : 'bg-white text-gray-900'}`}>+</button>
                </div>
                <div className={`mt-3 p-3 rounded-lg text-center ${isDark ? 'bg-[#0a0a0a]' : 'bg-white'}`}>
                  <p className={`text-xs mb-1 ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>Cada persona paga:</p>
                  <p className={`text-2xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>S/ {(restante / dividirEntre).toFixed(2)}</p>
                </div>
              </div>
            )}

            {/* Tab items */}
            {!esVentaRapida && tab === 'items' && (
              <div className="max-h-48 overflow-y-auto space-y-2 mb-4">
                {carrito.map(item => {
                  const nombre  = item.producto?.nombre || item.producto_nombre || item.nombre || 'Item';
                  const precio  = parseFloat(item.precio_unitario || item.precio || 0);
                  const cantMax = item.cantidad || 1;
                  const cantSel = itemsSeleccionados[item.id] || 0;
                  return (
                    <div key={item.id} onClick={() => toggleItem(item.id, cantMax)}
                      className={`p-3 rounded-xl border-2 transition-all cursor-pointer ${cantSel > 0 ? isDark ? 'border-white/20 bg-[#111]' : 'border-gray-300 bg-gray-50' : `border-transparent ${isDark ? 'bg-[#111]' : 'bg-gray-50'}`}`}>
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <p className={`font-bold text-sm mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{nombre}</p>
                          <p className={`text-xs ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>S/ {precio.toFixed(2)} × {cantSel || cantMax}</p>
                        </div>
                        <div className={`font-black text-lg ${cantSel > 0 ? isDark ? 'text-white' : 'text-gray-900' : isDark ? 'text-neutral-600' : 'text-gray-400'}`}>{cantSel}/{cantMax}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Monto a cobrar */}
            <div className={`p-4 rounded-xl mb-4 ${isDark ? 'bg-[#111]' : 'bg-gray-50'}`}>
              <div className="flex justify-between items-center">
                <p className={`text-sm font-bold ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>A cobrar ahora:</p>
                <p className={`text-2xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>S/ {montoCobro.toFixed(2)}</p>
              </div>
            </div>

            {/* Input efectivo */}
            {metodo === 'efectivo' && (
              <>
                <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-neutral-500' : 'text-gray-600'}`}>Monto recibido del cliente</label>
                <input type="number" step="0.01" value={montoIngresado} onChange={(e) => setMontoIngresado(e.target.value)} placeholder="0.00"
                  className={`w-full p-4 rounded-xl text-3xl font-black text-center mb-3 border-2 focus:outline-none ${isDark ? 'bg-[#111] border-[#1a1a1a] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`} autoFocus />
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[{ label: 'Exacto', valor: montoCobro.toFixed(2) }, { label: '20', valor: '20' }, { label: '50', valor: '50' }, { label: '100', valor: '100' }].map(({ label, valor }) => (
                    <button key={label} onClick={() => setMontoIngresado(valor)} className={`py-2.5 rounded-xl font-bold text-xs ${isDark ? 'bg-[#111] text-white border border-[#1a1a1a]' : 'bg-gray-100 text-gray-900 border border-gray-200'}`}>
                      {label === 'Exacto' ? label : `S/ ${label}`}
                    </button>
                  ))}
                </div>
                {vuelto > 0 && (
                  <div className={`p-4 rounded-xl border-2 ${isDark ? 'bg-green-500/5 border-green-500/20' : 'bg-green-50 border-green-200'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-xs font-bold mb-1 ${isDark ? 'text-green-400' : 'text-green-700'}`}>💰 Vuelto a entregar</p>
                        <p className={`text-sm ${isDark ? 'text-green-400/70' : 'text-green-600'}`}>Cliente da S/ {montoRecibido.toFixed(2)}</p>
                      </div>
                      <p className={`text-3xl font-black ${isDark ? 'text-green-400' : 'text-green-700'}`}>S/ {vuelto.toFixed(2)}</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className={`p-4 md:p-6 border-t flex-shrink-0 ${isDark ? 'border-[#1a1a1a] bg-[#0a0a0a]' : 'border-gray-200 bg-white'}`}>
            <button
              onClick={procesarCobro}
              disabled={metodo === 'efectivo' && montoCobro > 0 && (!montoIngresado || montoRecibido <= 0)}
              className="w-full py-4 rounded-xl font-bold text-white transition-all disabled:opacity-40"
              style={{ backgroundColor: colorPrimario }}
            >
              {metodo === 'efectivo'
                ? (montoRecibido > 0 && montoRecibido < montoCobro
                    ? `Registrar Parcial S/ ${montoRecibido.toFixed(2)}`
                    : `Confirmar Cobro S/ ${montoCobro.toFixed(2)}`)
                : `Continuar con ${metodo.charAt(0).toUpperCase() + metodo.slice(1)}`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════
  // RENDER: Pantalla QR / Confirmación digital
  // ══════════════════════════════════════════════
  if (paso === 'qr') {
    const qrEstatico = config[`${metodo}_qr`];
    const numero     = config[`${metodo}_numero`];

    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className={`w-full max-w-md rounded-3xl shadow-2xl border ${isDark ? 'bg-[#0a0a0a] border-[#1a1a1a]' : 'bg-white border-gray-200'}`}>

          {/* Header */}
          <div className={`p-6 border-b ${isDark ? 'border-[#1a1a1a]' : 'border-gray-100'}`}>
            <div className="flex items-center gap-3 mb-4">
              <button onClick={volverACobro} className={`p-2 rounded-xl ${isDark ? 'hover:bg-[#1a1a1a] text-neutral-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                <ArrowLeft size={20} />
              </button>
              <div className="flex-1">
                <h2 className={`text-xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {metodo === 'yape' ? 'Pago con Yape' : metodo === 'plin' ? 'Pago con Plin' : 'Pago con Tarjeta'}
                </h2>
                {(metodo === 'yape' || metodo === 'plin') && usaConfirmacionAutomatica && (
                  <p className={`text-xs ${isDark ? 'text-green-400' : 'text-green-600'}`}>Confirmación automática · WebSocket</p>
                )}
              </div>
              <button onClick={() => { volverACobro(); onClose(); }} className={`p-2 rounded-xl ${isDark ? 'hover:bg-[#1a1a1a] text-neutral-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                <X size={20} />
              </button>
            </div>
            <div className={`rounded-2xl p-4 text-center ${isDark ? 'bg-[#111]' : 'bg-gray-50'}`}>
              <p className={`text-xs font-bold mb-1 ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>Total a cobrar</p>
              <p className={`text-4xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>S/ {montoCobro.toFixed(2)}</p>
            </div>
          </div>

          <div className="p-8">

            {/* ══ YAPE / PLIN ══ */}
            {(metodo === 'yape' || metodo === 'plin') && (
              <div className="text-center">
                {qrEstatico && (
                  <>
                    <p className={`text-xs font-bold uppercase tracking-wider mb-4 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>Muestra este QR al cliente</p>
                    <div className="inline-block p-4 bg-white rounded-2xl shadow-lg mb-4">
                      <img src={qrEstatico} alt={`QR ${metodo}`} className="w-56 h-56 rounded-xl" />
                    </div>
                  </>
                )}
                {numero && (
                  <div className={`p-4 rounded-xl mb-4 ${isDark ? 'bg-[#111]' : 'bg-gray-100'}`}>
                    <p className={`text-xs mb-1 ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>Número de {metodo === 'yape' ? 'Yape' : 'Plin'}</p>
                    <p className={`text-2xl font-black font-mono ${isDark ? 'text-white' : 'text-gray-900'}`}>{numero}</p>
                  </div>
                )}

                {/* ── Modo AUTOMÁTICO ── */}
                {usaConfirmacionAutomatica ? (
                  <>
                    {notificaciones.length === 0 && (
                      <div className={`p-4 rounded-xl mb-4 flex items-center gap-3 ${isDark ? 'bg-[#111] border border-[#222]' : 'bg-gray-50 border border-gray-200'}`}>
                        <Loader2 size={18} className="animate-spin shrink-0" style={{ color: colorPrimario }} />
                        <p className={`text-sm text-left ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
                          Esperando notificación de pago en tiempo real...
                        </p>
                      </div>
                    )}
                    {notificaciones.length > 0 && (
                      <div className="mb-4 space-y-3">
                        <p className={`text-xs font-bold uppercase tracking-wider mb-3 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                          {notificaciones.length === 1 ? 'Pago detectado — confirma con un clic' : `${notificaciones.length} pagos detectados — elige el correcto`}
                        </p>
                        {notificaciones.map((n) => {
                          const esYape  = n.tipo === 'YAPE';
                          const elegida = notificacionElegida?.notificacion_id === n.notificacion_id;
                          return (
                            <button
                              key={n.notificacion_id}
                              onClick={() => confirmarNotificacion(n)}
                              disabled={!!notificacionElegida}
                              className={`w-full py-4 px-5 rounded-xl font-bold text-white flex items-center justify-between transition-all ${elegida ? 'opacity-60 cursor-wait' : 'hover:opacity-90 active:scale-[0.98]'}`}
                              style={{ backgroundColor: esYape ? '#6d28d9' : '#14b8a6' }}
                            >
                              <div className="text-left">
                                <p className="text-sm opacity-80">{n.nombre_cliente}</p>
                                {esYape && n.codigo_seguridad && (
                                  <p className="text-3xl font-black tracking-widest mt-0.5">{n.codigo_seguridad}</p>
                                )}
                                {!esYape && <p className="text-sm mt-0.5 opacity-90">Pago desde Plin</p>}
                              </div>
                              <div className="text-right shrink-0 ml-4">
                                <p className="text-xs opacity-70">S/</p>
                                <p className="text-2xl font-black">{parseFloat(n.monto).toFixed(2)}</p>
                                {elegida && <Loader2 size={16} className="animate-spin mt-1 ml-auto" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <button
                      onClick={() => registrarPago(montoCobro, 0)}
                      className={`w-full py-3 rounded-xl font-bold text-sm ${isDark ? 'bg-[#111] text-neutral-500 hover:text-neutral-300' : 'bg-gray-100 text-gray-500 hover:text-gray-700'}`}
                    >
                      Confirmar manualmente
                    </button>
                  </>
                ) : (
                  /* ── Modo MANUAL ── */
                  <>
                    <div className={`p-3 rounded-xl mb-6 ${isDark ? 'bg-orange-500/10 border border-orange-500/20' : 'bg-orange-50 border border-orange-200'}`}>
                      <p className={`text-xs ${isDark ? 'text-orange-400' : 'text-orange-700'}`}>
                        ⚠️ Verifica manualmente que el pago haya ingresado antes de confirmar
                      </p>
                    </div>
                    <button onClick={() => registrarPago(montoCobro, 0)} className="w-full py-4 rounded-xl font-bold text-white" style={{ backgroundColor: colorPrimario }}>
                      Confirmar Pago Recibido
                    </button>
                  </>
                )}
              </div>
            )}

            {/* ══ TARJETA — solo manual ══ */}
            {metodo === 'tarjeta' && (
              <div className="text-center py-4">
                <div className={`w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                  <CreditCard size={40} />
                </div>
                <h3 className={`text-lg font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Terminal POS Físico</h3>
                <p className={`text-sm mb-6 max-w-xs mx-auto ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
                  Procesa el cobro en tu terminal físico y confirma manualmente.
                </p>
                <div className={`p-4 rounded-xl mb-6 ${isDark ? 'bg-orange-500/10 border border-orange-500/20' : 'bg-orange-50 border border-orange-200'}`}>
                  <p className={`text-xs ${isDark ? 'text-orange-400' : 'text-orange-700'}`}>
                    ⚠️ Asegúrate que la transacción fue aprobada antes de confirmar
                  </p>
                </div>
                <button onClick={() => registrarPago(montoCobro, 0)} className="w-full py-4 rounded-xl font-bold text-white" style={{ backgroundColor: colorPrimario }}>
                  Confirmar Pago Aprobado
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════
  // RENDER: Pantalla de éxito
  // ══════════════════════════════════════════════
  if (paso === 'exito') {
    return (
      <>
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className={`w-full max-w-md rounded-3xl shadow-2xl border overflow-y-auto max-h-[95vh] ${isDark ? 'bg-[#0a0a0a] border-[#1a1a1a]' : 'bg-white border-gray-200'}`}>
          <div className="p-8 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500 mb-6 shadow-lg shadow-green-500/50">
              <CheckCircle2 size={40} className="text-white" strokeWidth={3} />
            </div>
            <h2 className={`text-3xl font-black mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>¡Pago Exitoso!</h2>
            <p className={`text-sm mb-8 ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>El cobro se registró correctamente</p>

            <div className={`rounded-2xl p-6 mb-6 ${isDark ? 'bg-[#111]' : 'bg-gray-50'}`}>
              <div className="flex justify-between items-center mb-3 pb-3 border-b border-dashed" style={{ borderColor: isDark ? '#222' : '#e5e7eb' }}>
                <span className={`text-sm font-bold ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>Total</span>
                <span className={`text-xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>S/ {total.toFixed(2)}</span>
              </div>
              {pagosAcumulados.map((pago, idx) => (
                <div key={idx} className={`flex justify-between items-center text-sm py-1 ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
                  <span className="capitalize">{pago.metodo}</span>
                  <span className="font-bold">S/ {pago.monto.toFixed(2)}</span>
                </div>
              ))}
              {pagosAcumulados.some(p => p.vuelto > 0) && (
                <div className={`mt-3 pt-3 border-t border-dashed flex justify-between items-center ${isDark ? 'border-neutral-800 text-green-400' : 'border-gray-300 text-green-600'}`}>
                  <span className="text-sm font-bold">Vuelto entregado</span>
                  <span className="text-lg font-black">S/ {pagosAcumulados.reduce((sum, p) => sum + (p.vuelto || 0), 0).toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Banner: comprobante emitido */}
            {resultadoComp && (
              <div className={`p-4 rounded-2xl mb-6 flex items-center gap-3 ${isDark ? 'bg-green-500/10' : 'bg-green-50'}`}>
                <CheckCircle2 size={20} className="text-green-500 flex-shrink-0" />
                <span className={`text-sm font-bold text-left ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {resultadoComp.tipo === 'factura' ? 'Factura' : 'Boleta'} {resultadoComp.serie}-{resultadoComp.numero} emitida
                </span>
              </div>
            )}

            {/* Ticket WhatsApp */}
            <div className={`p-6 rounded-2xl mb-6 ${isDark ? 'bg-[#111]' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? 'bg-green-500/10 text-green-500' : 'bg-green-50 text-green-600'}`}>
                  <MessageCircle size={20} />
                </div>
                <div className="text-left flex-1">
                  <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Ticket Digital</p>
                  <p className={`text-xs ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>Enviar por WhatsApp (opcional)</p>
                </div>
              </div>
              <div className={`flex items-center gap-2 p-3 rounded-xl border ${isDark ? 'bg-[#0a0a0a] border-[#1a1a1a]' : 'bg-white border-gray-200'}`}>
                <span className="text-lg">🇵🇪</span>
                <span className={`font-bold ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>+51</span>
                <input type="tel" value={telefonoTicket} onChange={(e) => setTelefonoTicket(e.target.value)} placeholder="999 000 000"
                  className={`flex-1 bg-transparent font-bold focus:outline-none ${isDark ? 'text-white placeholder:text-neutral-700' : 'text-gray-900 placeholder:text-gray-300'}`} />
              </div>
            </div>

            {/* DNI opcional (boleta) — solo si hay facturación y antes de emitir */}
            {facturacionEmision !== 'desactivado' && !resultadoComp && (
              <div className={`p-6 rounded-2xl mb-6 ${isDark ? 'bg-[#111]' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                    <FileText size={20} />
                  </div>
                  <div className="text-left flex-1">
                    <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>DNI del cliente</p>
                    <p className={`text-xs ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>Para la boleta (opcional)</p>
                  </div>
                </div>
                <div className={`flex items-center gap-2 p-3 rounded-xl border ${isDark ? 'bg-[#0a0a0a] border-[#1a1a1a]' : 'bg-white border-gray-200'}`}>
                  <input type="tel" maxLength={8} value={dniBoleta}
                    onChange={(e) => setDniBoleta(e.target.value.replace(/\D/g, ''))}
                    placeholder="Sin DNI = consumidor varios"
                    className={`flex-1 bg-transparent font-bold focus:outline-none ${isDark ? 'text-white placeholder:text-neutral-700' : 'text-gray-900 placeholder:text-gray-300'}`} />
                </div>
              </div>
            )}

            {/* Error de emisión */}
            {errorComp && !resultadoComp && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 text-red-500 text-sm font-bold text-left">{errorComp}</div>
            )}

            <div className="space-y-3">
              {resultadoComp ? (
                <>
                  {resultadoComp.enlace_pdf && (
                    <a href={resultadoComp.enlace_pdf} target="_blank" rel="noreferrer"
                      className="w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2" style={{ backgroundColor: colorPrimario }}>
                      <Download size={16} /> Ver / Descargar PDF
                    </a>
                  )}
                  <button onClick={() => onClose({ pagado: true })} className={`w-full py-3 rounded-xl font-bold text-sm ${isDark ? 'bg-[#111] text-neutral-400' : 'bg-gray-100 text-gray-600'}`}>
                    Cerrar
                  </button>
                </>
              ) : facturacionEmision === 'desactivado' ? (
                <>
                  <button onClick={finalizarCobro} className="w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2" style={{ backgroundColor: colorPrimario }}>
                    {telefonoTicket ? 'Enviar Ticket y Finalizar' : 'Finalizar'}
                  </button>
                  <button onClick={cerrarCobro} className={`w-full py-3 rounded-xl font-bold text-sm ${isDark ? 'bg-[#111] text-neutral-400' : 'bg-gray-100 text-gray-600'}`}>
                    Cerrar
                  </button>
                </>
              ) : (
                <>
                  <button onClick={finalizarConBoleta} disabled={emitiendoComp}
                    className="w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 disabled:opacity-60" style={{ backgroundColor: colorPrimario }}>
                    {emitiendoComp ? <Loader2 size={18} className="animate-spin" /> : <><FileText size={16} /> Finalizar y emitir boleta</>}
                  </button>
                  <button onClick={abrirFactura} disabled={emitiendoComp}
                    className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 ${isDark ? 'bg-[#111] text-neutral-400' : 'bg-gray-100 text-gray-600'}`}>
                    <Building2 size={14} /> ¿Necesita factura con RUC?
                  </button>
                  {/* "Finalizar sin comprobante": siempre en opcional; en automático solo si la emisión falló. */}
                  {(facturacionEmision === 'opcional' || !!errorComp) && (
                    <button onClick={cerrarCobro} disabled={emitiendoComp} className={`w-full py-2.5 rounded-xl font-bold text-xs ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
                      Finalizar sin comprobante
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <ModalEmitirComprobante
        isOpen={mostrarComprobante}
        onClose={() => {
          setMostrarComprobante(false);
          dispararTicket(comprobanteOrdenId || ordenId);   // comprobante emitido → PDF por WhatsApp
          onClose({ pagado: true });
        }}
        ordenId={comprobanteOrdenId || ordenId}
        isDark={isDark}
        colorPrimario={colorPrimario}
      />
      </>
    );
  }

  return null;
}