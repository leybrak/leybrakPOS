import React, { useState, useEffect, useRef } from 'react';
import { actualizarOrden, getOrdenes, getNegocio } from '../api/api';
import api from '../api/api';
import usePosStore from '../store/usePosStore';
import ModalAlertaBot from '../components/modals/ModalAlertaBot';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import {
  ChefHat, LayoutList, BarChart2, Clock,
  AlertTriangle, Undo2, Bell, ShoppingBag,
  Wifi, PowerOff, CheckCircle2, ChevronDown, Check, LogOut
} from 'lucide-react';

export default function KdsView({ onVolver, onCerrarTurno }) {
  localStorage.setItem('modo_dispositivo', 'cocina');
  const toast = useToast();
  const confirmar = useConfirm();
  const { configuracionGlobal } = usePosStore();
  const setConfiguracionGlobal = usePosStore((state) => state.setConfiguracionGlobal);

  const tema = configuracionGlobal?.temaFondo || 'dark';
  const colorPrimario = configuracionGlobal?.colorPrimario || '#3b82f6'; // Fallback al azul del SaaS
  
  const [verificandoAcceso, setVerificandoAcceso] = useState(true);
  const [accesoPermitido, setAccesoPermitido] = useState(false);

  const [estacionActiva, setEstacionActiva] = useState('TODO');
  const [estacionesExpandidas, setEstacionesExpandidas] = useState(false);
  const [verConsolidado, setVerConsolidado] = useState(false);
  const [historial, setHistorial] = useState([]); 
  const estaciones = ['TODO', 'COCINA', 'BAR', 'PARRILLA'];

  const [ordenes, setOrdenes] = useState([]);
  const [solicitudesBot, setSolicitudesBot] = useState([]); 
  const ws = useRef(null);

  const sedeActualId = localStorage.getItem('sede_id');
  const negocioId = localStorage.getItem('negocio_id') || 1;

  useEffect(() => {
    const verificarPermisos = async () => {
      try {
        const response = await getNegocio(negocioId);
        const datosBD = response.data; 

        setAccesoPermitido(datosBD.mod_cocina_activo);

        if (setConfiguracionGlobal) {
          setConfiguracionGlobal({
            colorPrimario: datosBD.color_primario || '#3b82f6',
            temaFondo: datosBD.tema_fondo || 'dark',
            modulos: {
              ...(configuracionGlobal?.modulos || {}),
              cocina: datosBD.mod_cocina_activo
            }
          });
        }
      } catch (error) {
        setAccesoPermitido(false); 
      } finally {
        setVerificandoAcceso(false); 
      }
    };
    verificarPermisos();
  }, [negocioId]); 

  // --- LÓGICA DE WEBSOCKET (MODO PURISTA + AUTO-RECONEXIÓN) ---
  useEffect(() => {
    if (!accesoPermitido || !sedeActualId) return;

    let reconnectTimeout = null;
    let unmounted = false;

    const conectar = () => {
      if (unmounted) return;

      const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';
      const baseUrl = apiUrl.replace('http://', 'ws://').replace('https://', 'wss://').replace('/api', '');
      
      const urlCocina = `${baseUrl}/ws/cocina/${sedeActualId}/`;
      
      ws.current = new WebSocket(urlCocina);
      
      ws.current.onopen = () => console.log(`🔥 KDS Conectado a la Cocina con COOKIES (Sede ${sedeActualId})`);

      ws.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'orden_nueva' || data.type === 'nueva_orden') {
          const nuevosItems = data.orden.detalles.map(d => ({
            id: d.id,
            cant: d.cantidad !== undefined ? d.cantidad : 1, 
            nombre: d.producto_nombre || d.nombre,
            listo: false,
            notas: d.notas_cocina 
          }));

          setOrdenes(prev => {
            const ticketViejo = prev.find(o => o.id === data.orden.id);
            if (ticketViejo) {
              const horaActual = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const itemsRealmenteNuevos = nuevosItems
                .filter(nuevo => !ticketViejo.items.some(viejo => viejo.id === nuevo.id))
                .map(item => ({ ...item, agregado_reciente: true, hora_agregado: horaActual }));

              const ticketActualizado = { ...ticketViejo, items: [...ticketViejo.items, ...itemsRealmenteNuevos] };
              return [ticketActualizado, ...prev.filter(o => o.id !== data.orden.id)];
            }

            const nuevaOrden = {
              kds_id: `ws_${data.orden.id}_${Date.now()}`,
              id: data.orden.id,
              real_id: data.orden.real_id || data.orden.id,
              origen: data.orden.mesa ? `Mesa ${data.orden.mesa}` : `DELIVERY - ${data.orden.cliente_nombre || 'Cliente'}`, 
              is_delivery: !data.orden.mesa,
              minutos: 0, 
              estacion: 'COCINA', 
              items: nuevosItems
            };
            return [nuevaOrden, ...prev];
          });
        }

        if (data.type === 'solicitud_cambio_nueva') {
          setSolicitudesBot(prev => {
            if (prev.some(s => s.solicitud_id === data.solicitud_id)) return prev;
            return [data, ...prev];
          });
          try { new Audio('/assets/sounds/notification.mp3').play().catch(() => {}); } catch(e){}
        }
      };
      
      ws.current.onclose = (e) => {
        if (e.code === 4001 || e.code === 4003) {
          console.error(`🔒 KDS WS rechazado (Falta cookie). Reintentando en 3s...`);
        } else {
          console.warn(`🔌 KDS Desconectado (Código ${e.code}). Reintentando en 3s...`);
        }
        if (!unmounted) reconnectTimeout = setTimeout(conectar, 3000);
      };

      ws.current.onerror = (err) => {
        console.error('⚠️ Error de red en WS Cocina', err);
      };
    };

    conectar();

    return () => {
      unmounted = true;
      clearTimeout(reconnectTimeout);
      if (ws.current) {
        ws.current.onclose = null;
        ws.current.close();
      }
    };
  }, [sedeActualId, accesoPermitido]);

  useEffect(() => {
    if (!accesoPermitido) return; 

    async function recuperarMemoria() {
      try {
        const respuesta = await getOrdenes({ sede_id: sedeActualId });
        const pendientes = respuesta.data.filter(o => o.estado === 'preparando');
        const ordenesFormateadas = pendientes.map(o => {
          const fechaCreacion = new Date(o.creado_en || new Date()); 
          const minutosTranscurridos = Math.floor((new Date() - fechaCreacion) / 60000);
          return {
            kds_id: `mem_${o.id}_${Math.random()}`,
            id: o.id,
            origen: o.mesa ? `Mesa ${o.mesa}` : `LLEVAR - ${o.cliente_nombre || 'Cliente'}`,
            is_delivery: !o.mesa,
            minutos: isNaN(minutosTranscurridos) ? 0 : minutosTranscurridos, 
            estacion: 'COCINA', 
            items: o.detalles.map(d => ({
              id: d.id, cant: d.cantidad, nombre: d.producto_nombre || d.nombre, listo: false, notas: d.notas_cocina 
            }))
          };
        });
        setOrdenes(ordenesFormateadas);
      } catch (error) {
        console.error("Error recuperando memoria de la cocina:", error);
      }
    }
    recuperarMemoria();
  }, [sedeActualId, accesoPermitido]);

  useEffect(() => {
    if (!accesoPermitido) return;
    const intervalo = setInterval(() => {
      setOrdenes(prev => prev.map(o => ({ ...o, minutos: o.minutos + 1 })));
    }, 60000);
    return () => clearInterval(intervalo);
  }, [accesoPermitido]);

  const tacharItem = (kdsId, itemId) => {
    setOrdenes(prev => prev.map(o => {
      if (o.kds_id === kdsId) return { ...o, items: o.items.map(i => i.id === itemId ? { ...i, listo: !i.listo } : i) };
      return o;
    }));
  };

  const despacharOrden = async (orden) => {
    try {
      await actualizarOrden(orden.real_id || orden.id, { estado: 'listo' });
      setHistorial([orden, ...historial].slice(0, 5)); 
      setOrdenes(ordenes.filter(o => o.kds_id !== orden.kds_id)); 
    } catch (error) {
      console.error("Error al despachar la orden:", error);
      toast.error('Error al despachar la orden. Verifica la conexión.');
    }
  };

  const recuperarOrden = (orden) => {
    setOrdenes([...ordenes, orden]);
    setHistorial(historial.filter(h => h.id !== orden.id));
  };

  const obtenerConsolidado = () => {
    const resumen = {};
    ordenes.filter(o => estacionActiva === 'TODO' || o.estacion === estacionActiva).forEach(o => {
        o.items.forEach(i => { if (!i.listo) resumen[i.nombre] = (resumen[i.nombre] || 0) + i.cant; });
      });
    return Object.entries(resumen);
  };

  const manejarResolucionBot = async (solicitud_id, orden_id, decision) => {
    try {
      await api.post(`/ordenes/${orden_id}/resolver_solicitud_bot/`, {
        solicitud_id,
        decision
      });
      setSolicitudesBot(prev => prev.filter(s => s.solicitud_id !== solicitud_id));
      
      if (decision === 'aprobar') {
        const respuesta = await getOrdenes({ sede_id: sedeActualId });
        // Lógica silenciosa omitida para no alterar el funcionamiento
      }
    } catch (error) {
      toast.error('Error al resolver la solicitud del bot.');
    }
  };

  const ordenesFiltradas = ordenes.filter(o => estacionActiva === 'TODO' || o.estacion === estacionActiva);

  // ════════════════════════════════════════════════════════════════════════
  // ESTADOS DE CARGA Y PERMISOS (Dark SaaS Vibe)
  // ════════════════════════════════════════════════════════════════════════
  if (verificandoAcceso) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center font-bold tracking-widest animate-pulse transition-colors duration-500 ${tema === 'dark' ? 'bg-[#050505] text-gray-500' : 'bg-[#f8fafc] text-gray-400'}`}>
        <ChefHat size={40} className="mb-4 opacity-50" />
        VERIFICANDO PERMISOS DE COCINA...
      </div>
    );
  }

  if (!accesoPermitido) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-6 text-center animate-fadeIn transition-colors duration-500 ${tema === 'dark' ? 'bg-[#050505]' : 'bg-[#f8fafc]'}`}>
        <div className={`max-w-md p-10 rounded-2xl border shadow-2xl ${tema === 'dark' ? 'bg-[#0a0a0a] border-[#1e1e1e]' : 'bg-white border-gray-200'}`}>
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center mx-auto mb-6">
            <PowerOff size={28} className="text-red-500" />
          </div>
          <h1 className={`text-2xl font-black mb-2 tracking-tight ${tema === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Módulo Desactivado
          </h1>
          <p className={`mb-8 text-sm leading-relaxed ${tema === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
            La Pantalla de Cocina (KDS) no está habilitada para la suscripción actual de este negocio. 
          </p>
          <button 
            onClick={onVolver} 
            className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all active:scale-[0.98] ${tema === 'dark' ? 'bg-white text-black hover:bg-gray-200' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
          >
            Volver al Panel
          </button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // RENDER PRINCIPAL KDS
  // ════════════════════════════════════════════════════════════════════════
  return (
    <div className={`min-h-screen font-sans flex flex-col transition-colors duration-500 ${tema === 'dark' ? 'bg-[#050505] text-white' : 'bg-[#f8fafc] text-gray-900'}`}>
      
      {/* HEADER TIPO DASHBOARD */}
      <header className={`px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-md sticky top-0 z-20 border-b ${tema === 'dark' ? 'bg-[#0a0a0a] border-[#1a1a1a]' : 'bg-white border-gray-200'}`}>
        
        <div className="flex items-center gap-6 w-full md:w-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-opacity-10" style={{ backgroundColor: `${colorPrimario}15`, color: colorPrimario }}>
              <ChefHat size={22} />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight leading-none">LEYBRAK <span style={{ color: colorPrimario }}>KDS</span></h1>
              <div className="flex items-center gap-1.5 mt-1">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${tema === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>Sistema en línea</span>
              </div>
            </div>
          </div>
          
          <div className={`hidden md:flex items-center gap-2 px-4 py-2 rounded-xl border ${tema === 'dark' ? 'bg-[#121212] border-[#1e1e1e]' : 'bg-gray-50 border-gray-200'}`}>
            <LayoutList size={16} className={tema === 'dark' ? 'text-gray-500' : 'text-gray-400'} />
            <span className={`font-mono font-bold text-sm ${tema === 'dark' ? 'text-white' : 'text-gray-900'}`}>{ordenesFiltradas.length}</span>
            <span className={`text-[10px] font-bold uppercase tracking-widest ${tema === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>Pendientes</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative min-w-[200px]">
            <button 
              onClick={() => setEstacionesExpandidas(!estacionesExpandidas)}
              className={`w-full flex justify-between items-center px-4 py-3 rounded-xl border transition-colors ${tema === 'dark' ? 'bg-[#121212] border-[#1e1e1e] hover:border-gray-700' : 'bg-white border-gray-200 hover:border-gray-300'}`}
            >
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-bold uppercase tracking-widest ${tema === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>Estación:</span>
                <span className="font-bold text-sm" style={{ color: colorPrimario }}>{estacionActiva}</span>
              </div>
              <ChevronDown size={16} className={`transition-transform duration-200 ${estacionesExpandidas ? 'rotate-180' : ''} ${tema === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} />
            </button>

            {estacionesExpandidas && (
              <div className={`absolute top-full left-0 w-full border rounded-xl mt-2 p-2 grid grid-cols-2 gap-2 shadow-2xl animate-fadeIn z-50 ${tema === 'dark' ? 'bg-[#121212] border-[#1e1e1e]' : 'bg-white border-gray-200'}`}>
                {estaciones.map(est => {
                  const isActivo = estacionActiva === est;
                  return (
                    <button 
                      key={est} 
                      onClick={() => { setEstacionActiva(est); setEstacionesExpandidas(false); }} 
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition-all border text-center ${!isActivo ? (tema === 'dark' ? 'bg-[#0a0a0a] text-gray-400 border-[#1a1a1a] hover:bg-[#161616]' : 'bg-gray-50 text-gray-600 border-gray-100 hover:bg-gray-100') : ''}`}
                      style={isActivo ? { backgroundColor: colorPrimario, borderColor: colorPrimario, color: '#fff' } : {}}
                    >
                      {est}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <button 
            onClick={() => setVerConsolidado(!verConsolidado)}
            className={`px-5 py-3 rounded-xl font-bold text-sm border transition-all flex justify-center items-center gap-2 ${!verConsolidado ? (tema === 'dark' ? 'bg-[#121212] border-[#1e1e1e] text-gray-300 hover:text-white hover:border-gray-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50') : ''}`}
            style={verConsolidado ? { backgroundColor: colorPrimario, borderColor: colorPrimario, color: '#fff' } : {}}
          >
            {verConsolidado ? <><LayoutList size={18} /> Ver Comandas</> : <><BarChart2 size={18} /> Consolidado</>}
          </button>

          {/* Terminar mi turno — marca la salida y vuelve al PIN */}
          {onCerrarTurno && (
            <button
              onClick={async () => { if (await confirmar('¿Terminar tu turno? Se marcará tu salida.', { titulo: 'Terminar turno', peligroso: false, icono: 'fi-rr-sign-out-alt', textoConfirmar: 'Terminar' })) onCerrarTurno(); }}
              className={`px-5 py-3 rounded-xl font-bold text-sm border transition-all flex justify-center items-center gap-2 text-red-500/80 hover:text-red-500 ${tema === 'dark' ? 'bg-[#121212] border-[#1e1e1e] hover:border-red-500/50' : 'bg-white border-gray-200 hover:border-red-300'}`}
              title="Terminar mi turno"
            >
              <LogOut size={18} /> Terminar Turno
            </button>
          )}
        </div>
      </header>

      {/* ÁREA PRINCIPAL */}
      <div className="p-6 flex-1 overflow-y-auto">
        {verConsolidado ? (
          /* VISTA CONSOLIDADA */
          <div className={`w-full max-w-3xl mx-auto rounded-2xl p-8 border animate-fadeIn ${tema === 'dark' ? 'bg-[#0a0a0a] border-[#1a1a1a]' : 'bg-white border-gray-200 shadow-sm'}`}>
            <h2 className={`font-bold mb-6 uppercase tracking-widest text-center text-xs flex items-center justify-center gap-2 ${tema === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
              <BarChart2 size={16} /> Resumen de Producción: {estacionActiva}
            </h2>
            <div className="space-y-3">
              {obtenerConsolidado().length > 0 ? (
                obtenerConsolidado().map(([nombre, cant]) => (
                  <div key={nombre} className={`flex justify-between items-center p-5 rounded-xl border ${tema === 'dark' ? 'bg-[#121212] border-[#1e1e1e]' : 'bg-gray-50 border-gray-100'}`}>
                    <span className="text-lg font-bold">{nombre}</span>
                    <span className="text-2xl font-black" style={{ color: colorPrimario }}>x{cant}</span>
                  </div>
                ))
              ) : (
                <div className="text-center flex flex-col items-center justify-center py-16">
                  <CheckCircle2 size={40} className="text-gray-500 mb-3 opacity-50" />
                  <p className="text-gray-500 font-bold text-sm">No hay platos pendientes en esta estación.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* GRID DE TICKETS */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 items-start content-start">
            {ordenesFiltradas.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-24 opacity-50">
                <ChefHat size={64} className="text-gray-500 mb-4" />
                <p className="text-gray-500 font-bold tracking-widest uppercase text-sm">Esperando comandas...</p>
              </div>
            )}

            {ordenesFiltradas.map(orden => {
              // Estilos base para la tarjeta (SaaS Moderno)
              let colorHeader = tema === 'dark' ? 'bg-[#121212] border-b border-[#1e1e1e]' : 'bg-gray-50 border-b border-gray-100';
              let badgeColor = tema === 'dark' ? 'bg-[#1a1a1a] text-green-400 border-[#222]' : 'bg-green-50 text-green-600 border-green-100';
              let textoTiempo = 'A tiempo';
              
              if (orden.minutos >= 10 && orden.minutos < 20) {
                colorHeader = tema === 'dark' ? 'bg-amber-500/5 border-b border-amber-500/10' : 'bg-amber-50/50 border-b border-amber-100';
                badgeColor = tema === 'dark' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-amber-100 text-amber-700 border-amber-200';
                textoTiempo = 'Demorado';
              } else if (orden.minutos >= 20) {
                colorHeader = tema === 'dark' ? 'bg-red-500/10 border-b border-red-500/20' : 'bg-red-50 border-b border-red-100';
                badgeColor = tema === 'dark' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-red-100 text-red-700 border-red-200';
                textoTiempo = '¡URGENTE!';
              }

              const todosListos = orden.items.every(i => i.listo);

              return (
                <div key={orden.kds_id} className={`w-full rounded-2xl overflow-hidden flex flex-col shadow-lg transition-all animate-fadeIn border ${tema === 'dark' ? 'bg-[#0a0a0a] border-[#1e1e1e]' : 'bg-white border-gray-200'}`}>
                  
                  {/* Card Header */}
                  <div className={`p-4 flex justify-between items-start ${colorHeader}`}>
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2 mb-1">
                        {orden.is_delivery ? <ShoppingBag size={14} className={tema === 'dark' ? 'text-gray-400' : 'text-gray-500'}/> : null}
                        <h2 className="text-lg font-bold tracking-tight truncate">{orden.origen}</h2>
                      </div>
                      <p className={`text-xs font-mono ${tema === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>#{orden.id}</p>
                    </div>
                    
                    <div className={`flex flex-col items-end px-3 py-1.5 rounded-lg border ${badgeColor}`}>
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} />
                        <span className="text-xl font-black font-mono leading-none">{orden.minutos}'</span>
                      </div>
                      <span className="text-[9px] uppercase tracking-widest font-bold mt-1 opacity-80">{textoTiempo}</span>
                    </div>
                  </div>

                  {/* Items de la Comanda */}
                  <div className="p-3 flex-1 space-y-2">
                    {orden.items.map(item => (
                      <button 
                        key={item.id}
                        onClick={() => tacharItem(orden.kds_id, item.id)}
                        className={`w-full text-left p-3 rounded-xl flex items-start gap-3 transition-all active:scale-[0.98] border ${item.listo ? (tema === 'dark' ? 'bg-[#050505] border-[#121212] opacity-40' : 'bg-gray-50 border-gray-100 opacity-50') : (tema === 'dark' ? 'bg-[#121212] border-[#1e1e1e] hover:border-gray-700' : 'bg-white border-gray-100 shadow-sm hover:border-gray-300')}`}
                      >
                        {/* Cantidad Badge */}
                        <div className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center font-bold text-sm border transition-colors ${item.listo ? 'bg-green-500/20 border-green-500/30 text-green-500' : (tema === 'dark' ? 'bg-[#1a1a1a] border-[#222]' : 'bg-gray-50 border-gray-200')}`} style={!item.listo ? { color: colorPrimario } : {}}>
                          {item.listo ? <Check size={16} /> : item.cant}
                        </div>
                        
                        <div className="flex-1 pt-0.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className={`font-semibold text-[15px] leading-tight truncate ${item.listo ? 'line-through' : (tema === 'dark' ? 'text-gray-200' : 'text-gray-800')}`}>
                              {item.nombre}
                            </p>
                            {item.agregado_reciente && !item.listo && (
                              <span className="bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/20 text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0">
                                <Bell size={10} /> Nuevo
                              </span>
                            )}
                          </div>
                          {item.notas && !item.listo && (
                            <p className={`text-xs mt-1.5 font-medium flex gap-1.5 items-start ${tema === 'dark' ? 'text-amber-400' : 'text-orange-600'}`}>
                              <AlertTriangle size={12} className="mt-0.5 shrink-0" /> 
                              <span className="leading-snug">{item.notas}</span>
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Card Footer / Botón Despachar */}
                  <div className={`p-3 border-t ${tema === 'dark' ? 'bg-[#050505] border-[#1e1e1e]' : 'bg-gray-50 border-gray-100'}`}>
                    <button 
                      onClick={() => despacharOrden(orden)}
                      className={`w-full py-3.5 rounded-xl font-bold text-sm tracking-widest uppercase transition-all flex items-center justify-center gap-2 active:scale-[0.98] text-white ${todosListos ? 'bg-green-600 hover:bg-green-500 shadow-[0_4px_15px_rgba(22,163,74,0.3)]' : 'opacity-90 hover:opacity-100'}`}
                      style={!todosListos ? { backgroundColor: colorPrimario } : {}}
                    >
                      {todosListos ? <><CheckCircle2 size={18} /> Despachar Ticket</> : 'Marcar Listo'}
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FOOTER: HISTORIAL */}
      {historial.length > 0 && (
        <footer className={`p-4 border-t flex gap-3 items-center overflow-x-auto scrollbar-hide z-10 ${tema === 'dark' ? 'bg-[#0a0a0a] border-[#1a1a1a]' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-2 pr-2 border-r border-gray-700/30">
            <Clock size={14} className={tema === 'dark' ? 'text-gray-500' : 'text-gray-400'} />
            <span className={`text-[10px] font-bold uppercase tracking-widest whitespace-nowrap ${tema === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>Recientes:</span>
          </div>
          {historial.map(h => (
            <button 
              key={h.kds_id}
              onClick={() => recuperarOrden(h)} 
              className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all whitespace-nowrap flex items-center gap-2 group ${tema === 'dark' ? 'bg-[#121212] border-[#1e1e1e] text-gray-300 hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400' : 'bg-white border-gray-200 text-gray-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600'}`}
            >
              <Undo2 size={14} className="text-gray-500 group-hover:text-red-500 transition-colors" />
              Recuperar {h.origen}
            </button>
          ))}
        </footer>
      )}
      
      {/* MODAL DEL BOT */}
      {solicitudesBot.length > 0 && (
        <ModalAlertaBot 
          solicitud={solicitudesBot[0]} 
          onResolver={manejarResolucionBot}
        />
      )}

    </div>
  );
}