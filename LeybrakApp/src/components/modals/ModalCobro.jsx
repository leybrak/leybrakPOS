import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Alert, Image, Linking, Keyboard,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import EncryptedStorage from 'react-native-encrypted-storage';
import useAppStore from '../../store/useAppStore';
import api, { emitirComprobante, enviarTicketWhatsapp } from '../../api/api';
import { useYapePlinListener } from '../../hooks/useYapePlinListener';
import ModalEmitirComprobante from './ModalEmitirComprobante';

export default function ModalCobro({
  visible,
  onClose,
  total,
  ordenId = null,
  carrito = [],
  esVentaRapida = false,
  onCobroExitoso,
}) {
  const { configuracionGlobal } = useAppStore();
  const isDark = configuracionGlobal?.temaFondo !== 'light';
  const color  = configuracionGlobal?.colorPrimario || '#ff5a1f';
  const yapeNumero = configuracionGlobal?.yape_numero || '';
  const plinNumero = configuracionGlobal?.plin_numero || '';
  const confirmacionAutomatica = configuracionGlobal?.confirmacion_automatica || false;
  const yapeQr     = configuracionGlobal?.yape_qr || '';   // ← agregar
  const plinQr     = configuracionGlobal?.plin_qr || '';
  const facturacionEmision = configuracionGlobal?.facturacion_emision || 'desactivado';
  const t = {
    bg:       isDark ? '#0a0a0a' : '#ffffff',
    bg2:      isDark ? '#111111' : '#f9fafb',
    bg3:      isDark ? '#1a1a1a' : '#f3f4f6',
    border:   isDark ? '#1a1a1a' : '#e5e7eb',
    border2:  isDark ? '#222222' : '#d1d5db',
    textPrim: isDark ? '#ffffff' : '#111111',
    textSec:  isDark ? '#9ca3af' : '#6b7280',
    textMut:  isDark ? '#4b5563' : '#9ca3af',
  };

  // ─── Estados ──────────────────────────────────────────────
  const [paso, setPaso]                           = useState('cobro');
  const [tab, setTab]                             = useState('completo');
  const [metodo, setMetodo]                       = useState('efectivo');
  const [montoIngresado, setMontoIngresado]       = useState('');
  const [dividirEntre, setDividirEntre]           = useState(2);
  const [itemsSeleccionados, setItemsSeleccionados] = useState({});
  const [pagosAcumulados, setPagosAcumulados]     = useState([]);
  const [telefonoTicket, setTelefonoTicket]       = useState('');
  const [notificaciones, setNotificaciones]       = useState([]);
  const [notificacionElegida, setNotificacionElegida] = useState(null);
  const [preview, setPreview]                     = useState(null);
  const [loadingPreview, setLoadingPreview]       = useState(false);
  const [mostrarComprobante, setMostrarComprobante] = useState(false);
  const [comprobanteOrdenId, setComprobanteOrdenId] = useState(null);
  const cobroComprometidoRef = useRef(false);
  const ticketEnviadoRef = useRef(false);   // evita doble envío del ticket por WhatsApp
  const autoEmitRef = useRef(false);   // evita doble emisión en modo automático
  // Emisión inline de boleta desde la pantalla de éxito
  const [dniBoleta, setDniBoleta]         = useState('');
  const [emitiendoComp, setEmitiendoComp] = useState(false);
  const [resultadoComp, setResultadoComp] = useState(null);
  const [errorComp, setErrorComp]         = useState(null);

  const pasoRef   = useRef(paso);
  const metodoRef = useRef(metodo);
  const montoCobroRef = useRef(0);
  useEffect(() => { pasoRef.current   = paso;   }, [paso]);
  useEffect(() => { metodoRef.current = metodo; }, [metodo]);

  // ─── Reset al abrir ───────────────────────────────────────
  useEffect(() => {
    if (visible) {
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
      autoEmitRef.current = false;
      setDniBoleta('');
      setEmitiendoComp(false);
      setResultadoComp(null);
      setErrorComp(null);
    }
  }, [visible]);

  // ─── Preview descuento/recargo ────────────────────────────
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
    if (visible && ordenId) fetchPreview(metodo);
  }, [metodo, visible, ordenId, fetchPreview]);
  // Escuchar pagos Yape/Plin desde notificaciones del celular
  useYapePlinListener(
    visible && paso === 'qr' && (metodo === 'yape' || metodo === 'plin') && confirmacionAutomatica,
    (data) => {
      const montoNotif = parseFloat(data.monto);
      const montoEsp   = parseFloat(montoCobroRef.current.toFixed(2));
      if (Math.abs(montoNotif - montoEsp) < 0.01) {
        setNotificaciones(prev => {
          if (prev.some(n => n.notificacion_id === data.notificacion_id)) return prev;
          return [...prev, data];
        });
      }
    }
  );
  // ─── Cálculos ─────────────────────────────────────────────
  const totalEfectivo = preview ? preview.total : total;
  const totalPagado   = pagosAcumulados.reduce((s, p) => s + p.monto, 0);
  const restante      = totalEfectivo - totalPagado;

  const calcularMontoCobro = () => {
    if (tab === 'completo') return restante;
    if (tab === 'dividir')  return restante / dividirEntre;
    if (tab === 'items') {
      return carrito.reduce((s, item) => {
        const cant  = itemsSeleccionados[item.id] || 0;
        const precio = parseFloat(item.precio_unitario || item.precio || 0);
        return s + cant * precio;
      }, 0);
    }
    return 0;
  };

  const montoCobro    = calcularMontoCobro();
  montoCobroRef.current = montoCobro;
  const montoRecibido = parseFloat(montoIngresado) || 0;
  const vuelto        = montoRecibido > montoCobro ? montoRecibido - montoCobro : 0;

  // ─── Helpers ──────────────────────────────────────────────
  const toggleItem = (itemId, maxCant) => {
    setItemsSeleccionados(prev => {
      const current = prev[itemId] || 0;
      if (current === 0)     return { ...prev, [itemId]: 1 };
      if (current < maxCant) return { ...prev, [itemId]: current + 1 };
      return { ...prev, [itemId]: 0 };
    });
  };

  const registrarPago = (monto, vueltoCalc = 0, yaConfirmado = false) => {
    const nuevos = [...pagosAcumulados, { metodo, monto, vuelto: vueltoCalc, yaConfirmado }];
    setPagosAcumulados(nuevos);
    const nuevoTotal = totalPagado + monto;
    if (nuevoTotal >= totalEfectivo - 0.01) {
      setPaso('exito');
    } else {
      const restanteNuevo = totalEfectivo - nuevoTotal;
      Alert.alert('Pago parcial', `Registrado S/ ${monto.toFixed(2)}. Falta: S/ ${restanteNuevo.toFixed(2)}`);
      setMontoIngresado('');
      setTab('completo');
      setItemsSeleccionados({});
      setNotificaciones([]);
      setNotificacionElegida(null);
      setPaso('cobro');
    }
  };

  const confirmarNotificacion = async (notificacion) => {
    setNotificacionElegida(notificacion);
    try {
      await api.post('/yape/confirmar/', {
        notificacion_id: notificacion.notificacion_id,
        orden_id: ordenId,
      });
      setNotificaciones([]);
      registrarPago(parseFloat(notificacion.monto), 0, true);
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.error || 'No se pudo confirmar el pago.');
      setNotificacionElegida(null);
    }
  };

  const procesarCobro = () => {
    if (metodo !== 'efectivo') {
      setNotificaciones([]);
      setNotificacionElegida(null);
      setPaso('qr');
      return;
    }
    if (!montoIngresado || montoRecibido <= 0) {
      Alert.alert('Error', 'Ingresa el monto recibido del cliente.');
      return;
    }
    if (montoRecibido < montoCobro) {
      registrarPago(montoRecibido, 0);
      return;
    }
    registrarPago(montoCobro, vuelto);
  };

  // Persiste el cobro una sola vez y devuelve el ordenId real. Idempotente.
  const comprometerCobro = async () => {
    if (cobroComprometidoRef.current) return comprobanteOrdenId;
    cobroComprometidoRef.current = true;
    try {
      const r = await onCobroExitoso({ pagos: pagosAcumulados, telefono: telefonoTicket });
      const id = (r && r.ordenId) || ordenId;
      setComprobanteOrdenId(id);
      return id;
    } catch (e) {
      cobroComprometidoRef.current = false;
      throw e;
    }
  };

  // Dispara el envío del ticket por WhatsApp (una sola vez). El backend decide
  // si manda el PDF de la boleta o un recibo de texto, según exista comprobante.
  const dispararTicket = async (id) => {
    const tel = telefonoTicket.trim();
    if (!tel || ticketEnviadoRef.current) return;
    ticketEnviadoRef.current = true;
    try { await enviarTicketWhatsapp(id, tel); } catch (_) { /* fire-and-forget */ }
  };

  // "Cerrar" / "Finalizar sin comprobante": comitea y cierra, sin emitir.
  const cerrarCobro = async () => {
    let id;
    try { id = await comprometerCobro(); } catch { return; }
    await dispararTicket(id);   // sin comprobante → recibo de texto
    onClose({ pagado: true });
  };

  // "Finalizar y emitir boleta": comitea, emite la boleta inline (DNI opcional)
  // y muestra el resultado dentro del mismo modal. No abre popups.
  const finalizarConBoleta = async () => {
    if (dniBoleta && dniBoleta.length !== 8) {
      setErrorComp('El DNI debe tener 8 dígitos (o déjalo vacío).');
      return;
    }
    Keyboard.dismiss();   // cierra el teclado: si queda "abierto" se come los toques de los botones del resultado
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

  // "Factura con RUC": comitea y abre el modal completo (RUC + razón social).
  const abrirFactura = async () => {
    try { await comprometerCobro(); } catch { return; }
    setMostrarComprobante(true);
  };

  // Modo AUTOMÁTICO: al llegar a la pantalla de éxito, emite la boleta sola
  // (sin DNI). El dueño no decide nada; sólo ve el resultado y cierra.
  // 🛡️ FIX: este efecto se perdió en un commit posterior (v4 de envío de
  // tickets por WhatsApp) — sin él, "automático" se veía y se comportaba
  // igual que "opcional" (requería el tap manual en "Finalizar y emitir
  // boleta"), justo el caso que este mismo comentario ya advertía evitar.
  useEffect(() => {
    if (paso === 'exito' && facturacionEmision === 'automatico' && !autoEmitRef.current) {
      autoEmitRef.current = true;
      finalizarConBoleta();
    }
  }, [paso, facturacionEmision]);

  const metodosDisponibles = [
    { id: 'efectivo', nombre: 'Efectivo', icono: 'money',       color: '#10b981' },
    yapeNumero && { id: 'yape',    nombre: 'Yape',     icono: 'mobile',      color: '#6d28d9' },
    plinNumero && { id: 'plin',    nombre: 'Plin',     icono: 'mobile',      color: '#14b8a6' },
    { id: 'tarjeta',  nombre: 'Tarjeta',  icono: 'credit-card', color: '#3b82f6' },
  ].filter(Boolean);

  // ══════════════════════════════════════════
  // PASO: COBRO
  // ══════════════════════════════════════════
  const renderCobro = () => (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: t.bg2, borderBottomColor: t.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.titulo, { color: t.textPrim }]}>Procesar Pago</Text>
          <Text style={[s.subtitulo, { color: t.textSec }]}>
            {restante < total ? 'Pago parcial' : 'Selecciona el método de pago'}
          </Text>
        </View>
        <TouchableOpacity onPress={onClose} style={[s.closeBtn, { backgroundColor: t.bg3 }]}>
          <Icon name="times" size={16} color={t.textSec} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>

        {/* Total */}
        <View style={[s.totalBox, { backgroundColor: t.bg2 }]}>
          {totalPagado > 0 && (
            <View style={[s.progresoBox, { borderBottomColor: t.border }]}>
              <Text style={[s.progresoLabel, { color: t.textSec }]}>Progreso del pago</Text>
              <View style={[s.barBg, { backgroundColor: t.bg3 }]}>
                <View style={[s.barFill, { width: `${Math.min((totalPagado / total) * 100, 100)}%` }]} />
              </View>
              <View style={s.progresoRow}>
                <Text style={s.progresoPagado}>✓ Pagado: S/ {totalPagado.toFixed(2)}</Text>
                <Text style={[s.progresoTotal, { color: t.textSec }]}>de S/ {total.toFixed(2)}</Text>
              </View>
            </View>
          )}
          <Text style={[s.totalLabel, { color: t.textSec }]}>
            {restante < totalEfectivo ? 'Por cobrar' : 'Total'}
          </Text>
          <Text style={[s.totalMonto, { color: t.textPrim }]}>
            {loadingPreview ? 'Calculando...' : `S/ ${restante.toFixed(2)}`}
          </Text>
          {preview && (preview.descuento_total > 0 || preview.recargo_total > 0) && (
            <View style={[s.previewBox, { borderTopColor: t.border }]}>
              <View style={s.previewRow}>
                <Text style={[s.previewLabel, { color: t.textSec }]}>Subtotal</Text>
                <Text style={[s.previewValor, { color: t.textPrim }]}>S/ {preview.subtotal.toFixed(2)}</Text>
              </View>
              {preview.descuento_total > 0 && (
                <View style={s.previewRow}>
                  <Text style={[s.previewLabel, { color: '#10b981' }]}>Descuento</Text>
                  <Text style={[s.previewValor, { color: '#10b981' }]}>− S/ {preview.descuento_total.toFixed(2)}</Text>
                </View>
              )}
              {preview.recargo_total > 0 && (
                <View style={s.previewRow}>
                  <Text style={[s.previewLabel, { color: '#f59e0b' }]}>Recargo</Text>
                  <Text style={[s.previewValor, { color: '#f59e0b' }]}>+ S/ {preview.recargo_total.toFixed(2)}</Text>
                </View>
              )}
            </View>
          )}
          {pagosAcumulados.length > 0 && (
            <View style={[s.pagosAcumBox, { borderTopColor: t.border }]}>
              <Text style={[s.pagosAcumLabel, { color: t.textSec }]}>Pagos registrados:</Text>
              <View style={s.pagosAcumRow}>
                {pagosAcumulados.map((p, i) => (
                  <View key={i} style={s.pagoChip}>
                    <Text style={s.pagoChipText}>{p.metodo}: S/ {p.monto.toFixed(2)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Métodos */}
        <Text style={[s.seccionLabel, { color: t.textSec }]}>MÉTODO DE PAGO</Text>
        <View style={s.metodosRow}>
          {metodosDisponibles.map(m => (
            <TouchableOpacity
              key={m.id}
              style={[
                s.metodoBtn,
                { backgroundColor: t.bg2, borderColor: metodo === m.id ? m.color : 'transparent' },
              ]}
              onPress={() => setMetodo(m.id)}
              activeOpacity={0.8}
            >
              <Icon name={m.icono} size={20} color={metodo === m.id ? m.color : t.textMut} />
              <Text style={[s.metodoBtnText, { color: metodo === m.id ? t.textPrim : t.textSec }]}>
                {m.nombre}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tabs */}
        {!esVentaRapida && (
          <View style={[s.tabs, { backgroundColor: t.bg2 }]}>
            {[
              { id: 'completo', label: 'Todo',    icono: 'list' },
              { id: 'dividir',  label: 'Dividir', icono: 'users' },
              { id: 'items',    label: 'Items',   icono: 'tag' },
            ].map(t2 => (
              <TouchableOpacity
                key={t2.id}
                style={[s.tabBtn, tab === t2.id && { backgroundColor: t.bg3 }]}
                onPress={() => setTab(t2.id)}
                activeOpacity={0.8}
              >
                <Icon name={t2.icono} size={12} color={tab === t2.id ? t.textPrim : t.textMut} style={{ marginRight: 4 }} />
                <Text style={[s.tabBtnText, { color: tab === t2.id ? t.textPrim : t.textSec }]}>{t2.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Tab dividir */}
        {!esVentaRapida && tab === 'dividir' && (
          <View style={[s.dividirBox, { backgroundColor: t.bg2 }]}>
            <Text style={[s.dividirLabel, { color: t.textSec }]}>Dividir cuenta entre:</Text>
            <View style={s.dividirControles}>
              <TouchableOpacity
                style={[s.dividirBtn, { backgroundColor: t.bg3 }]}
                onPress={() => setDividirEntre(Math.max(2, dividirEntre - 1))}
              >
                <Text style={[s.dividirBtnText, { color: t.textPrim }]}>-</Text>
              </TouchableOpacity>
              <View style={{ alignItems: 'center' }}>
                <Text style={[s.dividirNum, { color: t.textPrim }]}>{dividirEntre}</Text>
                <Text style={[s.dividirPersonas, { color: t.textSec }]}>personas</Text>
              </View>
              <TouchableOpacity
                style={[s.dividirBtn, { backgroundColor: t.bg3 }]}
                onPress={() => setDividirEntre(dividirEntre + 1)}
              >
                <Text style={[s.dividirBtnText, { color: t.textPrim }]}>+</Text>
              </TouchableOpacity>
            </View>
            <View style={[s.dividirResultado, { backgroundColor: t.bg }]}>
              <Text style={[s.dividirResultadoLabel, { color: t.textSec }]}>Cada persona paga:</Text>
              <Text style={[s.dividirResultadoMonto, { color: t.textPrim }]}>S/ {(restante / dividirEntre).toFixed(2)}</Text>
            </View>
          </View>
        )}

        {/* Tab items */}
        {!esVentaRapida && tab === 'items' && (
          <View style={{ marginBottom: 12 }}>
            {carrito.map(item => {
              const nombre  = item.producto_nombre || item.nombre || 'Item';
              const precio  = parseFloat(item.precio_unitario || item.precio || 0);
              const cantMax = item.cantidad || 1;
              const cantSel = itemsSeleccionados[item.id] || 0;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[s.itemCard, { backgroundColor: t.bg2, borderColor: cantSel > 0 ? color : 'transparent' }]}
                  onPress={() => toggleItem(item.id, cantMax)}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[s.itemNombre, { color: t.textPrim }]}>{nombre}</Text>
                    <Text style={[s.itemPrecio, { color: t.textSec }]}>S/ {precio.toFixed(2)} × {cantSel || cantMax}</Text>
                  </View>
                  <Text style={[s.itemCant, { color: cantSel > 0 ? t.textPrim : t.textMut }]}>{cantSel}/{cantMax}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Monto a cobrar */}
        <View style={[s.montoCobroBox, { backgroundColor: t.bg2 }]}>
          <Text style={[s.montoCobroLabel, { color: t.textSec }]}>A cobrar ahora:</Text>
          <Text style={[s.montoCobroMonto, { color: t.textPrim }]}>S/ {montoCobro.toFixed(2)}</Text>
        </View>

        {/* Input efectivo */}
        {metodo === 'efectivo' && (
          <View>
            <Text style={[s.seccionLabel, { color: t.textSec }]}>MONTO RECIBIDO DEL CLIENTE</Text>
            <TextInput
              style={[s.montoInput, { backgroundColor: t.bg2, borderColor: t.border2, color: t.textPrim }]}
              value={montoIngresado}
              onChangeText={setMontoIngresado}
              placeholder="0.00"
              placeholderTextColor={t.textMut}
              keyboardType="decimal-pad"
              autoFocus
            />
            <View style={s.quickBtns}>
              {[
                { label: 'Exacto', valor: montoCobro.toFixed(2) },
                { label: 'S/ 20',  valor: '20' },
                { label: 'S/ 50',  valor: '50' },
                { label: 'S/ 100', valor: '100' },
              ].map(({ label, valor }) => (
                <TouchableOpacity
                  key={label}
                  style={[s.quickBtn, { backgroundColor: t.bg2, borderColor: t.border }]}
                  onPress={() => setMontoIngresado(valor)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.quickBtnText, { color: t.textPrim }]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {vuelto > 0 && (
              <View style={s.vueltoBox}>
                <View style={{ flex: 1 }}>
                  <Text style={s.vueltoLabel}>💰 Vuelto a entregar</Text>
                  <Text style={s.vueltoSub}>Cliente da S/ {montoRecibido.toFixed(2)}</Text>
                </View>
                <Text style={s.vueltoMonto}>S/ {vuelto.toFixed(2)}</Text>
              </View>
            )}
          </View>
        )}

      </ScrollView>

      {/* Footer */}
      <View style={[s.footer, { backgroundColor: t.bg, borderTopColor: t.border }]}>
        <TouchableOpacity
          style={[s.btnProcesar, { backgroundColor: color },
            metodo === 'efectivo' && montoCobro > 0 && (!montoIngresado || montoRecibido <= 0) && { opacity: 0.4 }
          ]}
          onPress={procesarCobro}
          disabled={metodo === 'efectivo' && montoCobro > 0 && (!montoIngresado || montoRecibido <= 0)}
          activeOpacity={0.8}
        >
          <Text style={s.btnProcesarText}>
            {metodo === 'efectivo'
              ? (montoRecibido > 0 && montoRecibido < montoCobro
                  ? `Registrar Parcial S/ ${montoRecibido.toFixed(2)}`
                  : `Confirmar S/ ${montoCobro.toFixed(2)}`)
              : `Continuar con ${metodo.charAt(0).toUpperCase() + metodo.slice(1)}`
            }
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ══════════════════════════════════════════
  // PASO: QR / CONFIRMACIÓN DIGITAL
  // ══════════════════════════════════════════
  const renderQR = () => (
    <View style={{ flex: 1 }}>
      <View style={[s.header, { backgroundColor: t.bg2, borderBottomColor: t.border }]}>
        <TouchableOpacity onPress={() => setPaso('cobro')} style={[s.closeBtn, { backgroundColor: t.bg3 }]}>
          <Icon name="arrow-left" size={16} color={t.textSec} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[s.titulo, { color: t.textPrim }]}>
            {metodo === 'yape' ? 'Pago con Yape' : metodo === 'plin' ? 'Pago con Plin' : 'Pago con Tarjeta'}
          </Text>
          {(metodo === 'yape' || metodo === 'plin') && confirmacionAutomatica && (
            <Text style={{ fontSize: 11, color: '#10b981' }}>Confirmación automática activa</Text>
          )}
        </View>
        <TouchableOpacity onPress={onClose} style={[s.closeBtn, { backgroundColor: t.bg3 }]}>
          <Icon name="times" size={16} color={t.textSec} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body}>

        {/* Total */}
        <View style={[s.totalBox, { backgroundColor: t.bg2, marginBottom: 20 }]}>
          <Text style={[s.totalLabel, { color: t.textSec }]}>Total a cobrar</Text>
          <Text style={[s.totalMonto, { color: t.textPrim }]}>S/ {montoCobro.toFixed(2)}</Text>
        </View>

        {/* Yape / Plin */}
        {(metodo === 'yape' || metodo === 'plin') && (
          <View style={{ alignItems: 'center' }}>
            {/* QR */}
            {(metodo === 'yape' ? yapeQr : plinQr) ? (
              <View style={s.qrContainer}>
                <Text style={[s.qrLabel, { color: t.textSec }]}>Muestra este QR al cliente</Text>
                <View style={s.qrBox}>
                  <Image
                    source={{ uri: metodo === 'yape' ? yapeQr : plinQr }}
                    style={s.qrImage}
                    resizeMode="contain"
                  />
                </View>
              </View>
            ) : null}

            {/* Número */}
            {(metodo === 'yape' ? yapeNumero : plinNumero) ? (
              <View style={[s.numeroBox, { backgroundColor: t.bg2 }]}>
                <Text style={[s.numeroLabel, { color: t.textSec }]}>
                  Número de {metodo === 'yape' ? 'Yape' : 'Plin'}
                </Text>
                <Text style={[s.numeroValor, { color: t.textPrim }]}>
                  {metodo === 'yape' ? yapeNumero : plinNumero}
                </Text>
              </View>
            ) : null}

            {/* Modo automático */}
            {confirmacionAutomatica ? (
              <View style={{ alignSelf: 'stretch' }}>
                {notificaciones.length === 0 && (
                  <View style={[s.esperandoBox, { backgroundColor: t.bg2, borderColor: t.border }]}>
                    <ActivityIndicator size="small" color={color} style={{ marginRight: 10 }} />
                    <Text style={[s.esperandoText, { color: t.textSec }]}>
                      Esperando notificación de pago...
                    </Text>
                  </View>
                )}
                {notificaciones.map(n => {
                  const esYape  = n.tipo === 'YAPE';
                  const elegida = notificacionElegida?.notificacion_id === n.notificacion_id;
                  return (
                    <TouchableOpacity
                      key={n.notificacion_id}
                      style={[s.notifBtn, { backgroundColor: esYape ? '#6d28d9' : '#14b8a6' }, elegida && { opacity: 0.6 }]}
                      onPress={() => confirmarNotificacion(n)}
                      disabled={!!notificacionElegida}
                      activeOpacity={0.8}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.notifNombre}>{n.nombre_cliente}</Text>
                        {esYape && n.codigo_seguridad && (
                          <Text style={s.notifCodigo}>{n.codigo_seguridad}</Text>
                        )}
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={s.notifMontoLabel}>S/</Text>
                        <Text style={s.notifMonto}>{parseFloat(n.monto).toFixed(2)}</Text>
                        {elegida && <ActivityIndicator size="small" color="#fff" style={{ marginTop: 4 }} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={[s.btnManual, { backgroundColor: t.bg2 }]}
                  onPress={() => registrarPago(montoCobro, 0)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.btnManualText, { color: t.textSec }]}>Confirmar manualmente</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ alignSelf: 'stretch' }}>
                <View style={s.alertaBox}>
                  <Text style={s.alertaText}>⚠️ Verifica manualmente que el pago haya ingresado</Text>
                </View>
                <TouchableOpacity
                  style={[s.btnProcesar, { backgroundColor: color }]}
                  onPress={() => registrarPago(montoCobro, 0)}
                  activeOpacity={0.8}
                >
                  <Text style={s.btnProcesarText}>Confirmar Pago Recibido</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Tarjeta */}
        {metodo === 'tarjeta' && (
          <View style={{ alignItems: 'center' }}>
            <View style={[s.tarjetaIconBox, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
              <Icon name="credit-card" size={40} color="#3b82f6" />
            </View>
            <Text style={[s.tarjetaTitulo, { color: t.textPrim }]}>Terminal POS Físico</Text>
            <Text style={[s.tarjetaDesc, { color: t.textSec }]}>
              Procesa el cobro en tu terminal físico y confirma manualmente.
            </Text>
            <View style={[s.alertaBox, { marginBottom: 16 }]}>
              <Text style={s.alertaText}>⚠️ Asegúrate que la transacción fue aprobada</Text>
            </View>
            <TouchableOpacity
              style={[s.btnProcesar, { backgroundColor: color }]}
              onPress={() => registrarPago(montoCobro, 0)}
              activeOpacity={0.8}
            >
              <Text style={s.btnProcesarText}>Confirmar Pago Aprobado</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </View>
  );

  // ══════════════════════════════════════════
  // PASO: ÉXITO
  // ══════════════════════════════════════════
  const renderExito = () => (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        {/* Cabecera centrada */}
        <View style={{ alignItems: 'center' }}>
          <View style={s.exitoCheck}>
            <Icon name="check" size={40} color="#fff" />
          </View>
          <Text style={[s.exitoTitulo, { color: t.textPrim }]}>¡Pago Exitoso!</Text>
          <Text style={[s.exitoSub, { color: t.textSec }]}>El cobro se registró correctamente</Text>
        </View>

        {/* Resumen */}
        <View style={[s.resumenBox, { backgroundColor: t.bg2, borderColor: t.border }]}>
          <View style={[s.resumenRow, { borderBottomColor: t.border }]}>
            <Text style={[s.resumenLabel, { color: t.textSec }]}>Total</Text>
            <Text style={[s.resumenMonto, { color: t.textPrim }]}>S/ {total.toFixed(2)}</Text>
          </View>
          {pagosAcumulados.map((p, i) => (
            <View key={i} style={s.resumenRow2}>
              <Text style={[s.resumenLabel, { color: t.textSec, textTransform: 'capitalize' }]}>{p.metodo}</Text>
              <Text style={[{ fontSize: 14, fontWeight: '700', color: t.textPrim }]}>S/ {p.monto.toFixed(2)}</Text>
            </View>
          ))}
          {pagosAcumulados.some(p => p.vuelto > 0) && (
            <View style={[s.resumenRow2, { borderTopWidth: 1, borderTopColor: t.border, marginTop: 8, paddingTop: 8 }]}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#10b981' }}>Vuelto entregado</Text>
              <Text style={{ fontSize: 16, fontWeight: '900', color: '#10b981' }}>
                S/ {pagosAcumulados.reduce((s, p) => s + (p.vuelto || 0), 0).toFixed(2)}
              </Text>
            </View>
          )}
        </View>

        {/* Ticket WhatsApp */}
        <View style={[s.ticketBox, { backgroundColor: t.bg2 }]}>
          <View style={s.ticketHeader}>
            <View style={[s.ticketIcono, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
              <Icon name="whatsapp" size={20} color="#10b981" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[s.ticketTitulo, { color: t.textPrim }]}>Ticket Digital</Text>
              <Text style={[s.ticketSub, { color: t.textSec }]}>Enviar por WhatsApp (opcional)</Text>
            </View>
          </View>
          <View style={[s.ticketInput, { backgroundColor: t.bg, borderColor: t.border }]}>
            <Text style={[s.ticketPrefijo, { color: t.textSec }]}>🇵🇪 +51</Text>
            <TextInput
              style={[s.ticketInputField, { color: t.textPrim }]}
              value={telefonoTicket}
              onChangeText={setTelefonoTicket}
              placeholder="999 000 000"
              placeholderTextColor={t.textMut}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        {/* DNI opcional (boleta) — solo opcional/automatico y antes de emitir */}
        {facturacionEmision !== 'desactivado' && !resultadoComp && (
          <View style={[s.ticketBox, { backgroundColor: t.bg2 }]}>
            <View style={s.ticketHeader}>
              <View style={[s.ticketIcono, { backgroundColor: `${color}1a` }]}>
                <Icon name="id-card-o" size={18} color={color} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[s.ticketTitulo, { color: t.textPrim }]}>DNI del cliente</Text>
                <Text style={[s.ticketSub, { color: t.textSec }]}>Para la boleta (opcional)</Text>
              </View>
            </View>
            <View style={[s.ticketInput, { backgroundColor: t.bg, borderColor: t.border }]}>
              <Icon name="user" size={14} color={t.textSec} />
              <TextInput
                style={[s.ticketInputField, { color: t.textPrim }]}
                value={dniBoleta}
                onChangeText={(v) => { setDniBoleta(v.replace(/[^0-9]/g, '').slice(0, 8)); setErrorComp(null); }}
                placeholder="12345678"
                placeholderTextColor={t.textMut}
                keyboardType="number-pad"
              />
            </View>
          </View>
        )}

        {/* Banner: boleta ya emitida */}
        {resultadoComp && (
          <View style={[s.ticketBox, { backgroundColor: t.bg2 }]}>
            <View style={s.compResultHead}>
              <Icon name="check-circle" size={18} color="#10b981" />
              <Text style={[s.compResultTitle, { color: t.textPrim }]}>
                {resultadoComp.tipo === 'factura' ? 'Factura' : 'Boleta'} {resultadoComp.serie}-{resultadoComp.numero} emitida
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── FOOTER (fuera del ScrollView) — botones con hitbox correcto ──
          Replica el patrón de renderCobro: dentro de un ScrollView el área
          táctil de los botones se encogía al tamaño del texto; en un footer no. */}
      <View style={[s.footer, { backgroundColor: t.bg, borderTopColor: t.border }]}>
        {!!errorComp && !resultadoComp && (
          <View style={[s.compError, { marginTop: 0, marginBottom: 12 }]}>
            <Icon name="exclamation-triangle" size={13} color="#ef4444" />
            <Text style={s.compErrorText}>{errorComp}</Text>
          </View>
        )}

        {resultadoComp ? (
          <>
            {!!resultadoComp.enlace_pdf && (
              <TouchableOpacity
                key="comp-pdf"
                style={[s.btnProcesar, { backgroundColor: color, marginBottom: 10 }]}
                onPress={() => Linking.openURL(resultadoComp.enlace_pdf)}
                activeOpacity={0.85}
              >
                <Icon name="download" size={15} color="#fff" style={{ marginRight: 8 }} />
                <Text style={s.btnProcesarText}>Ver / Descargar PDF</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              key="comp-cerrar"
              style={[s.btnManual, { backgroundColor: t.bg2 }]}
              onPress={() => onClose({ pagado: true })}
              activeOpacity={0.85}
            >
              <Text style={[s.btnManualText, { color: t.textSec }]}>Cerrar</Text>
            </TouchableOpacity>
          </>

        ) : facturacionEmision === 'desactivado' ? (
          <>
            <TouchableOpacity
              style={[s.btnProcesar, { backgroundColor: color, marginBottom: 10 }]}
              onPress={cerrarCobro}
              activeOpacity={0.8}
            >
              <Text style={s.btnProcesarText}>
                {telefonoTicket ? 'Enviar Ticket y Finalizar' : 'Finalizar'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btnManual, { backgroundColor: t.bg2 }]}
              onPress={cerrarCobro}
              activeOpacity={0.8}
            >
              <Text style={[s.btnManualText, { color: t.textSec }]}>Cerrar</Text>
            </TouchableOpacity>
          </>

        ) : (
          <>
            <TouchableOpacity
              key="emitir-boleta"
              style={[s.btnProcesar, { backgroundColor: color, marginBottom: 10 }, emitiendoComp && { opacity: 0.6 }]}
              onPress={finalizarConBoleta}
              disabled={emitiendoComp}
              activeOpacity={0.8}
            >
              {emitiendoComp
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnProcesarText}>Finalizar y emitir boleta</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              key="factura-ruc"
              style={[s.btnManual, { backgroundColor: t.bg2, marginBottom: facturacionEmision === 'opcional' ? 10 : 0 }]}
              onPress={abrirFactura}
              disabled={emitiendoComp}
              activeOpacity={0.8}
            >
              <Icon name="building" size={13} color={t.textSec} style={{ marginRight: 8 }} />
              <Text style={[s.btnManualText, { color: t.textSec }]}>¿Necesita factura con RUC?</Text>
            </TouchableOpacity>

            {/* "Finalizar sin comprobante": siempre en opcional; en automático
                solo como escape si la emisión falló (SUNAT/Nubefact caído). */}
            {(facturacionEmision === 'opcional' || !!errorComp) && (
              <TouchableOpacity
                style={[s.btnManual, { backgroundColor: 'transparent' }]}
                onPress={cerrarCobro}
                disabled={emitiendoComp}
                activeOpacity={0.8}
              >
                <Text style={[s.btnManualText, { color: t.textMut }]}>Finalizar sin comprobante</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </View>
  );

  // En la pantalla de éxito, cerrar tocando fuera/back debe comitear el cobro
  // (igual que el botón "Cerrar"); fuera de éxito, cierre normal.
  const cierreSeguro = () => { if (paso === 'exito') { cerrarCobro(); } else { onClose(); } };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={cierreSeguro}>
      {/* SafeAreaProvider local: el Modal es una ventana aparte en Android, así que
          necesita su propio provider para medir los insets. Con edge-to-edge (RN 0.85)
          la hoja se dibuja bajo la barra de navegación; el inset inferior evita que el
          último botón ("Cerrar") quede debajo de la barra de gestos y pierda los toques. */}
      <SafeAreaProvider>
        <View style={s.overlay}>
          <TouchableOpacity style={{ flex: 0.1 }} onPress={cierreSeguro} />
          <SafeAreaView edges={['bottom']} style={[s.container, { backgroundColor: t.bg, borderTopColor: t.border }]}>
            <View style={s.handle}>
              <View style={[s.handleBar, { backgroundColor: t.border2 }]} />
            </View>
            {paso === 'cobro' && renderCobro()}
            {paso === 'qr'    && renderQR()}
            {paso === 'exito' && renderExito()}
          </SafeAreaView>
        </View>
      </SafeAreaProvider>

      <ModalEmitirComprobante
        visible={mostrarComprobante}
        onClose={() => {
          setMostrarComprobante(false);
          dispararTicket(comprobanteOrdenId || ordenId);   // factura emitida → PDF por WhatsApp
          onClose({ pagado: true });
        }}
        ordenId={comprobanteOrdenId || ordenId}
        isDark={isDark}
        color={color}
      />
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  container:     { height: '92%', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, overflow: 'hidden' },
  handle:        { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  handleBar:     { width: 48, height: 4, borderRadius: 2 },

  header:        { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  titulo:        { fontSize: 18, fontWeight: '900' },
  subtitulo:     { fontSize: 12, marginTop: 2 },
  closeBtn:      { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  body:          { padding: 16, paddingBottom: 24 },

  totalBox:      { borderRadius: 16, padding: 16, marginBottom: 16, alignItems: 'center' },
  totalLabel:    { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4 },
  totalMonto:    { fontSize: 48, fontWeight: '900', letterSpacing: -1 },

  progresoBox:   { alignSelf: 'stretch', borderBottomWidth: 1, paddingBottom: 12, marginBottom: 12 },
  progresoLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  barBg:         { alignSelf: 'stretch', height: 6, borderRadius: 3, marginBottom: 6 },
  barFill:       { height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  progresoRow:   { flexDirection: 'row', justifyContent: 'space-between' },
  progresoPagado:{ fontSize: 11, fontWeight: '700', color: '#10b981' },
  progresoTotal: { fontSize: 11, fontWeight: '600' },

  previewBox:    { alignSelf: 'stretch', borderTopWidth: 1, paddingTop: 12, marginTop: 8, gap: 4 },
  previewRow:    { flexDirection: 'row', justifyContent: 'space-between' },
  previewLabel:  { fontSize: 12, fontWeight: '600' },
  previewValor:  { fontSize: 12, fontWeight: '700' },

  pagosAcumBox:  { alignSelf: 'stretch', borderTopWidth: 1, paddingTop: 12, marginTop: 8 },
  pagosAcumLabel:{ fontSize: 10, fontWeight: '700', marginBottom: 8 },
  pagosAcumRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pagoChip:      { backgroundColor: 'rgba(16,185,129,0.1)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  pagoChipText:  { fontSize: 11, fontWeight: '700', color: '#10b981' },

  seccionLabel:  { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 10 },
  metodosRow:    { flexDirection: 'row', gap: 8, marginBottom: 16 },
  metodoBtn:     { flex: 1, padding: 12, borderRadius: 14, borderWidth: 2, alignItems: 'center', gap: 6 },
  metodoBtnText: { fontSize: 11, fontWeight: '700' },

  tabs:          { flexDirection: 'row', borderRadius: 12, padding: 4, marginBottom: 12 },
  tabBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 8 },
  tabBtnText:    { fontSize: 11, fontWeight: '700' },

  dividirBox:    { borderRadius: 14, padding: 16, marginBottom: 12 },
  dividirLabel:  { fontSize: 12, fontWeight: '600', marginBottom: 12 },
  dividirControles: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  dividirBtn:    { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dividirBtnText:{ fontSize: 24, fontWeight: '900' },
  dividirNum:    { fontSize: 36, fontWeight: '900' },
  dividirPersonas: { fontSize: 11 },
  dividirResultado: { borderRadius: 10, padding: 12, alignItems: 'center' },
  dividirResultadoLabel: { fontSize: 11, marginBottom: 4 },
  dividirResultadoMonto: { fontSize: 24, fontWeight: '900' },

  itemCard:      { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 2, padding: 12, marginBottom: 8 },
  itemNombre:    { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  itemPrecio:    { fontSize: 12, fontWeight: '500' },
  itemCant:      { fontSize: 16, fontWeight: '900' },

  montoCobroBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, padding: 16, marginBottom: 16 },
  montoCobroLabel: { fontSize: 14, fontWeight: '600' },
  montoCobroMonto: { fontSize: 24, fontWeight: '900' },

  montoInput:    { borderRadius: 14, borderWidth: 1.5, padding: 16, fontSize: 36, fontWeight: '900', textAlign: 'center', marginBottom: 12 },
  quickBtns:     { flexDirection: 'row', gap: 8, marginBottom: 12 },
  quickBtn:      { flex: 1, borderRadius: 10, borderWidth: 1, paddingVertical: 10, alignItems: 'center' },
  quickBtnText:  { fontSize: 12, fontWeight: '700' },

  vueltoBox:     { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 14, backgroundColor: 'rgba(16,185,129,0.05)', borderWidth: 2, borderColor: 'rgba(16,185,129,0.2)' },
  vueltoLabel:   { fontSize: 13, fontWeight: '700', color: '#10b981', marginBottom: 2 },
  vueltoSub:     { fontSize: 11, color: 'rgba(16,185,129,0.7)' },
  vueltoMonto:   { fontSize: 32, fontWeight: '900', color: '#10b981' },

  footer:        { padding: 16, borderTopWidth: 1 },
  btnProcesar:   { borderRadius: 16, paddingVertical: 18, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', alignSelf: 'stretch' },
  btnProcesarText: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },

  numeroBox:     { borderRadius: 14, padding: 16, marginBottom: 16, alignSelf: 'stretch', alignItems: 'center' },
  numeroLabel:   { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  numeroValor:   { fontSize: 28, fontWeight: '900', fontVariant: ['tabular-nums'] },

  esperandoBox:  { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 12 },
  esperandoText: { flex: 1, fontSize: 13, fontWeight: '500' },

  notifBtn:      { flexDirection: 'row', borderRadius: 16, padding: 16, marginBottom: 10, alignSelf: 'stretch' },
  notifNombre:   { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },
  notifCodigo:   { color: '#fff', fontSize: 32, fontWeight: '900', letterSpacing: 4, marginTop: 2 },
  notifMontoLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10 },
  notifMonto:    { color: '#fff', fontSize: 28, fontWeight: '900' },

  btnManual:     { borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', marginTop: 8, alignSelf: 'stretch' },
  btnManualText: { fontSize: 13, fontWeight: '600' },

  // Emisión inline de boleta en la pantalla de éxito
  dniBox:    { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12 },
  dniLabel:  { fontSize: 11, fontWeight: '700', marginBottom: 8 },
  dniInput:  { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, fontWeight: '700', letterSpacing: 2 },
  compError: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 10, padding: 10, marginBottom: 10 },
  compErrorText: { color: '#f87171', fontSize: 12, flex: 1 },
  compResult:      { borderRadius: 16, borderWidth: 1, padding: 16, marginTop: 4 },
  compResultHead:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  compResultTitle: { fontSize: 14, fontWeight: '800', flex: 1 },

  alertaBox:     { backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)', borderRadius: 12, padding: 12, alignSelf: 'stretch', marginBottom: 16 },
  alertaText:    { color: '#f59e0b', fontSize: 12, fontWeight: '600', textAlign: 'center' },

  tarjetaIconBox:{ width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  tarjetaTitulo: { fontSize: 18, fontWeight: '900', marginBottom: 8 },
  tarjetaDesc:   { fontSize: 13, textAlign: 'center', marginBottom: 16 },

  exitoCheck:    { width: 80, height: 80, borderRadius: 40, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center', marginBottom: 16, elevation: 10 },
  exitoTitulo:   { fontSize: 28, fontWeight: '900', marginBottom: 4 },
  exitoSub:      { fontSize: 13, marginBottom: 24, textAlign: 'center' },

  resumenBox:    { alignSelf: 'stretch', borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16 },
  resumenRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 12, borderBottomWidth: 1, borderStyle: 'dashed', marginBottom: 8 },
  resumenRow2:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  resumenLabel:  { fontSize: 13, fontWeight: '600' },
  resumenMonto:  { fontSize: 20, fontWeight: '900' },

  ticketBox:     { alignSelf: 'stretch', borderRadius: 16, padding: 16, marginBottom: 16 },
  ticketHeader:  { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  ticketIcono:   { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  ticketTitulo:  { fontSize: 14, fontWeight: '700' },
  ticketSub:     { fontSize: 11 },
  ticketInput:   { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, padding: 12, gap: 8 },
  ticketPrefijo: { fontSize: 14, fontWeight: '700' },
  ticketInputField: { flex: 1, fontSize: 16, fontWeight: '600' },

  qrContainer: { alignItems: 'center', marginBottom: 16 },
  qrLabel:     { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 12, textTransform: 'uppercase' },
  qrBox:       { backgroundColor: '#fff', padding: 16, borderRadius: 20 },
  qrImage:     { width: 220, height: 220, borderRadius: 12 },
});