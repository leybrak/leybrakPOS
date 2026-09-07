import React, { useState, useEffect, useRef } from 'react';
import usePosStore from '../store/usePosStore';
import { useToast } from '../context/ToastContext';
import ModalCobro from '../components/modals/ModalCobro';
import ModalModificadores from '../components/modals/ModalModificadores';
import { crearOrden, actualizarOrden, agregarProductosAOrden, anularItemDeOrden } from '../api/api';
import api from '../api/api';
// Componentes
import PosHeader from '../features/POS/components/PosHeader';
import ProductGrid from '../features/POS/components/ProductGrid';
import PosFooter from '../features/POS/components/PosFooter';
import CartDrawer from '../features/POS/components/CartDrawer';
// Hooks
import { usePosData } from '../features/POS/hooks/usePosData';
import { usePosSearch } from '../features/POS/hooks/usePosSearch';
import { calcularLineasHappyHour, calcularLineasReglas, happyHourActivaAhora } from '../features/POS/hooks/usePosData';

export default function PosView({ mesaId, onVolver, esModoTerminal = false }) {
  // Al momento en que el empleado inicia sesión en la terminal de sala:
  localStorage.setItem('modo_dispositivo', 'terminal');
  const toast = useToast();
  const { estadoCaja, configuracionGlobal, carrito, agregarProducto, agregarCombo, esDueño, sedes, manejarCambioSede, restarProducto, obtenerTotalItems, restarDesdeGrid, obtenerTotalDinero, vaciarCarrito, actualizarItemCompleto, sumarUnidad } = usePosStore();  const tema = configuracionGlobal?.temaFondo || 'dark';
  const colorPrimario = configuracionGlobal?.colorPrimario || '#ff5a1f';
  const [wsListo, setWsListo] = useState(false);
  const sedeActualId = localStorage.getItem('sede_id');
  const esParaLlevar = (typeof mesaId === 'object' && mesaId?.id === 'llevar') || mesaId === 'llevar';
  const nombreLlevar = typeof mesaId === 'object' ? mesaId.cliente : 'Cliente (🛍️ Llevar)';
  const [telefonoLlevar] = useState('');

  // 1. DATA HOOK
  const { productosBase, combosPromocionalesHoy, happyHours, reglasNegocio, categoriasReales, modificadoresGlobales, ordenActiva, setOrdenActiva, cargando, cargandoOrden } = usePosData(sedeActualId, mesaId, vaciarCarrito);

  // 2. SEARCH & FILTER HOOK
  const { busqueda, setBusqueda, inputBusquedaActivo, setInputBusquedaActivo, categoriaActiva, setCategoriaActiva, aprenderSeleccion, productosFiltrados } = usePosSearch(productosBase, categoriasReales, modificadoresGlobales);

  // ESTADOS LOCALES DE LA VISTA
  const [modalCobroAbierto, setModalCobroAbierto] = useState(false);
  const [modalModsAbierto, setModalModsAbierto] = useState(false);
  const [productoParaModificar, setProductoParaModificar] = useState(null);
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [mostrarExito, setMostrarExito] = useState(false);

  const formatearSoles = (monto) => `S/ ${parseFloat(monto || 0).toFixed(2)}`;

  // ====================== WEBSOCKET LOGIC ======================
  const wsRef = useRef(null);
  const estadoMesaRef = useRef('libre'); // Soluciona el error de mutación del Linter
  const totalMesaRef = useRef(0);
  // 🛠️ Cobrar/cancelar ya avisan al backend, que transmite el estado correcto
  // (libre, total 0) a todas las pantallas ANTES de que este componente se
  // desmonte. Sin esta bandera, el mensaje de "reposo" del desmontaje (más
  // abajo) pisaba ese aviso correcto con el último estado en memoria acá
  // ('ocupada' + el monto ya cobrado) — la mesa volvía a verse ocupada en
  // el salón hasta recargar la página.
  const mesaLiberadaRef = useRef(false);

  useEffect(() => {
    if (esParaLlevar || !mesaId || !sedeActualId) return;

    let ws = null;
    let unmounted = false;
    let reconnectTimeout = null;

    const conectar = async () => {
      if (unmounted) return;

      const baseUrl = import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_URL.replace('http', 'ws');

      try {
        // Pedimos token temporal para WS
        const res = await api.get('/verificar-sesion/');
        const wsToken = res.data.ws_token;
        const wsUrl = `${baseUrl}/ws/salon/${sedeActualId}/?token=${wsToken}`;

        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setWsListo(true);
        };
        ws.onclose = () => {
          setWsListo(false);
          if (!unmounted) reconnectTimeout = setTimeout(conectar, 3000);
        };
        ws.onerror = () => ws.close();
      } catch (err) {
        console.warn('⚠️ No se pudo obtener token WS, reintentando...', err);
        if (!unmounted) reconnectTimeout = setTimeout(conectar, 3000);
      }
    };

    conectar();

    return () => {
      unmounted = true;
      clearTimeout(reconnectTimeout);
      // Restaurar estado de mesa al salir
      // 🛠️ Antes mandaba total:0 a lo bruto — este mensaje SOBREESCRIBE (no
      // fusiona) lo que ven las demás pantallas, así que salir de una mesa
      // ocupada borraba el monto a cobrar en el grid del salón hasta que
      // alguien recargaba la página. Se manda el total real (totalMesaRef).
      if (ws && ws.readyState === WebSocket.OPEN && !mesaLiberadaRef.current) {
        ws.send(JSON.stringify({ type: 'mesa_estado', mesa_id: mesaId, estado: estadoMesaRef.current, total: totalMesaRef.current }));
      }
      ws?.close();
    };
  }, [mesaId, sedeActualId, esParaLlevar]);

  const notificarEstadoMesa = (estado, total = 0) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN && !esParaLlevar) {
      ws.send(JSON.stringify({ type: 'mesa_estado', mesa_id: mesaId, estado, total }));
    }
  };

  // Notificar al Salón apenas termine de cargar la data
  // Notificar al Salón basándose en la carga de datos, el carrito y el WebSocket
  useEffect(() => {
    // 🚨 FRENO DE SEGURIDAD:
    // Esperamos a que la orden de ESTA mesa cargue Y que el WebSocket esté
    // conectado — el catálogo (cargando) puede ya estar listo desde cache
    // sin que sepamos aún si la mesa tiene una orden activa o no.
    if (cargandoOrden || !wsListo) return;
    
    if (ordenActiva) {
      // 1. La mesa ya tiene un pedido en la base de datos
      estadoMesaRef.current = 'ocupada';

      // 2. ¿Hay cosas nuevas en el carrito?
      // 🛠️ Antes: carrito vacío → 'cobrando' a ciegas, aunque nadie hubiera
      // abierto el modal de cobro (por ejemplo, justo después de enviar un
      // pedido a cocina). 'cobrando' ya se avisa aparte, atado a
      // modalCobroAbierto (ver el efecto de más abajo) — acá solo se avisa
      // si hay cosas nuevas sin enviar ('pidiendo'); si no, se deja el
      // estado real ('ocupada') salvo que el modal de cobro esté abierto.
      if (carrito.length > 0) {
        notificarEstadoMesa('pidiendo', totalMesa);
      } else if (!modalCobroAbierto) {
        notificarEstadoMesa('ocupada', totalMesa);
      }
    } else {
      // 3. Mesa libre -> El mesero entró a tomar el primer pedido
      estadoMesaRef.current = 'libre';
      notificarEstadoMesa('pidiendo', 0);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargandoOrden, ordenActiva, carrito.length, wsListo, modalCobroAbierto]); // 👈 Dependencias clave

  // ====================== CÁLCULOS ======================
  const totalOrdenActiva = ordenActiva ? ordenActiva.detalles.reduce((acc, d) => acc + parseFloat(d.precio_unitario || 0) * (d.cantidad || 1), 0) : 0;
  const totalMesa = totalOrdenActiva + obtenerTotalDinero();

  // Mantiene el total real a mano para el mensaje de "reposo" que se manda
  // al salir de la mesa (ver limpieza del WS más arriba).
  useEffect(() => { totalMesaRef.current = totalMesa; }, [totalMesa]);

  const cantItemsMesa = (ordenActiva ? ordenActiva.detalles.reduce((acc, el) => acc + el.cantidad, 0) : 0) + obtenerTotalItems();
  const hhActivas = happyHours.filter(happyHourActivaAhora);
  const todosLosItemsParaHH = [
    ...carrito,
    ...(ordenActiva?.detalles || []).map(d => ({
      cart_id: `db_${d.id}`,
      id: d.producto,
      nombre: d.producto_nombre,
      categoria: productosBase.find(p => String(p.id) === String(d.producto))?.categoria,
      cantidad: d.cantidad,
      precio_unitario_calculado: parseFloat(d.precio_unitario),
      precio: parseFloat(d.precio_unitario),
    }))
  ];
  const lineasHHFooter = calcularLineasHappyHour(hhActivas, todosLosItemsParaHH, productosBase);
  const lineasReglasFooter = calcularLineasReglas(reglasNegocio, carrito, esParaLlevar ? 'llevar' : 'salon', '');
  const totalDescuentos = lineasHHFooter.reduce((s, l) => s + (l.tipo === 'descuento' ? l.monto : 0), 0)
    + lineasReglasFooter.reduce((s, l) => s + (l.tipo === 'descuento' ? l.monto : 0), 0);
  const totalRecargos = lineasReglasFooter.reduce((s, l) => s + (l.tipo === 'recargo' ? l.monto : 0), 0);
  const totalAjustado = totalMesa - totalDescuentos + totalRecargos;
  // ====================== HANDLERS ======================
  const manejarEnviarCocina = async () => {
    if (!sedeActualId) { toast.warning('Selecciona una sede antes de enviar.'); return; }
    setProcesando(true);
    try {
      const detallesNuevos = carrito.map(item => ({
        producto: item.id, cantidad: item.cantidad,
        precio_unitario: item.precio_unitario_calculado ?? item.precio_con_modificadores ?? item.precio_base ?? item.precio ?? 0,
        notas_y_modificadores: item.notas_y_modificadores || "", notas_cocina: item.notas_cocina || "", opciones_seleccionadas: item.opciones_seleccionadas || [] 
      }));

      let response;
      if (ordenActiva) {
        response = await agregarProductosAOrden(ordenActiva.id, { detalles: detallesNuevos });
      } else {
        const payloadOrden = {
          sede: sedeActualId, mesa: esParaLlevar ? null : mesaId, tipo: esParaLlevar ? 'llevar' : 'salon',
          estado: 'preparando', total: obtenerTotalDinero(), cliente_nombre: esParaLlevar ? nombreLlevar : "", 
          cliente_telefono: esParaLlevar ? telefonoLlevar : "", detalles: detallesNuevos
        };
        response = await crearOrden(payloadOrden); 
      }
      
      if (response.data) setOrdenActiva(response.data.orden || response.data);
      
      vaciarCarrito(); 
      setCarritoAbierto(false);
      notificarEstadoMesa('ocupada', totalMesa);
      setMostrarExito(true);    
      setTimeout(() => { setMostrarExito(false); onVolver(); }, 2000);
    } catch (error) { console.error("Error:", error); } 
    finally { setProcesando(false); }
  };

  const manejarAnulacionCompleta = async () => {
    if (!ordenActiva) {
      // Si aún no se ha enviado a cocina, solo vaciamos el carrito local
      vaciarCarrito();
      return;
    }

    const confirmar = window.confirm(
      "⚠️ ¿ESTÁS SEGURO DE ANULAR TODO EL PEDIDO?\nEsta acción liberará la mesa y quedará registrada en la auditoría."
    );

    if (confirmar) {
      try {
        setProcesando(true);
        // 1. Informamos al backend para que libere la mesa y cancele la orden
        await actualizarOrden(ordenActiva.id, {
          estado: 'cancelado',
          notas_cocina: 'Anulación total desde el POS'
        });

        // 2. Limpieza total del estado local
        mesaLiberadaRef.current = true;
        vaciarCarrito();
        setCarritoAbierto(false);

        // 3. Volvemos al salón
        onVolver();
        
      } catch (error) {
        console.error("Error al anular pedido:", error);
        toast.error('No se pudo anular. Verifica la conexión.');
      } finally {
        setProcesando(false);
      }
    }
  };

  const manejarAnularItem = async (detalleId, nombrePlato) => {
    const motivo = window.prompt(`¿Motivo de anulación para "${nombrePlato}"?`);
    if (!motivo) return;
    setProcesando(true);
    try {
      const response = await anularItemDeOrden(ordenActiva.id, { detalle_id: detalleId, motivo: motivo, empleado_nombre: localStorage.getItem('empleado_nombre') || 'Admin' });
      const ordenActualizada = response.data?.orden || (response.data?.id ? response.data : null);

      if (ordenActualizada) {
        setOrdenActiva(ordenActualizada);
      } else {
        const detalleAnulado = ordenActiva.detalles.find(d => d.id === detalleId);
        const montoRestado = detalleAnulado ? parseFloat(detalleAnulado.precio_unitario || 0) * (detalleAnulado.cantidad || 1) : 0;
        setOrdenActiva(prev => ({ ...prev, total: (parseFloat(prev.total) - montoRestado).toFixed(2), detalles: prev.detalles.filter(d => d.id !== detalleId) }));
      }
    } catch (error) { toast.error('Error al anular el plato. Verifica la conexión.'); }
    finally { setProcesando(false); }
  };
  // 🧹 FUNCION PARA MATAR LA MESA ZOMBI
  const manejarCancelarOrden = async () => {
    if (!ordenActiva) return;
    
    // Pequeña confirmación por seguridad
    if (!window.confirm('¿Estás seguro de cancelar esta orden vacía y liberar la mesa?')) return;

    try {
      // 1. Le decimos a Django que cancele la orden
      await actualizarOrden(ordenActiva.id, { estado: 'cancelado' });
      
      // 2. Limpiamos todo en el frontend
      vaciarCarrito();
      setCarritoAbierto(false);
      
      // 3. Volvemos al mapa de mesas (opcional, pero buena UX)
      onVolver(); 
      
    } catch (error) {
      console.error("Error al liberar la mesa:", error);
      toast.error('No se pudo liberar la mesa. Revisa tu conexión.');
    }
  };
  const abrirModalParaNuevo = (producto) => {
    if (ordenActiva) notificarEstadoMesa('pidiendo', totalMesa); // 👈 Corregido
    setProductoParaModificar(producto);
    setModalModsAbierto(true);
  };
  
  const manejarAgregarAlCarritoDesdeModal = (itemCompleto) => {
      const existeItem = carrito.find(i => i.cart_id === itemCompleto.cart_id);
      if (existeItem) { actualizarItemCompleto(itemCompleto); } 
      else { agregarProducto(itemCompleto); }
  };
  
  useEffect(() => {
    if (esDueño && sedes?.length > 0) {
      const hoy = new Date().toLocaleDateString();
      const ultimaFecha = localStorage.getItem('pos_ultima_fecha');
      const ultimaSedeId = localStorage.getItem('sede_id');
      if (ultimaFecha !== hoy) { localStorage.setItem('pos_ultima_fecha', hoy); }
      if (!ultimaSedeId && sedes.length > 0) { manejarCambioSede(sedes[0].id); }
    }
  }, [sedes, esDueño, manejarCambioSede]);
  
  // ✨ Agrega este pequeño efecto justo arriba de tus "return"
  useEffect(() => {
    if (modalCobroAbierto && !esParaLlevar) {
      notificarEstadoMesa('cobrando', totalMesa);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalCobroAbierto]);

  return (
    <div className={`relative h-full flex flex-col overflow-hidden font-sans transition-colors duration-500 ${tema === 'dark' ? 'bg-[#0a0a0a] text-neutral-100' : 'bg-[#f4f4f5] text-gray-900'}`}>
      
      <PosHeader esModoTerminal={esModoTerminal} onVolver={onVolver} tema={tema} colorPrimario={colorPrimario} esParaLlevar={esParaLlevar} nombreLlevar={nombreLlevar} mesaId={mesaId} inputBusquedaActivo={inputBusquedaActivo} setInputBusquedaActivo={setInputBusquedaActivo} busqueda={busqueda} setBusqueda={setBusqueda} categoriaActiva={categoriaActiva} setCategoriaActiva={setCategoriaActiva} categoriasReales={categoriasReales} productosBase={productosBase} />

      {/* Aquí resolvemos el 'cargando' never used: Muestra un loader simple mientras baja data */}
      {cargando ? (
        <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${colorPrimario}40`, borderTopColor: colorPrimario }}></div>
            <p className="mt-4 font-bold text-sm tracking-widest uppercase opacity-50">Sincronizando caja...</p>
        </div>
      ) : (
        <ProductGrid 
          productosFiltrados={productosFiltrados} 
          tema={tema} 
          colorPrimario={colorPrimario} 
          carrito={carrito} 
          categoriasReales={categoriasReales} 
          ordenActiva={ordenActiva} 
          totalMesa={totalMesa} 
          busqueda={busqueda} 
          abrirModalParaNuevo={abrirModalParaNuevo} 
          aprenderSeleccion={aprenderSeleccion} 
          agregarProducto={agregarProducto} 
          restarDesdeGrid={restarDesdeGrid} 
          notificarEstadoMesa={notificarEstadoMesa} 
          formatearSoles={formatearSoles} 
          combosPromocionalesHoy={combosPromocionalesHoy}
          happyHours={happyHours}
          agregarCombo={(combo) => agregarCombo(combo, 'promo')}  // 👈
        />
      )}

      <PosFooter 
        tema={tema} 
        colorPrimario={colorPrimario} 
        cantItemsMesa={cantItemsMesa} 
        totalMesa={totalMesa}
        totalAjustado={totalAjustado}
        hayDescuentos={totalDescuentos > 0}
        setCarritoAbierto={setCarritoAbierto} 
        manejarEnviarCocina={manejarEnviarCocina} 
        procesando={procesando} 
        carrito={carrito} 
        formatearSoles={formatearSoles} 
      />

      <CartDrawer 
        carritoAbierto={carritoAbierto} 
        setCarritoAbierto={setCarritoAbierto} 
        tema={tema} colorPrimario={colorPrimario} 
        totalMesa={totalMesa} 
        cantItemsMesa={cantItemsMesa} 
        carrito={carrito} 
        vaciarStore={vaciarCarrito} 
        ordenActiva={ordenActiva} 
        manejarAnularItem={manejarAnularItem} 
        procesando={procesando} 
        abrirModalParaEditar={(item) => { setProductoParaModificar(item); setModalModsAbierto(true); }} 
        restarProducto={restarProducto} 
        sumarUnidad={sumarUnidad} 
        manejarEnviarCocina={manejarEnviarCocina} 
        setModalCobroAbierto={setModalCobroAbierto} 
        notificarEstadoMesa={notificarEstadoMesa} 
        formatearSoles={formatearSoles} 
        manejarCancelarOrden={manejarCancelarOrden}
        manejarAnulacionCompleta={manejarAnulacionCompleta}
        happyHours={happyHours}
        reglasNegocio={reglasNegocio}
        
        tipoOrden={esParaLlevar ? 'llevar' : 'salon'}
        productosBase={productosBase}
      />

      {/* MODALES */}
      {mostrarExito && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#1a1a1a] p-10 rounded-3xl flex flex-col items-center shadow-2xl scale-in-center border" style={{ borderColor: colorPrimario + '4D' }}>
             <div className="w-24 h-24 bg-green-500 rounded-full flex justify-center items-center mb-5 text-white text-5xl font-black shadow-inner shadow-green-900 shadow-xl">✓</div>
             <h2 className="text-3xl font-black text-white uppercase tracking-tight">Pedido Enviado</h2>
             <p className='text-neutral-500 mt-1 font-bold'>La cocina ya está en marcha.</p>
          </div>
        </div>
      )}

      {modalCobroAbierto && (
          <ModalCobro
            isOpen={modalCobroAbierto}
            onClose={(info) => {
              setModalCobroAbierto(false);
              if (info?.pagado) {
                // Cierre tras un cobro exitoso: limpiamos y volvemos a mesas.
                mesaLiberadaRef.current = true;
                vaciarCarrito();
                setCarritoAbierto(false);
                onVolver();
              } else {
                // Cierre/cancelación sin cobrar: la mesa sigue ocupada.
                notificarEstadoMesa('ocupada', totalMesa);
              }
            }}
            total={totalMesa}
            ordenId={ordenActiva?.id ?? null}
            carrito={ordenActiva ? ordenActiva.detalles : []}
            onCobroExitoso={async (datosCobro) => { // recibe { pagos, telefono }, devuelve { ordenId }
              try {
                const sesionCajaId = localStorage.getItem('sesion_caja_id');
                await api.post(`/ordenes/${ordenActiva.id}/cobrar_orden/`, {
                  pagos: datosCobro.pagos,
                  telefono: datosCobro.telefono, // ¡El WhatsApp para el CRM!
                  sesion_caja_id: sesionCajaId
                });
                // El cierre/navegación lo hace onClose (Finalizar/Cerrar); aquí solo
                // comiteamos y devolvemos el id para poder emitir el comprobante.
                return { ordenId: ordenActiva.id };
              } catch (error) {
                console.error(error);
                toast.error('Error al procesar el pago. Intenta de nuevo.');
                throw error;
              }
            }}
          />
      )}
      
      {estadoCaja === 'cerrado' && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-[#111] p-10 rounded-3xl border border-red-500/20 shadow-2xl max-w-sm animate-slideUp">
            <span className="text-6xl mb-4 block">🔒</span>
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Turno Cerrado</h2>
            <p className="text-neutral-400 mt-3 text-sm font-bold leading-relaxed">El administrador ha finalizado el turno. No se pueden procesar más pedidos.</p>
            <button onClick={onVolver} className="mt-8 w-full bg-[#ff5a1f] text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg hover:bg-[#e04a15] active:scale-95 transition-all">Volver al Inicio</button>
          </div>
        </div>
      )}
      
      <ModalModificadores 
        isOpen={modalModsAbierto} 
        onClose={() => setModalModsAbierto(false)} 
        producto={productoParaModificar} 
        modificadoresGlobales={modificadoresGlobales} 
        onAgregarAlCarrito={manejarAgregarAlCarritoDesdeModal}
        happyHours={happyHours}
      />
    </div>
  );
}