import React, { useState } from 'react';
import usePosStore from '../../store/usePosStore';
import { cerrarSesionGlobal, crearTicket } from '../../api/api';

function ModalReportarProblema({ onClose }) {
  const [asunto, setAsunto] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const handleEnviar = async () => {
    if (!asunto.trim() || !mensaje.trim()) return;
    setEnviando(true);
    try {
      await crearTicket({ asunto, mensaje });
      setEnviado(true);
    } catch {
      alert('No se pudo enviar el reporte. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {enviado ? (
          <div className="text-center py-4">
            <i className="fi fi-rr-check-circle text-4xl text-emerald-500"></i>
            <p className="text-white font-black mt-3">¡Reporte enviado!</p>
            <p className="text-neutral-500 text-xs mt-1">Lo vamos a revisar pronto.</p>
            <button
              onClick={onClose}
              className="mt-5 px-6 py-2.5 rounded-xl bg-[#ff5a1f] text-white text-xs font-black uppercase tracking-widest"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <h3 className="text-white font-black text-sm mb-4">Reportar un problema</h3>
            <input
              value={asunto}
              onChange={(e) => setAsunto(e.target.value)}
              placeholder="¿Qué problema tuviste?"
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-600 mb-3 focus:outline-none focus:border-[#ff5a1f]"
            />
            <textarea
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder="Cuéntanos con detalle qué pasó…"
              rows={4}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-600 mb-4 focus:outline-none focus:border-[#ff5a1f]"
            />
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] text-neutral-400 text-xs font-black uppercase tracking-widest"
              >
                Cancelar
              </button>
              <button
                onClick={handleEnviar}
                disabled={enviando || !asunto.trim() || !mensaje.trim()}
                className="flex-1 py-2.5 rounded-xl bg-[#ff5a1f] text-white text-xs font-black uppercase tracking-widest disabled:opacity-40"
              >
                {enviando ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Erp_Sidebar({ 
  vistaActiva, 
  manejarCambioVista, 
  menuAbierto, 
  setMenuAbierto, 
  onVolverAlPos,
  isCollapsed,
  setIsCollapsed
}) {
  const { configuracionGlobal } = usePosStore();
  const colorPrimario = configuracionGlobal?.colorPrimario || '#ff5a1f';

  const rolUsuario = localStorage.getItem('usuario_rol') || 'Empleado';
  const esDueño = ['dueño', 'admin', 'administrador'].includes(rolUsuario.trim().toLowerCase());
  const modulos = configuracionGlobal?.modulos || {};
  const [mostrarReporte, setMostrarReporte] = useState(false);

  const [gruposExpandidos, setGruposExpandidos] = useState({
    "MONITOREO": true,
    "CATÁLOGO Y LOGÍSTICA": true,
    "ADMINISTRACIÓN": true,
    "ECOSISTEMA DIGITAL": true,
    "CONTABILIDAD": true
  });

  const toggleGrupo = (titulo) => {
    setGruposExpandidos(prev => ({ ...prev, [titulo]: !prev[titulo] }));
  };

  const gruposMenu = [
    {
      titulo: "MONITOREO",
      items: [
        { id: 'dashboard', icono: 'fi-rr-apps', nombre: 'Panel de Control', show: true },
      ]
    },
    {
      titulo: "CATÁLOGO Y LOGÍSTICA",
      items: [
        { id: 'menu', icono: 'fi-rr-room-service', nombre: 'Carta y Precios', show: true },
        { id: 'inventario', icono: 'fi-rr-boxes', nombre: 'Inventario y Recetas', show: modulos.inventario },
      ]
    },
    {
      titulo: "ADMINISTRACIÓN",
      items: [
        { id: 'sedes', icono: 'fi-rr-shop', nombre: 'Sedes y Mapa', show: esDueño }, 
        { id: 'personal', icono: 'fi-rr-users', nombre: 'Personal y Accesos', show: esDueño },
        { id: 'negocio', icono: 'fi-rr-settings', nombre: 'Mi Negocio y Plan', show: esDueño }, 
      ]
    },
    {
      titulo: "ECOSISTEMA DIGITAL",
      items: [
        { id: 'crm', icono: 'fi-rr-users-alt', nombre: 'Fidelización (CRM)', show: modulos.clientes },
        { id: 'bot_wsp', icono: 'fi-rr-robot', nombre: 'Bot WhatsApp', show: modulos.botWsp },
        { id: 'carta_qr', icono: 'fi-rr-qrcode', nombre: 'Carta QR Virtual', show: modulos.cartaQr },
      ]
    },
    {
      titulo: "CONTABILIDAD",
      items: [
        { id: 'facturacion', icono: 'fi-rr-receipt', nombre: 'Facturación SUNAT', show: modulos.facturacion },
      ]
    }
  ];

  const handleCerrarSesion = async () => {
    if (window.confirm("¿Estás seguro que deseas cerrar sesión?")) {
      await cerrarSesionGlobal(); 
    }
  };

  return (
    <>
      {menuAbierto && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-fadeIn"
          onClick={() => setMenuAbierto(false)}
        />
      )}

      <aside 
        className={`fixed inset-y-0 left-0 bg-[#0a0a0a] border-r border-[#222] z-50 flex flex-col transition-all duration-300 ease-in-out shadow-2xl
          ${isCollapsed ? 'w-20' : 'w-72'} 
          ${menuAbierto ? 'translate-x-0' : '-translate-x-full'} 
          md:translate-x-0
        `}
      >
        <div className={`p-6 flex items-center shrink-0 h-24 relative ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className={`overflow-hidden transition-all duration-300 flex flex-col ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
            <h1 className="text-2xl font-black text-white tracking-tight whitespace-nowrap">
              LEYBRAK <span style={{ color: colorPrimario }}>POS</span>
            </h1>
            <p className="text-[10px] text-neutral-500 font-bold tracking-widest uppercase mt-0.5">SaaS Platform</p>
          </div>
          
          {isCollapsed && (
            <div className="absolute text-2xl font-black text-white bg-[#1a1a1a] w-12 h-12 rounded-xl flex items-center justify-center border border-[#333]">
              B<span style={{ color: colorPrimario }}>.</span>
            </div>
          )}

          <button 
            onClick={() => window.innerWidth < 768 ? setMenuAbierto(false) : setIsCollapsed(!isCollapsed)}
            className="w-8 h-8 rounded-full bg-[#1a1a1a] hover:bg-[#222] border border-[#333] flex items-center justify-center text-neutral-400 hover:text-white transition-colors absolute -right-4 top-8 shadow-lg z-10 hidden md:flex"
          >
            <i className={`fi ${isCollapsed ? 'fi-rr-angle-right' : 'fi-rr-angle-left'} text-xs mt-1`}></i>
          </button>
          
          <button 
            onClick={() => setMenuAbierto(false)}
            className="md:hidden text-neutral-400 hover:text-white"
          >
            <i className="fi fi-rr-cross"></i>
          </button>
        </div>

        {/* 🛠️ SOLUCIÓN 1: Si está colapsado, reducimos el padding (px-2) para darle aire a los botones */}
        <nav className={`flex-1 overflow-y-auto custom-scrollbar pb-6 mt-2 space-y-2 ${isCollapsed ? 'px-2' : 'px-4'}`}>
          {gruposMenu.map((grupo, index) => {
            const itemsVisibles = grupo.items.filter(item => item.show);
            if (itemsVisibles.length === 0) return null;

            const isExpanded = isCollapsed || gruposExpandidos[grupo.titulo];

            return (
              <div key={index} className={`flex flex-col relative group ${isCollapsed ? 'mb-2' : 'border-b border-[#1a1a1a] pb-2 mb-2 last:border-0'}`}>
                
                {!isCollapsed && (
                  <button 
                    onClick={() => toggleGrupo(grupo.titulo)}
                    className="w-full flex items-center justify-between px-2 py-3 cursor-pointer hover:bg-[#111] rounded-lg transition-colors group/header"
                  >
                    <span className="text-[10px] font-black text-neutral-500 tracking-widest uppercase transition-colors group-hover/header:text-neutral-300">
                      {grupo.titulo}
                    </span>
                    <i className={`fi ${gruposExpandidos[grupo.titulo] ? 'fi-rr-angle-up' : 'fi-rr-angle-down'} text-neutral-600 text-[10px] transition-transform`}></i>
                  </button>
                )}

                <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                  <div className="overflow-hidden flex flex-col gap-1">
                    {itemsVisibles.map(item => {
                      const isActivo = vistaActiva === item.id;
                      return (
                        <button 
                          key={item.id}
                          onClick={() => {
                            manejarCambioVista(item.id);
                            if (window.innerWidth < 768) setMenuAbierto(false); 
                          }}
                          // 🛠️ 1. Cambiamos transition-all por transition-colors y agregamos overflow-hidden
                          className={`relative flex items-center rounded-xl transition-colors duration-200 group/btn overflow-hidden
                            ${isCollapsed ? 'justify-center mx-auto w-12 h-12' : 'px-4 py-3 gap-4 w-full'}
                            ${!isActivo ? 'text-neutral-400 hover:bg-[#1a1a1a] hover:text-white' : 'font-bold shadow-lg'}
                          `}
                          // 🛠️ 2. Dejamos el style súper limpio (solo color y fondo)
                          style={isActivo ? { 
                            backgroundColor: `${colorPrimario}15`, 
                            color: colorPrimario
                          } : {}}
                          title={isCollapsed ? item.nombre : ''} 
                        >
                          {/* 🛠️ 3. LA LÍNEA MÁGICA: Un div absoluto que no interfiere con bordes */}
                          {!isCollapsed && isActivo && (
                            <div 
                              className="absolute right-0 top-0 bottom-0 w-[4px] rounded-l-full animate-fadeIn"
                              style={{ backgroundColor: colorPrimario }}
                            />
                          )}

                          <i className={`fi ${item.icono} text-lg transition-transform duration-300 ${isActivo ? 'scale-110' : 'opacity-70 group-hover/btn:scale-110'} mt-1`}></i>
                          
                          {!isCollapsed && (
                            <span className="text-sm font-medium tracking-wide whitespace-nowrap">
                              {item.nombre}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        <div className={`p-4 border-t border-[#1a1a1a] bg-[#050505] shrink-0 transition-all duration-300 ${isCollapsed ? 'flex flex-col items-center gap-4' : 'space-y-3'}`}>
          <button 
            onClick={onVolverAlPos} 
            className={`text-white rounded-xl font-bold hover:brightness-110 active:scale-95 transition-all flex items-center justify-center shadow-lg
              ${isCollapsed ? 'w-12 h-12 text-xl' : 'w-full py-3 gap-3 text-sm'}
            `}
            style={{ backgroundColor: colorPrimario, boxShadow: `0 4px 15px ${colorPrimario}30` }}
            title={isCollapsed ? "Terminal POS" : ""}
          >
            <i className="fi fi-rr-computer mt-1"></i>
            {!isCollapsed && <span>Terminal POS</span>}
          </button>

          <button
            onClick={() => setMostrarReporte(true)}
            className={`text-neutral-500 hover:text-white hover:bg-[#1a1a1a] transition-colors flex items-center justify-center border border-transparent hover:border-[#2a2a2a]
              ${isCollapsed ? 'w-12 h-12 rounded-xl text-xl' : 'w-full py-2.5 rounded-xl gap-3 font-medium text-sm'}
            `}
            title={isCollapsed ? "Reportar un problema" : ""}
          >
            <i className="fi fi-rr-life-ring mt-1"></i>
            {!isCollapsed && <span>Reportar un problema</span>}
          </button>

          {mostrarReporte && <ModalReportarProblema onClose={() => setMostrarReporte(false)} />}

          <button
            onClick={handleCerrarSesion}
            className={`text-neutral-500 hover:text-red-500 hover:bg-red-500/10 transition-colors flex items-center justify-center
              ${isCollapsed ? 'w-12 h-12 rounded-xl text-xl' : 'w-full py-2.5 rounded-xl gap-3 font-medium text-sm'}
            `}
            title={isCollapsed ? "Cerrar Sesión" : ""}
          >
            <i className="fi fi-rr-exit mt-1"></i>
            {!isCollapsed && <span>Cerrar Sesión</span>}
          </button>
        </div>
      </aside>
    </>
  );
}