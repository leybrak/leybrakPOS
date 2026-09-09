import React, { useState, useEffect, useRef } from 'react';
import api from '../../api/api';
import usePosStore from '../../store/usePosStore';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { 
  Bot, Plug, MessageSquare, CheckCircle, Power, 
  Smartphone, Loader2, QrCode, Check, Timer,
  Gift, Megaphone, Settings, Clock, ShieldCheck, Bike // 👈 Nuevos íconos
} from 'lucide-react';
import Bot_Operaciones from './BotComponents/Bot_Operaciones';
import Bot_Marketing from './BotComponents/Bot_Marketing';
import Bot_Delivery from './BotComponents/Bot_Delivery';
import Bot_QrModal from './BotComponents/Bot_QrModal';
export default function Erp_BotWsp({ sedesReales = [], onRefrescar , productosReales = []}) {
  const toast = useToast();
  const confirmar = useConfirm();
  const { configuracionGlobal } = usePosStore();
  const colorPrimario = configuracionGlobal?.colorPrimario || '#ff5a1f';
  const temaFondo = configuracionGlobal?.temaFondo || 'dark';
  const isDark = temaFondo === 'dark';
  
  const rolUsuario = localStorage.getItem('usuario_rol') || '';
  const esDueño = ['dueño', 'admin', 'administrador'].includes(rolUsuario.trim().toLowerCase());
  const sedeAsignada = localStorage.getItem('sede_id');
  const [tabActiva, setTabActiva] = useState('conexion'); 
  
  const [loadingAction, setLoadingAction] = useState(null);
  const [sedeActivaId, setSedeActivaId] = useState('');

  // ✨ ESTADOS DEL MODAL QR Y TEMPORIZADOR
  const [qrModal, setQrModal] = useState({ open: false, qrBase64: '', sedeId: null, sedeNombre: '' });
  const [tiempoQr, setTiempoQr] = useState(40);
  const [qrEscaneado, setQrEscaneado] = useState(false);
  const [operaciones, setOperaciones] = useState({
    ingresoAutomatico: true,
    maxPedidos: 20, // ¿Pasa directo a cocina o requiere clic en Caja?
    deliveryActivo: true,    // Para apagarlo si llueve o no hay motorizado
    puntosActivos: true,
    cumpleActivo: false,
    cumpleValor: '', 
    cumpleMinimo: '',
    cumpleTipo: 'porcentaje',
    cumpleProductos: []
  });
  const ultimaSedeCargada = useRef(null);
  // ==========================================
  // ⏱️ EFECTO: TEMPORIZADOR Y AUTOCIERRE DEL QR
  // ==========================================
  // ==========================================
  // ⏱️ EFECTO: TEMPORIZADOR Y AUTOCIERRE DEL QR
  // ==========================================
  useEffect(() => {
    let intervaloTiempo;
    let intervaloEstado;

    if (qrModal.open && !qrEscaneado) {
      // 1. Cuenta regresiva visual (40 segundos)
      intervaloTiempo = setInterval(() => {
        setTiempoQr((prev) => {
          if (prev <= 1) {
            setQrModal({ open: false, qrBase64: '', sedeId: null, sedeNombre: '' });
            toast.warning('El código QR expiró. Genera uno nuevo.');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // 2. Espía silencioso: Pregunta a Django cada 3 segundos si ya se escaneó
      intervaloEstado = setInterval(async () => {
        try {
          const res = await api.get(`/sedes/${qrModal.sedeId}/estado_conexion/`);
          if (res.data.estado === 'conectado') {
            setQrEscaneado(true);
            setTimeout(() => {
              setQrModal({ open: false, qrBase64: '', sedeId: null, sedeNombre: '' });
              setQrEscaneado(false);
              // ✅ En lugar de setSedesVisibles, le pedimos al padre que refresque los datos
              if (onRefrescar) onRefrescar(); 
            }, 2500);
          }
        } catch (error) {
          console.error("Esperando conexión...");
        }
      }, 3000);
    }

    return () => {
      clearInterval(intervaloTiempo);
      clearInterval(intervaloEstado);
    };
    // 👇 AQUÍ ESTÁ LA SOLUCIÓN: Agregamos onRefrescar a las dependencias
  }, [qrModal.open, qrEscaneado, qrModal.sedeId, onRefrescar]);
  // 1️⃣ FILTRAR SEDES Y AUTO-SELECCIONAR LA PRIMERA
  // 1️⃣ FILTRAR SEDES Y AUTO-SELECCIONAR LA PRIMERA
  // ✅ 1. DATOS CALCULADOS AL VUELO (Adiós cascading renders)
  const sedesVisibles = React.useMemo(() => {
    let filtradas = sedesReales || [];
    if (!esDueño && sedeAsignada) {
      filtradas = filtradas.filter(s => String(s.id) === String(sedeAsignada));
    }
    return filtradas;
  }, [sedesReales, esDueño, sedeAsignada]);

  const numerosWsp = React.useMemo(() => {
    const nums = {};
    sedesVisibles.forEach(s => { nums[s.id] = s.whatsapp_numero || ''; });
    return nums;
  }, [sedesVisibles]);

  const linksCarta = React.useMemo(() => {
    const links = {};
    sedesVisibles.forEach(s => { links[s.id] = s.enlace_carta_virtual || ''; });
    return links;
  }, [sedesVisibles]);

  // ✅ 2. AUTO-SELECCIONAR LA SEDE ACTIVA (Anti-Cascading Render)
  useEffect(() => {
    if (!sedeActivaId && sedesVisibles.length > 0) {
      // Lo mandamos al "macrotask queue" para que React no llore
      setTimeout(() => {
        setSedeActivaId(sedesVisibles[0].id);
      }, 0);
    }
  }, [sedesVisibles, sedeActivaId]);

  
  // ✅ 3. CARGAR DATOS AL CAMBIAR DE SEDE (Anti-Cascading Render)
  useEffect(() => {
    if (sedeActivaId && sedesVisibles.length > 0) {
      const sedeActual = sedesVisibles.find(s => String(s.id) === String(sedeActivaId));
      
      if (sedeActual && ultimaSedeCargada.current !== sedeActivaId) {
        
        // Retrasamos la actualización 0ms para romper el ciclo síncrono
        setTimeout(() => {
          setOperaciones({
            // Operaciones normales
            ingresoAutomatico: sedeActual.bot_ingreso_automatico !== false,
            maxPedidos: parseInt(sedeActual.bot_max_pedidos_pendientes) || 20,
            puntosActivos: sedeActual.bot_puntos_activos !== false,
            
            // ✨ AHORA SÍ: Todos los campos nuevos del cumpleaños
            cumpleActivo: sedeActual.bot_cumple_activo || false,
            cumpleTipo: sedeActual.bot_cumple_tipo || 'porcentaje',
            cumpleValor: sedeActual.bot_cumple_valor || '',
            cumpleMinimo: sedeActual.bot_cumple_minimo || '',
            cumpleProductos: sedeActual.bot_cumple_productos || [] // 👈 El casco de seguridad
          });
          
          ultimaSedeCargada.current = sedeActivaId; // 👈 ¡AQUÍ ESTÁ LA CORRECCIÓN!
          
        }, 0);

      }
    }
  }, [sedeActivaId, sedesVisibles]);
  // ==========================================
  // FUNCIONES DE CONEXIÓN
  // ==========================================
  const manejarVincularWsp = async (sede) => {
    setLoadingAction(`vincular_${sede.id}`);
    try {
      const response = await api.post(`/sedes/${sede.id}/crear_instancia_whatsapp/`);
      
      // ✅ Instancia creada en backend. Abrimos el modal directamente.
      setTiempoQr(40);
      setQrEscaneado(false);
      setQrModal({ open: true, qrBase64: response.data.qr_base64, sedeId: sede.id, sedeNombre: sede.nombre });
      
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Error al conectar. Intenta de nuevo.');
    } finally {
      setLoadingAction(null);
    }
  };

  const manejarDesvincularWsp = async (sedeId) => {
    if (!(await confirmar('¿Estás seguro de desconectar el Bot?', { titulo: 'Desconectar bot', peligroso: true }))) return;
    setLoadingAction(`desvincular_${sedeId}`);
    try {
      await api.delete(`/sedes/${sedeId}/eliminar_instancia/`);
      if (onRefrescar) onRefrescar();
      toast.success('Bot desconectado correctamente.');
    } catch (error) {
      toast.error('Error al desconectar el Bot.');
    } finally {
      setLoadingAction(null);
    }
  };

  const manejarGuardarNumero = async (sedeId) => {
    setLoadingAction(`numero_${sedeId}`);
    try {
      await api.patch(`/sedes/${sedeId}/`, { whatsapp_numero: numerosWsp[sedeId] });
      toast.success('Número guardado correctamente.');
    } catch (error) {
      toast.error('Error al guardar el número.');
    } finally {
      setLoadingAction(null);
    }
  };

  // ✨ Función para cancelar y borrar lo que se creó a medias
  const manejarCancelarVinculacion = async () => {
    if (qrModal.sedeId) {
      setLoadingAction(`desvincular_${qrModal.sedeId}`);
      try {
        await api.delete(`/sedes/${qrModal.sedeId}/eliminar_instancia/`);
        // ✅ Refrescamos los datos desde la base de datos
        if (onRefrescar) onRefrescar(); 
      } catch (error) {
        console.error("Error al limpiar instancia cancelada");
      } finally {
        setLoadingAction(null);
      }
    }
    setQrModal({ open: false, qrBase64: '', sedeId: null, sedeNombre: '' });
  };

  // ✨ FUNCIÓN MAESTRA PARA GUARDAR TODA LA CONFIGURACIÓN DEL BOT
  const manejarGuardarOperaciones = async () => {
    // Tomamos el ID de la sede actual (asegurando compatibilidad con tu código actual)
    const sedeId = sedeActivaId || sedesVisibles[0]?.id; 
    if (!sedeId) { toast.warning('Selecciona una sede primero.'); return; }

    setLoadingAction('guardar_operaciones');
    try {
      await api.patch(`/sedes/${sedeId}/`, {
        // 1. Operaciones 
        bot_ingreso_automatico: operaciones.ingresoAutomatico,
        bot_max_pedidos_pendientes: operaciones.maxPedidos,
        
        // 2. Sistema de Puntos
        bot_puntos_activos: operaciones.puntosActivos,
        
        // 3. ✨ El Nuevo Motor Cumpleañero
        bot_cumple_activo: operaciones.cumpleActivo,
        bot_cumple_tipo: operaciones.cumpleTipo,
        // Mandamos null si los campos están vacíos para no romper el DecimalField de Django
        bot_cumple_valor: operaciones.cumpleValor || null, 
        bot_cumple_minimo: operaciones.cumpleMinimo || null,
        bot_cumple_productos: operaciones.cumpleProductos || []
      });
      
      toast.success('Configuraciones del Bot guardadas correctamente.');
      
      // Llamamos a tu función para que refresque visualmente sin presionar F5
      if (onRefrescar) onRefrescar();
      
    } catch (error) {
      console.error("Error guardando config del bot:", error);
      toast.error('Error al guardar las configuraciones.');
    } finally {
      setLoadingAction(null);
    }
  };
  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fadeIn pb-20">
      
      {/* ========== 🏗️ 1. CABECERA INTEGRADA ========== */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-6 pt-2 pb-6 border-b" style={{ borderColor: isDark ? '#222' : '#e5e7eb' }}>
        
        {/* ✨ Título e Ícono */}
        <div className="flex items-center gap-5">
          <div 
            className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: colorPrimario + '15', color: colorPrimario }}
          >
            <Bot size={32} strokeWidth={1.5} />
          </div>
          <div>
            <h2 className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Asistente <span style={{ color: colorPrimario }}>Virtual</span>
            </h2>
            <p className={`text-sm mt-1 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
              Conecta tu WhatsApp y automatiza la atención de tus clientes.
            </p>
          </div>
        </div>

        {/* ✨ NUEVO: SELECTOR DE SEDE */}
        <div className="flex items-center gap-3">
          <span className={`text-[10px] font-black uppercase tracking-widest hidden sm:block ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
            Configurando sede:
          </span>
          <select
            value={sedeActivaId}
            onChange={(e) => setSedeActivaId(e.target.value)}
            className={`border px-4 py-2.5 rounded-xl outline-none font-bold text-sm cursor-pointer appearance-none min-w-[200px] transition-colors shadow-sm`}
            style={{
              backgroundColor: isDark ? '#111' : '#fff',
              color: isDark ? '#fff' : '#111',
              borderColor: isDark ? '#333' : '#e5e7eb',
              backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22${isDark ? 'fff' : '666'}%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right .7rem top 50%',
              backgroundSize: '.65rem auto',
            }}
          >
            {sedesVisibles?.map(sede => (
              <option key={sede.id} value={sede.id}>{sede.nombre}</option>
            ))}
          </select>
        </div>
        
      </div>

      {/* 🔘 NUEVA NAVEGACIÓN DE PESTAÑAS */}
      <div className={`flex gap-8 border-b overflow-x-auto custom-scrollbar ${isDark ? 'border-[#222]' : 'border-gray-200'}`}>
        {[
          { id: 'conexion', label: 'Conexión WhatsApp', icon: Plug },
          { id: 'reglas', label: 'Comportamiento', icon: Settings },
          { id: 'delivery', label: 'Zonas de Delivery', icon: Bike },
          { id: 'marketing', label: 'Marketing y Difusión', icon: Megaphone },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button 
              key={tab.id} onClick={() => setTabActiva(tab.id)}
              className="pb-4 text-sm font-bold transition-all flex items-center gap-2 border-b-2 whitespace-nowrap"
              style={tabActiva === tab.id 
                ? { color: colorPrimario, borderBottomColor: colorPrimario } 
                : { color: isDark ? '#737373' : '#9ca3af', borderColor: 'transparent' }}
            >
              <Icon size={16} /> {tab.label}
            </button>
          )
        })}
      </div>

      {/* ========================================== */}
      {/* 🟢 PESTAÑA 1: CONEXIÓN WHATSAPP */}
      {/* ========================================== */}
      {tabActiva === 'conexion' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn">
          {sedesVisibles.map((sede) => {
            const estaConectado = sede.whatsapp_instancia || sede.estado_fake === 'conectado';

            return (
              <div key={sede.id} className={`rounded-[2rem] overflow-hidden flex flex-col transition-all border ${
                isDark ? 'bg-[#111] border-[#2a2a2a]' : 'bg-white border-gray-200 shadow-sm'
              }`}>
                
                {/* Header Sede */}
                <div className={`p-6 border-b flex justify-between items-start ${isDark ? 'bg-[#161616] border-[#222]' : 'bg-gray-50 border-gray-100'}`}>
                  <div>
                    <h3 className={`text-xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>{sede.nombre}</h3>
                    <span className="text-[10px] font-bold text-neutral-500 mt-1 block uppercase tracking-wider">Gestión de línea</span>
                  </div>
                  <div className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 border ${
                    estaConectado 
                      ? (isDark ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-green-50 text-green-600 border-green-200')
                      : (isDark ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-red-50 text-red-600 border-red-200')
                  }`}>
                    {estaConectado 
                      ? <><span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> CONECTADO</> 
                      : <><span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span> DESCONECTADO</>}
                  </div>
                </div>

                <div className="p-6 flex flex-col gap-6 flex-1">
                  
                  {/* Tarjeta de Estado Principal */}
                  <div 
                    className={`p-6 rounded-2xl border flex flex-col items-center justify-center text-center transition-all h-full ${
                      !estaConectado && !isDark ? 'bg-gray-50 border-gray-200 border-dashed' : ''
                    } ${!estaConectado && isDark ? 'bg-[#141414] border-[#333] border-dashed' : ''}`} 
                    style={estaConectado ? { borderColor: colorPrimario + '40', backgroundColor: colorPrimario + '0a' } : {}}
                  >
                    {estaConectado ? (
                      <div className="flex flex-col items-center gap-4 w-full">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-2" style={{ backgroundColor: colorPrimario + '20', color: colorPrimario }}>
                          <CheckCircle size={32} />
                        </div>
                        <div>
                          <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>Bot operando con normalidad</p>
                          <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mt-1">ID: {sede.id}00{sede.negocio_id}</p>
                        </div>
                        <button 
                          onClick={() => manejarDesvincularWsp(sede.id)}
                          disabled={loadingAction === `desvincular_${sede.id}`}
                          className={`w-full mt-4 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-colors disabled:opacity-50 border flex justify-center items-center gap-2 ${
                            isDark ? 'bg-red-500/10 hover:bg-red-500/20 text-red-500 border-red-500/20' : 'bg-red-50 hover:bg-red-100 text-red-600 border-red-200'
                          }`}
                        >
                          <Power size={16} /> {loadingAction === `desvincular_${sede.id}` ? 'Desconectando...' : 'Desconectar Bot'}
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-4 w-full">
                        <Smartphone size={40} className={isDark ? 'text-neutral-600 mb-2' : 'text-gray-400 mb-2'} strokeWidth={1.5} />
                        <div>
                          <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>No hay celular conectado</p>
                          <p className={`text-xs mt-1 px-4 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>Vincula tu WhatsApp para automatizar pedidos.</p>
                        </div>
                        <button 
                          onClick={() => manejarVincularWsp(sede)}
                          disabled={loadingAction === `vincular_${sede.id}`}
                          className="w-full mt-4 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50 text-white shadow-lg active:scale-95 flex items-center justify-center gap-2"
                          style={{ backgroundColor: colorPrimario, boxShadow: `0 8px 20px ${colorPrimario}30` }}
                        >
                          {loadingAction === `vincular_${sede.id}` ? (
                            <><Loader2 className="animate-spin" size={16} /> Iniciando Motor...</>
                          ) : (
                            <><QrCode size={16} /> Conectar WhatsApp</>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Número de Referencia */}
                  <div className={`space-y-3 pt-4 border-t ${isDark ? 'border-[#222]' : 'border-gray-200'}`}>
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block">Número Referencial (Opcional)</label>
                    <div className="flex gap-2">
                      <input 
                        type="tel" 
                        className={`flex-1 border px-4 py-3 rounded-xl outline-none transition-colors font-medium text-sm focus:border-current ${
                          isDark ? 'bg-[#0a0a0a] border-[#333] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                        }`}
                        style={{ '--tw-ring-color': colorPrimario }} onFocus={(e) => e.target.style.borderColor = colorPrimario} onBlur={(e) => e.target.style.borderColor = isDark ? '#333' : '#e5e7eb'}
                        placeholder="Ej: +51 987 654 321"
                        value={numerosWsp[sede.id] || ''}
                        onChange={(e) => setNumerosWsp({ ...numerosWsp, [sede.id]: e.target.value })}
                      />
                      <button 
                        onClick={() => manejarGuardarNumero(sede.id)} disabled={loadingAction === `numero_${sede.id}`}
                        className={`px-5 py-3 rounded-xl font-bold transition-colors text-xs border ${
                          isDark ? 'bg-[#222] hover:bg-[#333] text-white border-[#333]' : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200'
                        }`}
                      >
                        {loadingAction === `numero_${sede.id}` ? '...' : 'Guardar'}
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* ========================================== */}
      {/* ⚙️ PESTAÑA 2: COMPORTAMIENTO (Operaciones) */}
      {/* ========================================== */}
      {tabActiva === 'reglas' && (
        <Bot_Operaciones 
          operaciones={operaciones}
          setOperaciones={setOperaciones}
          manejarGuardarOperaciones={manejarGuardarOperaciones}
          loadingAction={loadingAction}
          isDark={isDark}
          colorPrimario={colorPrimario}
        />
      )}
      
      
      {tabActiva === 'delivery' && (
        <Bot_Delivery
          sede={sedesVisibles.find(s => String(s.id) === String(sedeActivaId)) || sedesVisibles[0]}
          isDark={isDark}
          colorPrimario={colorPrimario}
        />
      )}

      {tabActiva === 'marketing' && (
        <Bot_Marketing sedesReales={sedesVisibles} isDark={isDark} colorPrimario={colorPrimario} />
      )}
      {/* ========== MODAL DEL QR (MODULARIZADO) ========== */}
      <Bot_QrModal 
        qrModal={qrModal}
        isDark={isDark}
        qrEscaneado={qrEscaneado}
        tiempoQr={tiempoQr}
        manejarCancelarVinculacion={manejarCancelarVinculacion}
        loadingAction={loadingAction}
      />

    </div>
  );
}