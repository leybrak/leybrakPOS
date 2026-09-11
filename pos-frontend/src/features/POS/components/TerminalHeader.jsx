import React from 'react';
import { useConfirm } from '../../../context/ConfirmContext';

export default function TerminalHeader({
  colorPrimario, vistaLocal, mesaSeleccionada, esDueño,
  sedes, sedeActualId, manejarCambioSede, modoUnir, setModoUnir,
  setMesaPrincipal, modSalonActivo, modLlevarActivo, setVistaLocal,
  ordenesLlevar, setDrawerVentaRapidaAbierto, rolUsuario, onIrAErp,
  setModalMovimientosAbierto, manejarCierreCajaSeguro, onCerrarTurno,
  esTienda
}) {
  const confirmar = useConfirm();
  return (
    // Estilo ERP: Fondo sólido oscuro, borde tenue, sin sombras ni blur
    <header className={`px-4 py-3 md:px-6 md:py-4 sticky top-0 z-10 border-b bg-[#111] border-[#222] transition-all ${mesaSeleccionada ? 'hidden lg:block' : 'block'}`}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        
        {/* LADO IZQUIERDO: Título y Estado */}
        <div className="flex justify-between items-center w-full sm:w-auto shrink-0">
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight uppercase leading-none text-white flex items-center gap-2">
              {esTienda ? (
                <><span style={{ color: colorPrimario }}>Tienda</span></>
              ) : vistaLocal === 'salon' ? (
                <>Salón <span style={{ color: colorPrimario }}>Principal</span></>
              ) : (
                <>Para <span style={{ color: colorPrimario }}>Llevar</span></>
              )}
            </h1>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Operación en vivo</span>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: colorPrimario }}></span>
            </div>
          </div>

          {/* Selector de Sede (Móvil) */}
          {esDueño && sedes?.length > 1 &&(
            <select 
              value={sedeActualId || ''} 
              onChange={(e) => manejarCambioSede(e.target.value)} 
              className="sm:hidden text-[10px] font-bold px-2 py-1.5 rounded-xl outline-none bg-[#141414] text-white border border-[#222]" 
              style={{ color: colorPrimario }}
            >
              <option value="" disabled>Sede...</option>
              {sedes?.map(sede => <option key={sede.id} value={String(sede.id)}>{sede.nombre}</option>)}
            </select>
          )}
        </div>
        
        {/* LADO DERECHO: Herramientas y Controles */}
        {/* 🛠️ SOLUCIÓN: Cambiamos overflow-x-auto por flex-wrap temporalmente si el contador se corta por el scrollbar-hide, 
            o le damos un poco de padding superior/derecho (pt-2 pr-2) para que el badge tenga espacio. */}
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto py-2 sm:py-0 overflow-visible pt-2 pr-2 sm:pr-0">
          
          {/* Selector de Sede (Desktop) */}
          {esDueño && sedes?.length > 1 &&(
            <div className="hidden sm:flex items-center gap-2.5 px-4 py-2 rounded-xl border bg-[#141414] border-[#222] shrink-0">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Sede:</span>
              <select 
                value={sedeActualId || ''} 
                onChange={(e) => manejarCambioSede(e.target.value)} 
                className="text-xs font-bold outline-none cursor-pointer appearance-none bg-transparent text-white" 
                style={{ color: colorPrimario }}
              >
                <option value="" disabled>Seleccionar...</option>
                {sedes?.map(sede => <option key={sede.id} value={String(sede.id)}>{sede.nombre}</option>)}
              </select>
            </div>
          )}

          {/* Separador */}
          {esDueño && sedes?.length > 1 && <div className="w-px h-8 hidden sm:block bg-[#333] mx-1"></div>}

          <div className="flex items-center gap-2 shrink-0">
            {vistaLocal === 'salon' && (
              <button 
                onClick={() => { setModoUnir(!modoUnir); setMesaPrincipal(null); }} 
                className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center border transition-all ${
                  modoUnir 
                    ? 'text-white' 
                    : 'bg-[#141414] border-[#333] text-neutral-400 hover:text-white hover:border-neutral-500'
                }`} 
                style={modoUnir ? { backgroundColor: colorPrimario, borderColor: colorPrimario } : {}} 
                title="Unir Mesas"
              >
                <i className="fi fi-rr-link mt-0.5 text-lg"></i>
              </button>
            )}

            {modSalonActivo && modLlevarActivo && (
              <button 
                onClick={() => { if (vistaLocal === 'salon') { setVistaLocal('llevar'); setModoUnir(false); } else { setVistaLocal('salon'); } }} 
                // 🛠️ SOLUCIÓN: Mantenemos el relative, pero quitamos cualquier hidden indeseado
                className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center border transition-all bg-[#141414] border-[#333] text-neutral-400 hover:text-white hover:border-neutral-500"
              >
                {vistaLocal === 'salon' ? (
                  <>
                    <i className="fi fi-rr-motorcycle mt-0.5 text-lg"></i>
                    {/* 🛠️ SOLUCIÓN: Ajustamos la posición (-top-2 -right-2) y el tamaño (w-5 h-5) para que respire */}
                    <span className="absolute -top-2 -right-2 w-5 h-5 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-[1.5px] border-[#111]" style={{ backgroundColor: colorPrimario }}>
                      {ordenesLlevar?.length || 0}
                    </span>
                  </>
                ) : (
                  <i className="fi fi-rr-restaurant mt-0.5 text-lg"></i>
                )}
              </button>
            )}

            {/* Botón Venta Rápida (Acento) — no aplica en modo Tienda: el catálogo
                completo YA es la pantalla principal, no hace falta un atajo. */}
            {!esTienda && (
              <button
                onClick={() => setDrawerVentaRapidaAbierto(true)}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center border transition-all active:scale-95"
                style={{ backgroundColor: `${colorPrimario}15`, borderColor: `${colorPrimario}30`, color: colorPrimario }}
                title="Venta Rápida"
              >
                <i className="fi fi-rr-bolt mt-0.5 text-lg"></i>
              </button>
            )}

            {/* Terminar mi turno (todos los roles — marca la salida y vuelve al PIN) */}
            {onCerrarTurno && (
              <button
                onClick={async () => { if (await confirmar('¿Terminar tu turno? Se marcará tu salida.', { titulo: 'Terminar turno', peligroso: false, icono: 'fi-rr-sign-out-alt', textoConfirmar: 'Terminar' })) onCerrarTurno(); }}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center border transition-all bg-[#141414] border-[#333] text-red-500/70 hover:text-red-500 hover:border-red-500/50"
                title="Terminar mi turno"
              >
                <i className="fi fi-rr-sign-out-alt mt-0.5 text-lg"></i>
              </button>
            )}
          </div>

          {['administrador', 'admin', 'cajero', 'dueño'].includes(rolUsuario?.toLowerCase()) && (
            <>
              <div className="w-px h-8 hidden sm:block bg-[#333] mx-1"></div>
              <div className="flex items-center gap-2 shrink-0">
                
                {/* Controles Administrativos */}
                {['administrador', 'admin', 'dueño'].includes(rolUsuario?.toLowerCase()) && (
                  <button 
                    onClick={onIrAErp} 
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center border transition-all bg-[#141414] border-[#333] text-neutral-400 hover:text-white hover:border-neutral-500"
                    title="Panel de Control (ERP)"
                  >
                    <i className="fi fi-rr-apps mt-0.5 text-lg"></i>
                  </button>
                )}
                <button 
                  onClick={() => setModalMovimientosAbierto(true)} 
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center border transition-all bg-[#141414] border-[#333] text-neutral-400 hover:text-white hover:border-neutral-500"
                  title="Caja Chica"
                >
                  <i className="fi fi-rr-money-bill-wave mt-0.5 text-lg"></i>
                </button>
                <button 
                  onClick={manejarCierreCajaSeguro} 
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center border transition-all bg-[#141414] border-[#333] text-red-500/70 hover:text-red-500 hover:border-red-500/50"
                  title="Cerrar Turno"
                >
                  <i className="fi fi-rr-lock mt-0.5 text-lg"></i>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}