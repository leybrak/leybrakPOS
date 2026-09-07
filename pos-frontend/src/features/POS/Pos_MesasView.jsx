import React, { useState } from 'react';
import { crearOrden, actualizarMesa, actualizarOrden, crearPago, registrarMovimientoCaja } from '../../api/api';
import usePosStore from '../../store/usePosStore';
import { useConfirm, usePrompt } from '../../context/ConfirmContext';

// Modales
import ModalCobro from '../../components/modals/ModalCobro';
import ModalCierreCaja from '../../components/modals/ModalCierreCaja';
import ModalMovimientoCaja from '../../components/modals/ModalMovimientoCaja';
import DrawerVentaRapida from './Pos_DrawerVentaRapida';

// Componentes Refactorizados
import MesasHeader from './components/MesasHeader';
import MesasGrid from './components/MesasGrid';
import MesasLlevar from './components/MesasLlevar';

// Hooks Refactorizados
import { useMesasData } from './hooks/useMesasData';
import { useMesasWS } from './hooks/useMesasWS';

export default function MesasView({ onSeleccionarMesa, onIrAErp, mesaActivaId }) {
  const { estadoCaja, configuracionGlobal, setConfiguracionGlobal, setEstadoCaja } = usePosStore();
  const confirmar = useConfirm();
  const prompt = usePrompt();
  const tema = configuracionGlobal?.temaFondo || 'dark';
  const colorPrimario = configuracionGlobal?.colorPrimario || '#ff5a1f';
  const isDark = tema === 'dark'; // ✨ Helper para el nuevo diseño

  // ── ESTADOS LOCALES ──────────────────────────────────────────────────────────
  const [sedeActualId, setSedeActualId] = useState(localStorage.getItem('sede_id') || '');
  // 🔒 ROL: leemos del localStorage donde el login lo almacena tras autenticar
  // (el JWT de Django no incluye el campo "rol" en su payload)
  const rolUsuario = localStorage.getItem('usuario_rol') || 'Empleado';
  const esDueño = ['dueño', 'admin', 'administrador'].includes(rolUsuario.trim().toLowerCase());
  
  const [modoUnir, setModoUnir] = useState(false);
  const [mesaPrincipal, setMesaPrincipal] = useState(null);
  const [triggerRecarga, setTriggerRecarga] = useState(false);
  const [mostrarPuertaMovil, setMostrarPuertaMovil] = useState(false);
  
  const [modalClienteAbierto, setModalClienteAbierto] = useState(false);
  const [nombreCliente, setNombreCliente] = useState('');
  const [telefonoCliente, setTelefonoCliente] = useState('');
  
  const [modalCierreAbierto, setModalCierreAbierto] = useState(false);
  const [drawerVentaRapidaAbierto, setDrawerVentaRapidaAbierto] = useState(false);
  const [modalMovimientosAbierto, setModalMovimientosAbierto] = useState(false);
  const [ordenACobrar, setOrdenACobrar] = useState(null);

  // ── HELPER: cambio de sede (declarado antes del hook para poder pasarlo como callback) ──
  const manejarCambioSede = (nuevaSedeId) => {
    if (!nuevaSedeId) return;
    localStorage.setItem('sede_id', nuevaSedeId);
    setSedeActualId(nuevaSedeId);
  };

  // ── HOOKS DE DATOS Y WEBSOCKETS ─────────────────────────────────────────────
  const {
    sedes, mesas, setMesas, ordenesLlevar, setOrdenesLlevar,
    vistaLocal, setVistaLocal, modulos
  } = useMesasData(sedeActualId, triggerRecarga, setConfiguracionGlobal, manejarCambioSede);

  const wsRef = useMesasWS(sedeActualId, setMesas, setOrdenesLlevar);

  const avisarEstadoMesa = (mesaId, nuevoEstado) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'mesa_estado',
        mesa_id: mesaId,
        estado: nuevoEstado
      }));
    }
  };

  const manejarCancelacion = async (id) => {
    const motivo = await prompt('Esta acción libera la mesa y queda registrada en la auditoría.', {
      titulo: '¿Por qué se cancela el pedido?',
      peligroso: true,
      textoConfirmar: 'Cancelar pedido',
      pedirTexto: { placeholder: 'Motivo...' },
    });
    if (motivo) {
      try {
        await actualizarOrden(id, { estado: 'cancelado', cancelado: true, motivo_cancelacion: motivo });
        setTriggerRecarga(prev => !prev);
      } catch (error) { console.error("Error al cancelar:", error); }
    }
  };

  const manejarClickMesa = async (mesa) => {
    if (modoUnir) {
      if (!mesaPrincipal) { setMesaPrincipal(mesa.id); } 
      else if (mesa.id !== mesaPrincipal) {
        try {
          await actualizarMesa(mesa.id, { mesa_principal: mesaPrincipal });
          setModoUnir(false); setMesaPrincipal(null); setTriggerRecarga(p => !p); 
        } catch (error) { alert("No se pudo unir las mesas."); }
      }
    } else {
      if (mesa.estado === 'libre') {
        avisarEstadoMesa(mesa.id, 'pidiendo');
      }
      onSeleccionarMesa(mesa.id);
    }
  };

  const iniciarOrdenDelivery = () => {
    if (!nombreCliente.trim()) { alert("Ingresa el nombre del cliente."); return; }
    setModalClienteAbierto(false);
    onSeleccionarMesa({ id: 'llevar', cliente: nombreCliente, telefono: telefonoCliente });
    setNombreCliente(''); setTelefonoCliente('');
  };

  const entregarOrdenLlevar = async (id) => {
    try { await actualizarOrden(id, { estado: 'pagado' }); setTriggerRecarga(p => !p); } 
    catch (error) { alert("Error al entregar el pedido."); }
  };

  const manejarCierreCajaSeguro = async () => {
    const hayOcupadas = mesas.some(mesa => mesa.estado === 'ocupada' || mesa.orden_activa);
    const hayLlevarPendientes = ordenesLlevar.some(orden => orden.estado_pago !== 'pagado');
    if (hayOcupadas || hayLlevarPendientes) { alert("⚠️ Aún hay mesas ocupadas o pedidos pendientes."); return; }

    // 🛠️ Antes pedía un PIN de empleado (window.prompt + validarPinEmpleado) — el
    // dueño no tiene PIN configurado (entra con usuario/contraseña), así que nunca
    // podía cerrar caja. El botón ya está gateado por rol para quien lo ve, así que
    // alcanza con una confirmación simple.
    const ok = await confirmar('¿Estás seguro de cerrar la caja? Se registrará el cierre de turno.');
    if (ok) setModalCierreAbierto(true);
  };

  // ── RENDER DE ESTADOS ESPECIALES (Diseño ERP) ──────────────────────────────
  if (vistaLocal === null) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-500 ${isDark ? 'bg-[#0a0a0a]' : 'bg-[#f0f0f0]'}`}>
        <div className="flex flex-col items-center gap-5">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl shadow-lg" style={{ backgroundColor: colorPrimario + '15', color: colorPrimario }}>
            <i className="fi fi-rr-restaurant mt-1 animate-pulse"></i>
          </div>
          <div className="flex flex-col items-center gap-2 mt-2">
            <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: colorPrimario, borderTopColor: 'transparent' }}></div>
            <p className={`font-black tracking-widest uppercase text-xs mt-2 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>Conectando Sistema...</p>
          </div>
        </div>
      </div>
    );
  }

  if (modulos.salon === false && modulos.delivery === false) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center text-center p-6 transition-colors duration-500 ${isDark ? 'bg-[#0a0a0a]' : 'bg-[#f0f0f0]'}`}>
        <div className={`max-w-lg w-full p-10 rounded-3xl border shadow-xl flex flex-col items-center ${isDark ? 'bg-[#141414] border-[#222]' : 'bg-white border-gray-200'}`}>
          <div className="w-24 h-24 rounded-full flex items-center justify-center text-5xl mb-6 shadow-inner" style={{ backgroundColor: colorPrimario + '15' }}>
            🍔
          </div>
          <h1 className={`text-2xl font-black mb-2 uppercase tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>Modo Fast Food</h1>
          <p className={`mb-8 text-sm ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>El salón principal y delivery están desactivados. Usa la Venta Rápida para despachar pedidos al instante.</p>
          <button 
            onClick={() => setDrawerVentaRapidaAbierto(true)} 
            style={{ backgroundColor: colorPrimario }} 
            className="w-full py-4 rounded-2xl text-white font-black text-sm uppercase tracking-widest shadow-lg transition-transform active:scale-95 hover:-translate-y-1"
          >
            ⚡ INICIAR VENTA RÁPIDA
          </button>
        </div>
      </div>
    );
  }

  // ── RENDER PRINCIPAL ────────────────────────────────────────────────────────
  return (
    <div className={`min-h-full flex flex-col font-sans transition-colors duration-500 pb-10 ${isDark ? 'bg-[#0a0a0a] text-neutral-100' : 'bg-[#f0f0f0] text-gray-900'}`}>
      
      <MesasHeader 
        colorPrimario={colorPrimario} vistaLocal={vistaLocal} esDueño={esDueño} 
        sedes={sedes} sedeActualId={sedeActualId} manejarCambioSede={manejarCambioSede} 
        modoUnir={modoUnir} setModoUnir={setModoUnir} setMesaPrincipal={setMesaPrincipal} 
        modSalonActivo={modulos.salon} modLlevarActivo={modulos.delivery} setVistaLocal={setVistaLocal} 
        ordenesLlevar={ordenesLlevar} setDrawerVentaRapidaAbierto={setDrawerVentaRapidaAbierto} 
        rolUsuario={rolUsuario} onIrAErp={onIrAErp} setModalMovimientosAbierto={setModalMovimientosAbierto} 
        manejarCierreCajaSeguro={manejarCierreCajaSeguro} 
      />

      {/* Contenedor principal estilo ERP (con padding global y fondo claro/oscuro) */}
      <div className="flex-1 px-4 md:px-8 pt-4 pb-12 w-full max-w-[1600px] mx-auto">
        {vistaLocal === 'salon' && modulos.salon && (
          <MesasGrid 
            mesas={mesas} modoUnir={modoUnir} mesaPrincipal={mesaPrincipal} mesaActivaId={mesaActivaId} 
            manejarClickMesa={manejarClickMesa} mostrarPuertaMovil={mostrarPuertaMovil} 
            setMostrarPuertaMovil={setMostrarPuertaMovil} tema={tema} colorPrimario={colorPrimario} 
            sedeActualId={sedeActualId} sedes={sedes} 
          />
        )}

        {vistaLocal === 'llevar' && modulos.delivery && (
          <MesasLlevar 
            ordenesLlevar={ordenesLlevar} tema={tema} colorPrimario={colorPrimario} 
            setModalClienteAbierto={setModalClienteAbierto} manejarCancelacion={manejarCancelacion} 
            setOrdenACobrar={setOrdenACobrar} entregarOrdenLlevar={entregarOrdenLlevar} 
          />
        )}
      </div>

      {/* ══════════════════ MODALES GLOBALES (Diseño ERP) ══════════════════ */}
      {modalClienteAbierto && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4 animate-fadeIn">
          <div className={`border rounded-3xl w-full max-w-md overflow-hidden shadow-2xl transition-colors ${isDark ? 'bg-[#141414] border-[#222]' : 'bg-white border-gray-200'}`}>
            <div className={`p-6 border-b flex justify-between items-center ${isDark ? 'border-[#222]' : 'border-gray-100'}`}>
              <div>
                <h2 className={`text-xl font-black tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>Datos del Cliente</h2>
                <p className={`text-xs mt-1 ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>Identifica el pedido para llevar</p>
              </div>
              <button 
                onClick={() => setModalClienteAbierto(false)} 
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${isDark ? 'bg-[#1a1a1a] text-neutral-400 hover:bg-[#222] hover:text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-900'}`}
              >
                <i className="fi fi-rr-cross-small text-xl mt-1"></i>
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div>
                <label className={`text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                  <i className="fi fi-rr-user"></i> Nombre (Obligatorio)
                </label>
                <input 
                  type="text" 
                  value={nombreCliente} 
                  onChange={(e) => setNombreCliente(e.target.value)} 
                  placeholder="Ej. Carlos Gutiérrez" 
                  className={`w-full border rounded-xl px-4 py-4 focus:outline-none transition-colors text-sm font-bold ${
                    isDark ? 'bg-[#0a0a0a] border-[#333] text-white focus:border-neutral-500' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-gray-400'
                  }`} 
                />
              </div>
              <div>
                <label className={`text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                  <i className="fi fi-brands-whatsapp"></i> WhatsApp (Opcional)
                </label>
                <input 
                  type="tel" 
                  value={telefonoCliente} 
                  onChange={(e) => setTelefonoCliente(e.target.value)} 
                  placeholder="Ej. 999 999 999" 
                  className={`w-full border rounded-xl px-4 py-4 focus:outline-none transition-colors text-sm font-bold ${
                    isDark ? 'bg-[#0a0a0a] border-[#333] text-white focus:border-neutral-500' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-gray-400'
                  }`} 
                />
              </div>
              <button 
                onClick={iniciarOrdenDelivery} 
                style={{ backgroundColor: colorPrimario }}
                className="w-full text-white font-black py-4 rounded-xl active:scale-95 hover:-translate-y-1 transition-all shadow-lg text-sm tracking-wide flex items-center justify-center gap-2 mt-2"
              >
                IR AL MENÚ <i className="fi fi-rr-arrow-right mt-1"></i>
              </button>
            </div>
          </div>
        </div>
      )}

      <ModalCobro 
        isOpen={!!ordenACobrar} onClose={() => setOrdenACobrar(null)} 
        total={ordenACobrar ? parseFloat(ordenACobrar.total) : 0} 
        carrito={ordenACobrar ? ordenACobrar.detalles.map(d => ({ id: d.producto, nombre: d.nombre, precio: parseFloat(d.precio_unitario), cantidad: d.cantidad || 1 })) : []} 
        esVentaRapida={ordenACobrar?.es_venta_rapida || false}
        onCobroExitoso={async (datosCobro) => {
          try {
            const pagos = datosCobro?.pagos || [];
            let idDeLaOrden = ordenACobrar.id;
            if (idDeLaOrden === 'venta_rapida') {
              const res = await crearOrden({ tipo: 'llevar', estado: 'completado', estado_pago: 'pagado', sede: sedeActualId, detalles: ordenACobrar.detalles || [] });
              idDeLaOrden = res.data.id;
            } else { await actualizarOrden(idDeLaOrden, { estado_pago: 'pagado', estado: 'completado' }); }
            for (const pago of pagos) await crearPago({ orden: idDeLaOrden, monto: pago.monto, metodo: pago.metodo });
            // El cierre lo hace onClose; aquí comiteamos y devolvemos el id real.
            setTriggerRecarga(p => !p);
            return { ordenId: idDeLaOrden };
          } catch (e) { alert("Error al procesar el pago."); throw e; }
        }}
      />

      <DrawerVentaRapida 
        isOpen={drawerVentaRapidaAbierto} onClose={() => setDrawerVentaRapidaAbierto(false)}
        onProcederPago={(carrito, total) => {
          setOrdenACobrar({ id: 'venta_rapida', es_venta_rapida: true, total, detalles: carrito.map(c => ({ producto: c.id, nombre: c.nombre, precio_unitario: c.precio, cantidad: c.cantidad })) });
          setDrawerVentaRapidaAbierto(false); 
        }}
      />

      <ModalCierreCaja 
        isOpen={modalCierreAbierto} onClose={() => setModalCierreAbierto(false)}
        onCierreExitoso={(resumen) => {
          setModalCierreAbierto(false);
          const dif = resumen?.diferencia || 0;
          const msg = dif === 0 ? "✅ ¡Cuadre perfecto!" : dif > 0 ? `⚠️ Sobrante de S/ ${dif.toFixed(2)}` : `🚨 Faltante de S/ ${Math.abs(dif).toFixed(2)}`;
          alert(msg);
          // 🛠️ Antes hacía window.location.reload() — un reload completo de la SPA
          // solo para reflejar "caja cerrada". Igual que en mobile, alcanza con
          // actualizar el store: la pantalla de apertura aparece al instante.
          setEstadoCaja(null);
          localStorage.removeItem('sesion_caja_id');
        }}
      />

      <ModalMovimientoCaja 
        isOpen={modalMovimientosAbierto} onClose={() => setModalMovimientosAbierto(false)}
        onGuardar={async (datos) => {
          try {
            const sesionId = estadoCaja?.id || localStorage.getItem('sesion_caja_id');
            if (!sesionId) { alert("⚠️ No hay sesión de caja activa."); return; }
            await registrarMovimientoCaja({ tipo: datos.tipo, monto: datos.monto, concepto: datos.concepto, sesion_caja_id: sesionId, empleado_id: localStorage.getItem('empleado_id') });
            alert(`💸 ¡Registrado ${datos.tipo} de S/ ${datos.monto} exitosamente!`);
          } catch { alert("❌ Error al registrar caja chica."); }
        }}
      />
    </div>
  );
}