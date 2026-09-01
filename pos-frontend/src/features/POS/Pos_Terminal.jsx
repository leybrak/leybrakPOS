import React, { useState,useEffect } from 'react';
import { crearOrden, actualizarMesa, actualizarOrden, crearPago, registrarMovimientoCaja, validarPinEmpleado } from '../../api/api';
import { abrirCajaBD } from '../../api/api';
import usePosStore from '../../store/usePosStore';
import api from '../../api/api';
// Modales y Drawers
import ModalCobro from '../../components/modals/ModalCobro';
import ModalCierreCaja from '../../components/modals/ModalCierreCaja';
import DrawerVentaRapida from './Pos_DrawerVentaRapida';
import ModalMovimientoCaja from '../../components/modals/ModalMovimientoCaja';
import ModalAlertaBot from '../../components/modals/ModalAlertaBot';

// Componentes Refactorizados
import TerminalHeader from './components/TerminalHeader';
import TerminalMesasGrid from './components/TerminalMesasGrid';
import TerminalLlevarView from './components/TerminalLlevarView';
import TerminalSidebar from './components/TerminalSidebar';

// Hooks Refactorizados
import { useTerminalData } from './hooks/useTerminalData';
import { useTerminalWS } from './hooks/useTerminalWS';

export default function PosTerminal({ onIrAErp }) {
  // =========================================================
  // ✨ HELPER DE SEGURIDAD (Desencripta el JWT)
  // =========================================================
  
  const { estadoCaja, configuracionGlobal, setConfiguracionGlobal } = usePosStore();
  const tema = configuracionGlobal?.temaFondo || 'dark';
  const colorPrimario = configuracionGlobal?.colorPrimario || '#ff5a1f';

  // ── Estados Locales ──────────────────────────────────────────────────────────
  const [sedeActualId, setSedeActualId] = useState(localStorage.getItem('sede_id') || '');
  // 🔒 EXTRACCIÓN SEGURA DEL ROL DESDE EL TOKEN
  const rolUsuario = localStorage.getItem('usuario_rol') || 'Empleado'; 
  const esDueño = ['dueño', 'admin'].includes(rolUsuario.trim().toLowerCase());
  const cajaAbierta = estadoCaja === 'abierto' || estadoCaja?.estado === 'abierto';

  const [modalAperturaAbierto, setModalAperturaAbierto] = useState(false);
  const [fondoCaja, setFondoCaja] = useState('');
  const [abriendoCaja, setAbriendoCaja] = useState(false);

  const rolLimpio = (rolUsuario || '').toLowerCase().trim();
  const puedeAbrirCaja = ['cajero', 'administrador', 'admin', 'dueño'].includes(rolLimpio);
  const [triggerRecarga, setTriggerRecarga] = useState(false);
  const [mostrarPuertaMovil, setMostrarPuertaMovil] = useState(false);
  const [modoUnir, setModoUnir] = useState(false);
  const [mesaPrincipal, setMesaPrincipal] = useState(null);
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null);

  const [modalClienteAbierto, setModalClienteAbierto] = useState(false);
  const [nombreCliente, setNombreCliente] = useState('');
  const [telefonoCliente, setTelefonoCliente] = useState('');
  const [modalCierreAbierto, setModalCierreAbierto] = useState(false);
  const [drawerVentaRapidaAbierto, setDrawerVentaRapidaAbierto] = useState(false);
  const [modalMovimientosAbierto, setModalMovimientosAbierto] = useState(false);
  const [ordenACobrar, setOrdenACobrar] = useState(null);
  const [solicitudesBot, setSolicitudesBot] = useState([]);
  const { setEstadoCaja } = usePosStore();

  // ── HOOKS DE DATOS Y WEBSOCKETS ─────────────────────────────────────────────
  const { 
    sedes, mesas, setMesas, ordenesLlevar, setOrdenesLlevar, 
    todasLasOrdenesActivas, vistaLocal, setVistaLocal, modulos,
    sedeActualIdRef,cargandoCaja,  // 🔧 ref para que el WS ignore eventos de sedes anteriores
  } = useTerminalData(sedeActualId, triggerRecarga, setConfiguracionGlobal, setEstadoCaja);

  useTerminalWS(sedeActualId, setMesas, setOrdenesLlevar, setSolicitudesBot, sedeActualIdRef);


  useEffect(() => {
    // Solo ejecutamos esta lógica cuando la lista de sedes termina de cargar
    if (sedes && sedes.length > 0) {
      
      // Leemos directo del disco para no depender del estado de React y evitar el bucle
      const sedeGuardada = localStorage.getItem('sede_id');
      
      if (!sedeGuardada) {
        const primeraSedeId = sedes[0].id.toString();
        localStorage.setItem('sede_id', primeraSedeId);
        setSedeActualId(primeraSedeId);
      }
    }
  }, [sedes]);
  // ── HELPERS ─────────────────────────────────────────────────────────────────
  const manejarCambioSede = (nuevaSedeId) => {
    if (!nuevaSedeId) return;
    localStorage.setItem('sede_id', nuevaSedeId);
    setSedeActualId(nuevaSedeId);
  };
  const handleAbrirCaja = async () => {
    if (!fondoCaja || isNaN(fondoCaja) || parseFloat(fondoCaja) < 0) {
      alert('Ingresa un fondo de caja válido.');
      return;
    }
    setAbriendoCaja(true);
    try {
      const res = await abrirCajaBD({
        sede_id: sedeActualId,
        empleado_id: localStorage.getItem('empleado_id'),
        fondo_inicial: parseFloat(fondoCaja),
      });
      localStorage.setItem('sesion_caja_id', res.data.id);
      setEstadoCaja('abierto');
      setModalAperturaAbierto(false);
      setFondoCaja('');
    } catch {
      alert('Error al abrir la caja. Intenta de nuevo.');
    } finally {
      setAbriendoCaja(false);
    }
  };
  const manejarClickMesa = async (mesa) => {
    if (modoUnir) {
      if (!mesaPrincipal) {
        setMesaPrincipal(mesa.id);
      } else if (mesa.id !== mesaPrincipal) {
        try {
          await actualizarMesa(mesa.id, { mesa_principal: mesaPrincipal });
          setModoUnir(false); setMesaPrincipal(null);
          setTriggerRecarga((p) => !p);
        } catch { alert('No se pudo unir las mesas.'); }
      }
    } else {
      setMesaSeleccionada(mesa.id);
    }
  };

  // ✨ NUEVO: Lógica para desarmar un grupo de mesas
  const manejarSepararMesa = async (mesaPadre) => {
    const confirmar = window.confirm(`¿Estás seguro de que quieres desarmar el grupo de la Mesa ${mesaPadre.numero}?`);
    if (!confirmar) return;

    try {
      // 1. Buscamos todas las mesas que están unidas a este padre usando el estado local
      const mesasHijas = mesas.filter((m) => m.unida_a === mesaPadre.id);

      // 2. Liberamos cada mesa hija en la base de datos de forma simultánea
      await Promise.all(
        mesasHijas.map((hija) => 
          actualizarMesa(hija.id, { mesa_principal: null }) 
        )
      );

      // 3. Forzamos la recarga para actualizar la vista local (y el WebSocket hará el resto)
      setTriggerRecarga((p) => !p);
      
    } catch (error) {
      console.error('Error al separar mesas:', error);
      alert('Hubo un problema al intentar separar las mesas. Intenta de nuevo.');
    }
  };

  const iniciarOrdenDelivery = () => {
    if (!nombreCliente.trim()) { alert('Por favor, ingresa el nombre del cliente.'); return; }
    setModalClienteAbierto(false);
    setMesaSeleccionada({ id: 'llevar', cliente: nombreCliente, telefono: telefonoCliente });
    setNombreCliente(''); setTelefonoCliente('');
  };

  const entregarOrdenLlevar = async (id) => {
    try { await actualizarOrden(id, { estado: 'pagado' }); setTriggerRecarga((p) => !p); }
    catch { alert('Error al entregar el pedido.'); }
  };

  const manejarCancelacion = async (id) => {
    const motivo = window.prompt('¿Por qué se cancela el pedido?');
    if (motivo) {
      try { await actualizarOrden(id, { estado: 'cancelado', cancelado: true, motivo_cancelacion: motivo }); setTriggerRecarga((p) => !p); }
      catch { console.error('Error al cancelar'); }
    }
  };

  const manejarCierreCajaSeguro = async () => {
    const hayOcupadas = mesas.some((m) => m.estado === 'ocupada' || m.orden_activa);
    const hayLlevar = ordenesLlevar.some((o) => o.estado_pago !== 'pagado');
    if (hayOcupadas || hayLlevar) { alert('⚠️ No puedes cerrar el turno. Hay mesas ocupadas o pedidos pendientes.'); return; }
    const pin = window.prompt('Ingrese PIN autorizado para cerrar caja:');
    if (!pin) return;
    try {
      const { data } = await validarPinEmpleado({ pin, accion: 'entrar' });
      if (['Cajero', 'Administrador', 'Admin'].includes(data.rol_nombre)) setModalCierreAbierto(true);
      else alert('🚫 Tu rol no tiene permisos para cerrar la caja.');
    } catch { alert('❌ PIN incorrecto o empleado inactivo.'); }
  };

  // ✨ NUEVO: Función que llama a Django y dispara el WhatsApp
  const manejarResolucionBot = async (solicitud_id, orden_id, decision) => {
    try {
      await api.post(`/ordenes/${orden_id}/resolver_solicitud_bot/`, {
        solicitud_id,
        decision
      });
      
      // Quitamos la solicitud actual de la cola (por si llegaron 2 a la vez)
      setSolicitudesBot(prev => prev.filter(s => s.solicitud_id !== solicitud_id));
      
      // Si aprobamos una cancelación, recargamos el tablero para liberar la mesa
      if (decision === 'aprobar') {
        setTriggerRecarga(p => !p);
      }
    } catch (error) {
      console.error(error);
      alert("Hubo un error de conexión al resolver la solicitud del bot.");
    }
  };
  
  if (!cajaAbierta && !cargandoCaja && vistaLocal !== null) {
    return (
      <div className={`h-screen flex flex-col items-center justify-center text-center p-6 ${tema === 'dark' ? 'bg-[#0a0a0a]' : 'bg-[#f0f0f0]'}`}>
        <span className="text-7xl mb-6">🔒</span>
        <h1 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter">
          Caja Cerrada
        </h1>
        <p className="text-neutral-500 font-bold mb-8 max-w-sm">
          {puedeAbrirCaja
            ? 'No hay una sesión de caja activa. Inicia el turno para comenzar.'
            : 'Esperando que el cajero o administrador abra la caja.'}
        </p>

        {puedeAbrirCaja && (
          <button
            onClick={() => setModalAperturaAbierto(true)}
            className="px-8 py-4 rounded-2xl text-white font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
            style={{ backgroundColor: colorPrimario }}
          >
            💰 Abrir Caja
          </button>
        )}

        {modalAperturaAbierto && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#1a1a1a] border border-[#333] rounded-3xl w-full max-w-sm p-8 shadow-2xl">
              <h2 className="text-xl font-black text-white mb-1">Abrir Turno</h2>
              <p className="text-neutral-500 text-sm mb-6">Ingresa el fondo inicial de la caja</p>
              <input
                type="number"
                value={fondoCaja}
                onChange={(e) => setFondoCaja(e.target.value)}
                placeholder="S/. 0.00"
                className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-4 text-white text-center text-2xl font-black focus:outline-none focus:border-[#ff5a1f] mb-6"
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setModalAperturaAbierto(false)}
                  className="flex-1 py-3 rounded-xl border border-[#333] text-neutral-400 font-bold"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAbrirCaja}
                  disabled={abriendoCaja}
                  className="flex-1 py-3 rounded-xl text-white font-black disabled:opacity-50"
                  style={{ backgroundColor: colorPrimario }}
                >
                  {abriendoCaja ? 'Abriendo...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
  // ── RENDER DE ESTADOS ESPECIALES ────────────────────────────────────────────
  if (vistaLocal === null) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${tema === 'dark' ? 'bg-[#0a0a0a]' : 'bg-[#f4f4f5]'}`}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: colorPrimario, borderTopColor: 'transparent' }} />
          <p className="font-black tracking-widest uppercase text-xs text-neutral-500">Conectando...</p>
        </div>
      </div>
    );
  }

  if (modulos.salon === false && modulos.delivery === false) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center text-center p-6 ${tema === 'dark' ? 'bg-[#0a0a0a] text-white' : 'bg-[#f0f0f0] text-gray-900'}`}>
        <span className="text-6xl mb-4">🍔</span>
        <h1 className="text-3xl font-black mb-2 uppercase">Modo Fast Food Activo</h1>
        <p className="text-neutral-500 mb-8 max-w-md">El salón y delivery están desactivados. Usa la Venta Rápida.</p>
        <button onClick={() => setDrawerVentaRapidaAbierto(true)} style={{ backgroundColor: colorPrimario }} className="px-8 py-4 rounded-2xl text-white font-black text-xl shadow-lg active:scale-95">⚡ INICIAR VENTA RÁPIDA</button>
        <DrawerVentaRapida isOpen={drawerVentaRapidaAbierto} onClose={() => setDrawerVentaRapidaAbierto(false)} onProcederPago={(carrito, total) => { setOrdenACobrar({ id: 'venta_rapida', es_venta_rapida: true, total, detalles: carrito.map((c) => ({ producto: c.id, nombre: c.nombre, precio_unitario: c.precio, cantidad: c.cantidad })) }); setDrawerVentaRapidaAbierto(false); }} />
        <ModalCobro isOpen={!!ordenACobrar} onClose={() => setOrdenACobrar(null)} total={ordenACobrar ? parseFloat(ordenACobrar.total) : 0} carrito={ordenACobrar?.detalles?.map((d) => ({ id: d.producto, nombre: d.nombre, precio: parseFloat(d.precio_unitario), cantidad: d.cantidad || 1 })) || []} esVentaRapida={true} onCobroExitoso={async (datosCobro) => { try { const pagos = datosCobro?.pagos || []; const { data: nueva } = await crearOrden({ tipo: 'llevar', estado: 'completado', estado_pago: 'pagado', sede: sedeActualId, detalles: ordenACobrar.detalles || [] }); for (const p of pagos) await crearPago({ orden: nueva.id, monto: p.monto, metodo: p.metodo }); return { ordenId: nueva.id }; } catch (e) { alert('Error al guardar el pago.'); throw e; } }} />
      </div>
    );
  }

  // ── RENDER PRINCIPAL ────────────────────────────────────────────────────────
  return (
    <div className={`h-screen w-full flex flex-col overflow-hidden font-sans transition-colors duration-500 ${tema === 'dark' ? 'bg-[#0a0a0a] text-neutral-100' : 'bg-[#f4f4f5] text-gray-900'}`}>
      
      <TerminalHeader 
        tema={tema} colorPrimario={colorPrimario} vistaLocal={vistaLocal} 
        mesaSeleccionada={mesaSeleccionada} esDueño={esDueño} sedes={sedes} 
        sedeActualId={sedeActualId} manejarCambioSede={manejarCambioSede} 
        modoUnir={modoUnir} setModoUnir={setModoUnir} setMesaPrincipal={setMesaPrincipal} 
        modSalonActivo={modulos.salon} modLlevarActivo={modulos.delivery} 
        setVistaLocal={setVistaLocal} ordenesLlevar={ordenesLlevar} 
        setDrawerVentaRapidaAbierto={setDrawerVentaRapidaAbierto} rolUsuario={rolUsuario} 
        onIrAErp={onIrAErp} setModalMovimientosAbierto={setModalMovimientosAbierto} 
        manejarCierreCajaSeguro={manejarCierreCajaSeguro} 
      />

      <div className="flex-1 flex overflow-hidden">
        <div 
          className={`h-full overflow-y-auto transition-all duration-300 ${tema === 'dark' ? 'border-[#222]' : 'border-gray-200'} border-r ${mesaSeleccionada ? 'hidden lg:block lg:w-[60%]' : 'w-full lg:w-[60%]'}`}
          onClick={(e) => { if (!e.target.closest('button')) setMesaSeleccionada(null); }}
        >
          {vistaLocal === 'salon' && modulos.salon && (
            <TerminalMesasGrid 
              mesas={mesas} 
              modoUnir={modoUnir} 
              mesaPrincipal={mesaPrincipal} 
              mesaSeleccionada={mesaSeleccionada} 
              manejarClickMesa={manejarClickMesa} 
              mostrarPuertaMovil={mostrarPuertaMovil} 
              setMostrarPuertaMovil={setMostrarPuertaMovil} 
              tema={tema} 
              colorPrimario={colorPrimario} 
              sedeActual={sedes.find(s => String(s.id) === String(sedeActualId))}
              manejarSepararMesa={manejarSepararMesa} /* 👈 ¡AÑADE ESTA LÍNEA AQUÍ! */
            />
          )}

          {vistaLocal === 'llevar' && modulos.delivery && (
            <TerminalLlevarView 
              ordenesLlevar={ordenesLlevar} tema={tema} colorPrimario={colorPrimario} 
              setModalClienteAbierto={setModalClienteAbierto} manejarCancelacion={manejarCancelacion} 
              setOrdenACobrar={setOrdenACobrar} entregarOrdenLlevar={entregarOrdenLlevar} 
            />
          )}
        </div>

        <TerminalSidebar 
          mesaSeleccionada={mesaSeleccionada} setMesaSeleccionada={setMesaSeleccionada} 
          setTriggerRecarga={setTriggerRecarga} todasLasOrdenesActivas={todasLasOrdenesActivas} 
          setVistaLocal={setVistaLocal} mesas={mesas} tema={tema} colorPrimario={colorPrimario} 
        />
      </div>

      {/* ══════════════════ MODALES GLOBALES ══════════════════ */}
      {modalClienteAbierto && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#1a1a1a] border border-[#333] rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-[#2a2a2a] flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black text-white">Datos del Cliente</h2>
                <p className="text-neutral-500 text-sm mt-1">Identifica el pedido para llevar</p>
              </div>
              <button onClick={() => setModalClienteAbierto(false)} className="w-8 h-8 bg-[#222] rounded-full flex items-center justify-center text-neutral-400 hover:text-white font-bold">✕</button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="text-neutral-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2"><span>👤</span> Nombre (Obligatorio)</label>
                <input type="text" value={nombreCliente} onChange={(e) => setNombreCliente(e.target.value)} placeholder="Ej. Carlos Gutiérrez" className="w-full bg-[#121212] border border-[#333] rounded-xl px-4 py-4 text-white focus:outline-none focus:border-[#ff5a1f] transition-colors" />
              </div>
              <div>
                <label className="text-neutral-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2"><span>📱</span> WhatsApp (Opcional)</label>
                <input type="tel" value={telefonoCliente} onChange={(e) => setTelefonoCliente(e.target.value)} placeholder="Ej. 999 999 999" className="w-full bg-[#121212] border border-[#333] rounded-xl px-4 py-4 text-white focus:outline-none focus:border-[#ff5a1f] transition-colors" />
                <p className="text-neutral-500 text-[11px] mt-2">Ingresa el número para enviarle un SMS automático cuando su pedido esté listo.</p>
              </div>
              <button onClick={iniciarOrdenDelivery} className="w-full bg-[#ff5a1f] hover:bg-[#e04a15] text-white font-black py-4 rounded-xl active:scale-95 transition-all shadow-[0_4px_15px_rgba(255,90,31,0.3)]">IR AL MENÚ ➔</button>
            </div>
          </div>
        </div>
      )}

      <ModalCobro
        isOpen={!!ordenACobrar} 
        onClose={() => setOrdenACobrar(null)}
        total={ordenACobrar ? parseFloat(ordenACobrar.total) : 0}
        carrito={ordenACobrar ? ordenACobrar.detalles.map((d) => ({ id: d.producto, nombre: d.nombre, precio: parseFloat(d.precio_unitario), cantidad: d.cantidad || 1 })) : []}
        esVentaRapida={ordenACobrar?.es_venta_rapida || false}
        onCobroExitoso={async (datosCobro) => {
          try {
            let idOrden = ordenACobrar.id;

            // 1. Si es venta rápida, creamos la orden primero
            if (idOrden === 'venta_rapida') {
              const { data } = await crearOrden({ 
                tipo: 'llevar', 
                estado: 'pendiente',
                estado_pago: 'pendiente', 
                sede: sedeActualId, 
                detalles: ordenACobrar.detalles || [] 
              });
              idOrden = data.id;
            }

            // 🛡️ FIX: antes, si CUALQUIER pago del split venía confirmado por
            // Yape/Plin (yaConfirmado), se saltaba cobrar_orden entero — en
            // una cuenta dividida (parte Yape + parte efectivo/tarjeta) el
            // resto de los pagos manuales y el teléfono (CRM) nunca se
            // registraban. El backend (cobrar_orden) ya sabe deduplicar los
            // pagos que vinieron por WS, así que siempre hay que llamarlo —
            // solo se filtran acá los que ya están confirmados para no
            // reenviarlos de más.
            const sesionCajaId = localStorage.getItem('sesion_caja_id');
            const pagosManuales = datosCobro.pagos.filter(p => !p.yaConfirmado);
            await api.post(`/ordenes/${idOrden}/cobrar_orden/`, {
              pagos: pagosManuales,
              telefono: datosCobro.telefono,
              sesion_caja_id: sesionCajaId
            });

            // El cierre del modal lo hace onClose (Finalizar/Cerrar). Aquí solo
            // comiteamos y devolvemos el id real (para emitir el comprobante).
            setTriggerRecarga((p) => !p);
            return { ordenId: idOrden };

          } catch (error) {
            console.error(error);
            alert('Hubo un error al procesar el pago.');
            throw error;
          }
        }}
        />

      <DrawerVentaRapida
        isOpen={drawerVentaRapidaAbierto} onClose={() => setDrawerVentaRapidaAbierto(false)}
        onProcederPago={(carrito, total) => {
          setOrdenACobrar({ id: 'venta_rapida', es_venta_rapida: true, total, detalles: carrito.map((c) => ({ producto: c.id, nombre: c.nombre, precio_unitario: c.precio, cantidad: c.cantidad })) });
          setDrawerVentaRapidaAbierto(false);
        }}
      />

      <ModalCierreCaja
        isOpen={modalCierreAbierto} onClose={() => setModalCierreAbierto(false)}
        onCierreExitoso={(resumen) => {
          setModalCierreAbierto(false);
          const dif = resumen?.diferencia || 0;
          const msg = dif === 0 ? '✅ ¡Cuadre perfecto!' : dif > 0 ? `⚠️ Sobrante de S/ ${dif.toFixed(2)}` : `🚨 Faltante de S/ ${Math.abs(dif).toFixed(2)}`;
          alert(`${msg}\n\nCerrando sesión...`);
          window.location.reload();
        }}
      />

      <ModalMovimientoCaja
        isOpen={modalMovimientosAbierto} onClose={() => setModalMovimientosAbierto(false)}
        onGuardar={async (datos) => {
          try {
            const sesionId = estadoCaja?.id || localStorage.getItem('sesion_caja_id');
            if (!sesionId) { alert('⚠️ No hay sesión de caja activa.'); return; }
            await registrarMovimientoCaja({ tipo: datos.tipo, monto: datos.monto, concepto: datos.concepto, sesion_caja_id: sesionId, empleado_id: localStorage.getItem('empleado_id') });
            alert(`💸 ¡Listo! Se registró el ${datos.tipo} de S/ ${datos.monto} exitosamente.`);
          } catch { alert('❌ Error al guardar el movimiento.'); }
        }}
      />

      <ModalAlertaBot 
        solicitud={solicitudesBot[0]} // Le pasamos la más antigua de la cola
        onResolver={manejarResolucionBot}
      />
    </div>
  );
}