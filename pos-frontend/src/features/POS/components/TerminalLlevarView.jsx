import React from 'react';

export default function TerminalLlevarView({
  ordenesLlevar, tema, colorPrimario, setModalClienteAbierto,
  manejarCancelacion, setOrdenACobrar, entregarOrdenLlevar
}) {
  const isDark = tema === 'dark';

  return (
    <div className="p-4 md:p-6 flex flex-col animate-fadeIn h-full overflow-y-auto">
      
      {/* Botón principal: Plano, sin sombras, con ícono de la librería */}
      <button 
        onClick={() => setModalClienteAbierto(true)} 
        style={{ backgroundColor: colorPrimario }} 
        className="w-full text-white font-black uppercase tracking-widest py-4 rounded-2xl mb-8 flex justify-center items-center gap-3 text-sm transition-all active:scale-95"
      >
        <i className="fi fi-rr-motorcycle text-lg mt-0.5"></i>
        Nueva Orden Para Llevar
      </button>

      <h2 className={`font-black mb-4 uppercase text-[10px] tracking-widest flex items-center gap-2 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
        Órdenes Activas
      </h2>
      
      <div className="space-y-3">
        
        {/* Empty State Rediseñado al estilo ERP */}
        {ordenesLlevar.length === 0 && (
          <div className={`text-center py-12 rounded-3xl border border-dashed ${isDark ? 'border-[#333] bg-[#141414]' : 'border-gray-300 bg-gray-50'}`}>
            <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center text-3xl mb-3 ${isDark ? 'bg-[#1a1a1a]' : 'bg-gray-200'}`}>
              🛵
            </div>
            <p className={`font-black uppercase tracking-widest text-[10px] ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
              No hay órdenes activas
            </p>
          </div>
        )}

        {/* Lista de Órdenes */}
        {ordenesLlevar.map((orden) => {
          const estaListo = orden.estado === 'listo';
          const estaPagado = orden.pago_confirmado;
          
          return (
            <div key={orden.id} className={`p-4 rounded-2xl flex justify-between items-center relative overflow-hidden transition-all border ${isDark ? 'bg-[#141414] border-[#222] hover:border-[#333]' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
              
              {/* Indicador lateral muy sutil */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${estaPagado ? 'bg-blue-500/80' : 'bg-red-500/80'}`} />
              
              <div className="flex-1 pl-3">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <h3 className={`font-black text-lg leading-none ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    #{orden.id}
                  </h3>
                  
                  {/* Badges de Estado (Fondo semi-transparente y borde) */}
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest border ${estaPagado ? (isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-600 border-blue-200') : (isDark ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-red-50 text-red-600 border-red-200')}`}>
                    {estaPagado ? 'PAGADO' : 'PENDIENTE PAGO'}
                  </span>
                  
                  <span
                    className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest border ${estaListo ? (isDark ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-green-50 text-green-600 border-green-200') : (isDark ? 'bg-[#1a1a1a] text-neutral-400 border-[#333]' : 'bg-gray-100 text-gray-500 border-gray-200')}`}
                    style={!estaListo && isDark ? { backgroundColor: `${colorPrimario}15`, color: colorPrimario, borderColor: `${colorPrimario}30` } : (!estaListo ? { backgroundColor: `${colorPrimario}10`, color: colorPrimario, borderColor: `${colorPrimario}30` } : {})}
                  >
                    {estaListo ? 'LISTO' : 'EN COCINA'}
                  </span>

                  {orden.tipo === 'delivery' && (
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest border ${isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                      🛵 DELIVERY
                    </span>
                  )}
                </div>

                <p className={`text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                  <i className="fi fi-rr-user text-[10px] mt-0.5"></i> {orden.cliente_nombre || 'Cliente sin nombre'}
                </p>
                {orden.tipo === 'delivery' && orden.direccion_entrega && (
                  <p className={`text-[10px] mt-0.5 flex items-center gap-1.5 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
                    <i className="fi fi-rr-marker text-[10px] mt-0.5"></i> {orden.direccion_entrega}
                  </p>
                )}
              </div>
              
              {/* Botones de Acción */}
              <div className="flex items-center gap-2 shrink-0">
                {!estaPagado && (
                  <button onClick={() => manejarCancelacion(orden.id)} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isDark ? 'bg-[#1a1a1a] text-neutral-500 hover:bg-red-500/10 hover:text-red-500' : 'bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500'}`} title="Cancelar Pedido">
                    <i className="fi fi-rr-trash text-sm mt-0.5"></i>
                  </button>
                )}
                
                {!estaPagado ? (
                  <button onClick={() => setOrdenACobrar(orden)} style={{ backgroundColor: colorPrimario }} className="text-white px-5 h-10 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all">
                    COBRAR
                  </button>
                ) : (
                  estaListo && (
                    <button onClick={() => entregarOrdenLlevar(orden.id)} className="bg-green-500 hover:bg-green-600 text-white w-10 h-10 flex items-center justify-center rounded-xl active:scale-95 transition-all" title="Marcar como entregado">
                      <i className="fi fi-rr-check text-sm mt-0.5"></i>
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}