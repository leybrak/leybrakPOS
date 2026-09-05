import React from 'react';
import PosView from '../../../views/View_Pos';

export default function TerminalSidebar({
  mesaSeleccionada, setMesaSeleccionada, setTriggerRecarga,
  todasLasOrdenesActivas, mesas, tema, colorPrimario, setOrdenACobrar
}) {
  return (
    <div className={`h-full flex flex-col transition-all duration-300 border-l ${tema === 'dark' ? 'bg-[#0d0d0d] border-[#222]' : 'bg-[#fcfcfc] border-gray-200'} ${mesaSeleccionada ? 'w-full lg:w-[40%]' : 'hidden lg:flex lg:w-[40%]'}`}>
      {mesaSeleccionada ? (
        <PosView
          mesaId={mesaSeleccionada}
          onVolver={() => {
            setMesaSeleccionada(null);
            setTriggerRecarga(p => !p); 
          }}
        />
      ) : (
        <div className="p-6 md:p-8 animate-fadeIn h-full overflow-y-auto scrollbar-hide">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center border" style={{ backgroundColor: `${colorPrimario}15`, borderColor: `${colorPrimario}30`, color: colorPrimario }}>
              <i className="fi fi-rr-receipt mt-0.5"></i>
            </div>
            <h3 className={`text-xs font-black uppercase tracking-[0.2em] ${tema === 'dark' ? 'text-neutral-400' : 'text-gray-500'}`}>
              Órdenes en curso
            </h3>
          </div>
          
          <div className="space-y-3 md:space-y-4">
            {todasLasOrdenesActivas?.length > 0 ? todasLasOrdenesActivas.map(ticket => {
              const esSalon = ticket.tipo !== 'llevar' && ticket.tipo !== 'delivery';
              const etiquetaTipo = ticket.tipo === 'delivery' ? 'Delivery' : ticket.tipo === 'llevar' ? 'Para Llevar' : 'Salón';
              const icono = ticket.tipo === 'delivery' ? 'fi-rr-motorcycle' : ticket.tipo === 'llevar' ? 'fi-rr-shopping-bag' : 'fi-rr-restaurant';
              return (
              <button
                key={ticket.id}
                onClick={() => {
                  // 🛠️ Antes: 'llevar' solo cambiaba de pestaña (sin abrir ESE
                  // pedido puntual) y 'delivery' caía al else de "Salón" con
                  // ticket.mesa=null -> "Mesa null" y sin hacer nada al tocarlo.
                  // Ahora ambos abren directo el detalle/cobro de ese pedido.
                  if (!esSalon) setOrdenACobrar(ticket);
                  else setMesaSeleccionada(ticket.mesa);
                }}
                className={`group relative w-full p-5 rounded-2xl border text-left flex justify-between items-center transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${tema === 'dark' ? 'bg-[#141414] border-[#2a2a2a] hover:border-[#444] shadow-black/20' : 'bg-white border-gray-200 shadow-sm hover:border-gray-300'}`}
              >
                {/* Línea de acento lateral dinámica */}
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 rounded-r-full transition-all duration-300 group-hover:h-12"
                  style={{ backgroundColor: colorPrimario }}
                ></div>

                <div className="pl-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={`flex items-center gap-1.5 text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-widest ${!esSalon ? 'bg-blue-500/10 text-blue-500' : ''}`}
                      style={esSalon ? { backgroundColor: `${colorPrimario}15`, color: colorPrimario } : {}}
                    >
                      <i className={`fi ${icono} mt-0.5`}></i>
                      {etiquetaTipo}
                    </span>
                  </div>
                  <p className={`font-black text-xl tracking-tight leading-none mb-1 ${tema === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {esSalon ? `Mesa ${mesas.find(m => m.id === ticket.mesa)?.numero || ticket.mesa}` : (ticket.cliente_nombre || 'Cliente sin nombre')}
                  </p>
                  <p className={`text-[10px] uppercase font-bold tracking-widest ${tema === 'dark' ? 'text-neutral-500' : 'text-gray-400'}`}>
                    Ticket #{ticket.id}
                  </p>
                </div>
                
                <div className="flex flex-col items-end">
                  <span className="text-[10px] uppercase font-bold text-neutral-500 mb-0.5">Total</span>
                  <span className="font-black text-xl tracking-tight" style={{ color: colorPrimario }}>
                    S/ {parseFloat(ticket.total).toFixed(2)}
                  </span>
                </div>
              </button>
              );
            }) : (
              <div className={`flex flex-col items-center justify-center p-10 rounded-3xl border border-dashed mt-8 transition-colors ${tema === 'dark' ? 'border-[#2a2a2a] bg-[#111]' : 'border-gray-200 bg-gray-50'}`}>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 shadow-inner ${tema === 'dark' ? 'bg-[#1a1a1a] text-neutral-600' : 'bg-white text-gray-300'}`}>
                  <i className="fi fi-rr-box-open text-3xl mt-2"></i>
                </div>
                <p className={`font-black uppercase tracking-widest text-xs mb-1 ${tema === 'dark' ? 'text-neutral-400' : 'text-gray-500'}`}>
                  Sin Pedidos
                </p>
                <p className={`text-[10px] text-center max-w-[200px] font-medium ${tema === 'dark' ? 'text-neutral-600' : 'text-gray-400'}`}>
                  Las nuevas órdenes aparecerán aquí cuando ingresen al sistema.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}