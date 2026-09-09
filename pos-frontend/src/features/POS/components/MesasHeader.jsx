import React from 'react';

export default function MesasHeader({
  colorPrimario, vistaLocal, esDueño, sedes, sedeActualId, manejarCambioSede,
  modoUnir, setModoUnir, setMesaPrincipal, modSalonActivo, modLlevarActivo,
  setVistaLocal, ordenesLlevar, setDrawerVentaRapidaAbierto, rolUsuario,
  onIrAErp, setModalMovimientosAbierto, manejarCierreCajaSeguro
}) {
  // Nombre de la sede actualmente seleccionada
  const sedeActual = sedes?.find(s => String(s.id) === String(sedeActualId));
  const nombreSede = sedeActual?.nombre || 'Principal';

  return (
    <header className="px-4 py-4 md:px-5 md:pt-6 md:pb-5 sticky top-0 z-10 border-b bg-[#0a0a0a]/95 border-[#222] backdrop-blur-md shadow-xl">
      <div className="flex justify-between items-start gap-2">

        <div className="shrink-0 mt-1">
          <h1 className="text-xl sm:text-2xl md:text-[28px] font-black tracking-tight uppercase leading-none flex flex-col sm:block">
            {vistaLocal === 'salon' ? (
              <><span className="text-white">Salón</span>{' '}<span style={{ color: colorPrimario }}>{nombreSede}</span></>
            ) : (
              <><span className="text-white">Para</span>{' '}<span style={{ color: colorPrimario }}>Llevar</span></>
            )}
          </h1>
          <div className="flex items-center gap-2 mt-1 sm:mt-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-neutral-500">En vivo</span>
            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 sm:gap-3">
          {/* Selector de sede — solo tiene sentido si hay más de una para elegir */}
          {esDueño && sedes?.length > 1 && (
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-neutral-500">Sede:</span>
              <select
                value={sedeActualId || ''} onChange={(e) => manejarCambioSede(e.target.value)}
                className="text-xs font-bold px-3 py-1.5 rounded-lg border outline-none cursor-pointer appearance-none text-center shadow-sm transition-colors bg-[#1a1a1a] text-white border-[#333] hover:border-[#ff5a1f] focus:border-[#ff5a1f]"
                style={{ color: colorPrimario }}
              >
                {!sedeActualId && <option value="" disabled>Seleccionar Sede...</option>}
                {sedes?.map(sede => <option key={sede.id} value={sede.id}>📍 {sede.nombre}</option>)}
              </select>
            </div>
          )}

          <div className="flex flex-col items-end gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2">
              {vistaLocal === 'salon' && (
                <button 
                  onClick={() => { setModoUnir(!modoUnir); setMesaPrincipal(null); }}
                  className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center border transition-all shrink-0 ${!modoUnir && 'bg-[#1a1a1a] border-[#333] text-neutral-400 hover:text-white hover:bg-[#222]'}`}
                  style={modoUnir ? { backgroundColor: colorPrimario, borderColor: colorPrimario, color: '#fff', boxShadow: `0 0 15px ${colorPrimario}60` } : {}}
                  title="Unir Mesas"
                >
                  <span className="text-base sm:text-lg">🔗</span>
                </button>
              )}

              {modSalonActivo && modLlevarActivo && (
                <button 
                  onClick={() => { if (vistaLocal === 'salon') { setVistaLocal('llevar'); setModoUnir(false); } else { setVistaLocal('salon'); } }}
                  className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center border transition-all relative shrink-0 border-[#333] bg-[#1a1a1a] text-neutral-400 hover:text-white hover:bg-[#222] shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                >
                  {vistaLocal === 'salon' ? (
                    <>
                      <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
                      <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 sm:w-4 sm:h-4 text-white text-[8px] sm:text-[9px] font-bold flex items-center justify-center rounded-full border border-[#0a0a0a]" style={{ backgroundColor: colorPrimario }}>{ordenesLlevar?.length || 0}</span>
                    </>
                  ) : (
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
                  )}
                </button>
              )}

              <button 
                onClick={() => setDrawerVentaRapidaAbierto(true)}
                className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center border transition-all active:scale-95 shrink-0 hover:brightness-125"
                style={{ backgroundColor: `${colorPrimario}1A`, borderColor: `${colorPrimario}4D`, color: colorPrimario }}
              >
                <span className="text-base sm:text-lg">⚡</span>
              </button>
            </div>

            {['administrador', 'admin', 'cajero', 'dueño'].includes(rolUsuario?.toLowerCase()) && (
              <div className="flex items-center gap-1.5 sm:gap-2">
                {['administrador', 'admin', 'dueño'].includes(rolUsuario?.toLowerCase()) && (
                  <button onClick={onIrAErp} className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center border border-blue-500/30 bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all active:scale-95 shrink-0" title="Panel de Control (ERP)">
                    <span className="text-base sm:text-lg">⚙️</span>
                  </button>
                )}
                <button onClick={() => setModalMovimientosAbierto(true)} className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center border border-green-500/30 bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white transition-all active:scale-95 shrink-0" title="Caja Chica">
                  <span className="text-base sm:text-lg">💸</span>
                </button>
                <button onClick={manejarCierreCajaSeguro} className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center border border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-95 shrink-0" title="Cerrar Turno">
                  <span className="text-base sm:text-lg">🔒</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}