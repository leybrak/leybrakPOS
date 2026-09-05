import React, { useMemo, useState } from 'react';
import { 
  Calendar, Clock, CalendarDays, CalendarRange, Settings2, 
  Download, MapPin, Store, ChevronDown, DollarSign, 
  ShoppingCart, Receipt, TrendingUp, Utensils, Truck, 
  ShoppingBag
} from 'lucide-react';

export default function Erp_DashboardVentas({ 
  config, 
  sedeFiltro, 
  cambiarSedeFiltro, 
  sedesReales = [], 
  ordenesReales = [] 
}) {
  const isDark = config.temaFondo === 'dark';
  const colorPrimario = config.colorPrimario || '#3b82f6';
  const [ordenDetalleId, setOrdenDetalleId] = useState(null);

  // ==========================================
  // 🛡️ 0. SEGURIDAD DE ROLES
  // ==========================================
  const rolUsuario = localStorage.getItem('usuario_rol')?.toLowerCase() || '';
  const esDueño = rolUsuario === 'dueño'; 

  // ==========================================
  // 🕒 1. ESTADOS DE FILTRO DE TIEMPO
  // ==========================================
  const [tipoFiltroTiempo, setTipoFiltroTiempo] = useState('hoy');
  const [dropdownAbierto, setDropdownAbierto] = useState(false); 
  
  const hoyStr = new Date().toISOString().split('T')[0];
  const [fechaInicio, setFechaInicio] = useState(hoyStr);
  const [fechaFin, setFechaFin] = useState(hoyStr);

  const opcionesTiempo = [
    { id: 'hoy', label: 'Hoy', icon: <Calendar size={16} /> },
    { id: 'ayer', label: 'Ayer', icon: <Clock size={16} /> },
    { id: 'semana', label: 'Esta Semana', icon: <CalendarDays size={16} /> },
    { id: 'mes', label: 'Este Mes', icon: <CalendarRange size={16} /> },
    { id: 'rango', label: 'Rango Específico...', icon: <Settings2 size={16} /> }
  ];

  const opcionActual = opcionesTiempo.find(opt => opt.id === tipoFiltroTiempo);

  // ==========================================
  // 🧠 2. MOTOR DE FILTRADO
  // ==========================================
  const ordenesFiltradas = useMemo(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);
    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - hoy.getDay() + 1);
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    // Buscamos la sede seleccionada en sedesReales para obtener su id
    const sedeSeleccionada = sedesReales.find(s => s.nombre === sedeFiltro);

    return ordenesReales.filter(orden => {
      // 🔧 FIX SEDE: si el dueño eligió una sede específica, filtramos en memoria
      // usando orden.sede (id numérico) contra el id de la sede seleccionada.
      // Si sedeFiltro es 'Todas' o no se encontró la sede, mostramos todo.
      if (sedeSeleccionada) {
        if (String(orden.sede) !== String(sedeSeleccionada.id)) return false;
      }

      // 🔧 FIX ZONA HORARIA: construir fecha en hora local para evitar desfase UTC-5
      const fechaRaw = orden.creado_en?.replace(' ', 'T');
      const d = new Date(fechaRaw);
      const fechaOrden = new Date(d.getFullYear(), d.getMonth(), d.getDate());

      if (tipoFiltroTiempo === 'hoy') return fechaOrden.getTime() === hoy.getTime();
      if (tipoFiltroTiempo === 'ayer') return fechaOrden.getTime() === ayer.getTime();
      if (tipoFiltroTiempo === 'semana') return fechaOrden >= inicioSemana;
      if (tipoFiltroTiempo === 'mes') return fechaOrden >= inicioMes;
      if (tipoFiltroTiempo === 'rango') {
        const inicio = new Date(fechaInicio + 'T00:00:00');
        const fin = new Date(fechaFin + 'T23:59:59');
        return fechaOrden >= inicio && fechaOrden <= fin;
      }
      return true;
    });
  }, [ordenesReales, tipoFiltroTiempo, fechaInicio, fechaFin, sedeFiltro, sedesReales]);

  // ==========================================
  // 📊 3. CÁLCULO DINÁMICO DE MÉTRICAS
  // ==========================================
  const metricasDinamicas = useMemo(() => {
    let ingresosTotales = 0;
    ordenesFiltradas.forEach(o => ingresosTotales += parseFloat(o.total || 0));
    const totalOrdenes = ordenesFiltradas.length;
    const ticketPromedio = totalOrdenes > 0 ? ingresosTotales / totalOrdenes : 0;
    return { ingresosTotales, totalOrdenes, ticketPromedio };
  }, [ordenesFiltradas]);

  // ==========================================
  // 📈 4. GRÁFICO DINÁMICO
  // ==========================================
  const datosGrafico = useMemo(() => {
    const agrupadito = {};
    ordenesFiltradas.forEach(o => {
      const fecha = new Date(o.creado_en?.replace(' ', 'T'));
      const diaStr = fecha.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric' });
      agrupadito[diaStr] = (agrupadito[diaStr] || 0) + parseFloat(o.total || 0);
    });

    const dias = Object.keys(agrupadito);
    if (dias.length === 0) return [];
    const maxValor = Math.max(...Object.values(agrupadito), 1); 

    return dias.map(dia => ({
      dia,
      valor: agrupadito[dia].toFixed(2),
      alto: `${Math.round((agrupadito[dia] / maxValor) * 100)}%`
    })).slice(-7); 
  }, [ordenesFiltradas]);

  // ==========================================
  // 🍰 5. DISTRIBUCIÓN DE CANALES
  // ==========================================
  const distribucionVentas = useMemo(() => {
    let salon = 0, delivery = 0, llevar = 0;
    ordenesFiltradas.forEach(ord => {
      const origen = (ord.origen || ord.tipo || '').toLowerCase();
      if (origen.includes('delivery')) delivery++;
      else if (origen.includes('llevar')) llevar++;
      else salon++; 
    });
    const total = salon + delivery + llevar || 1; 
    return {
      salon, pSalon: Math.round((salon / total) * 100),
      delivery, pDelivery: Math.round((delivery / total) * 100),
      llevar, pLlevar: Math.round((llevar / total) * 100)
    };
  }, [ordenesFiltradas]);

  // ==========================================
  // 📥 6. EXPORTACIÓN INTELIGENTE
  // ==========================================
  const descargarReporteCSV = () => {
    if (ordenesFiltradas.length === 0) return alert("No hay ventas en este rango para exportar.");
    let contenidoCSV = "ID Orden,Fecha,Hora,Tipo de Venta,Origen,Estado Pago,Platos Servidos,Total (S/)\n";
    ordenesFiltradas.forEach(orden => {
      const fechaObj = new Date(orden.creado_en?.replace(' ', 'T'));
      const fecha = fechaObj.toLocaleDateString('es-PE');
      const hora = fechaObj.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
      const origenLimpio = (orden.mesa_nombre || orden.cliente_nombre || orden.origen || 'Desconocido').replace(/,/g, '');
      const stringPlatos = orden.detalles?.map(d => `${d.cantidad}x ${d.producto_nombre}`).join(' | ') || 'Sin detalles';
      contenidoCSV += `${orden.id},${fecha},${hora},${orden.tipo?.toUpperCase() || 'SALON'},${origenLimpio},${orden.estado_pago?.toUpperCase() || 'PENDIENTE'},"${stringPlatos}",${orden.total}\n`;
    });
    const blob = new Blob(["\uFEFF" + contenidoCSV], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Reporte_${sedeFiltro}_${tipoFiltroTiempo}.csv`;
    link.click();
  };

  return (
    <div className="animate-fadeIn pb-10 space-y-6">
      
      {/* ========== CABECERA SUPERIOR ========== */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        
        {/* FILTRO MULTI-SEDE — solo tiene sentido si hay más de una sede */}
        {esDueño && sedesReales?.length > 1 ? (
          <div className={`flex w-full xl:w-auto p-1 rounded-xl overflow-x-auto custom-scrollbar shrink-0 border ${
            isDark ? 'bg-[#111] border-[#222]' : 'bg-gray-100 border-gray-200'
          }`}>
            <button 
              onClick={() => cambiarSedeFiltro('Todas')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${
                sedeFiltro === 'Todas' ? 'text-white' : isDark ? 'text-neutral-400 hover:text-white hover:bg-[#1a1a1a]' : 'text-gray-600 hover:text-gray-900 hover:bg-white'
              }`}
              style={sedeFiltro === 'Todas' ? { backgroundColor: colorPrimario } : {}}
            >
              General
            </button>
            {sedesReales?.map(s => (
              <button 
                key={s.id} 
                onClick={() => cambiarSedeFiltro(s.nombre)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${
                  sedeFiltro === s.nombre ? 'text-white' : isDark ? 'text-neutral-400 hover:text-white hover:bg-[#1a1a1a]' : 'text-gray-600 hover:text-gray-900 hover:bg-white'
                }`}
                style={sedeFiltro === s.nombre ? { backgroundColor: colorPrimario } : {}}
              >
                {s.nombre}
              </button>
            ))}
          </div>
        ) : (
          <div className={`flex items-center px-4 py-2 rounded-xl border ${
            isDark ? 'bg-[#111] border-[#222]' : 'bg-gray-50 border-gray-200'
          }`}>
            <MapPin size={16} className={isDark ? 'text-neutral-500 mr-2' : 'text-gray-400 mr-2'} />
            <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
              Sede Activa: 
              <span className={`ml-2 text-xs ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {localStorage.getItem('sede_nombre') || 'Local Principal'}
              </span>
            </span>
          </div>
        )}

        {/* Filtros de Tiempo y Exportar */}
        <div className="flex flex-col sm:flex-row w-full xl:w-auto gap-3 relative z-20">
          
          <div className="relative">
            <button 
              onClick={() => setDropdownAbierto(!dropdownAbierto)}
              className={`flex items-center justify-between gap-3 min-w-[160px] px-4 py-2.5 rounded-xl text-xs font-bold transition-colors w-full border ${
                isDark ? 'bg-[#111] border-[#222] hover:border-[#333] text-white' : 'bg-white border-gray-200 hover:border-gray-300 text-gray-900'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className={isDark ? 'text-neutral-400' : 'text-gray-500'}>{opcionActual?.icon}</span> 
                {opcionActual?.label}
              </span>
              <ChevronDown size={14} className={`transition-transform ${dropdownAbierto ? 'rotate-180' : ''}`} />
            </button>

            {dropdownAbierto && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setDropdownAbierto(false)}></div>
                <div className={`absolute top-full right-0 mt-2 w-full min-w-[200px] rounded-xl shadow-xl z-20 overflow-hidden border animate-fadeIn ${
                  isDark ? 'bg-[#161616] border-[#222]' : 'bg-white border-gray-200'
                }`}>
                  {opcionesTiempo.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => { setTipoFiltroTiempo(opt.id); setDropdownAbierto(false); }}
                      className={`flex items-center gap-3 w-full px-4 py-3 text-xs font-bold transition-colors text-left ${
                        tipoFiltroTiempo === opt.id 
                          ? (isDark ? 'bg-[#222] text-white' : 'bg-gray-50 text-gray-900') 
                          : (isDark ? 'text-neutral-400 hover:bg-[#222] hover:text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900')
                      }`}
                    >
                      <span className={tipoFiltroTiempo === opt.id ? `text-[${colorPrimario}]` : ''}>{opt.icon}</span> 
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {tipoFiltroTiempo === 'rango' && (
            <div className={`flex items-center gap-3 px-4 py-1.5 rounded-xl border ${isDark ? 'bg-[#111] border-[#222]' : 'bg-gray-50 border-gray-200'}`}>
              <div className="relative flex items-center">
                <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)}
                  className={`bg-transparent outline-none text-xs font-bold cursor-pointer ${isDark ? 'text-white dark-calendar' : 'text-gray-900'}`} />
              </div>
              <span className={`font-black text-xs ${isDark ? 'text-neutral-600' : 'text-gray-300'}`}>/</span>
              <div className="relative flex items-center">
                <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)}
                  className={`bg-transparent outline-none text-xs font-bold cursor-pointer ${isDark ? 'text-white dark-calendar' : 'text-gray-900'}`} />
              </div>
            </div>
          )}

          <button 
            onClick={descargarReporteCSV}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-white transition-all hover:brightness-110 active:scale-95 shrink-0"
            style={{ backgroundColor: colorPrimario }}
          >
            <Download size={14} strokeWidth={2.5} /> <span className="sm:hidden xl:inline">Exportar</span>
          </button>
        </div>
      </div>

      {/* ========== ESTRUCTURA PC: 2 COLUMNAS ========== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUMNA IZQUIERDA (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* TARJETAS DE MÉTRICAS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className={`p-6 rounded-2xl flex flex-col justify-between border ${isDark ? 'bg-[#111] border-[#222]' : 'bg-white border-gray-200'}`}>
              <div className="flex justify-between items-start mb-4">
                <p className={`font-black uppercase tracking-widest text-[10px] ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>Ingresos Netos</p>
                <DollarSign size={16} className={isDark ? 'text-neutral-700' : 'text-gray-300'} />
              </div>
              <h3 className={`text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                <span className={`text-xl mr-1 ${isDark ? 'text-neutral-600' : 'text-gray-400'}`}>S/</span>{metricasDinamicas.ingresosTotales.toFixed(2)}
              </h3>
            </div>

            <div className={`p-6 rounded-2xl flex flex-col justify-between border ${isDark ? 'bg-[#111] border-[#222]' : 'bg-white border-gray-200'}`}>
              <div className="flex justify-between items-start mb-4">
                <p className={`font-black uppercase tracking-widest text-[10px] ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>Total Órdenes</p>
                <ShoppingCart size={16} className={isDark ? 'text-neutral-700' : 'text-gray-300'} />
              </div>
              <h3 className={`text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {metricasDinamicas.totalOrdenes}
              </h3>
            </div>

            <div className={`p-6 rounded-2xl flex flex-col justify-between border ${isDark ? 'bg-[#111] border-[#222]' : 'bg-white border-gray-200'}`}>
              <div className="flex justify-between items-start mb-4">
                <p className={`font-black uppercase tracking-widest text-[10px] ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>Ticket Promedio</p>
                <Receipt size={16} className={isDark ? 'text-neutral-700' : 'text-gray-300'} />
              </div>
              <h3 className={`text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                <span className={`text-xl mr-1 ${isDark ? 'text-neutral-600' : 'text-gray-400'}`}>S/</span>{metricasDinamicas.ticketPromedio.toFixed(2)}
              </h3>
            </div>
          </div>

          {/* GRÁFICO DINÁMICO */}
          <div className={`p-6 rounded-2xl border ${isDark ? 'bg-[#111] border-[#222]' : 'bg-white border-gray-200'}`}>
            <div className="flex justify-between items-end mb-6">
              <div>
                <h3 className={`font-black text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>Evolución de Ventas</h3>
                <p className={`text-xs mt-1 ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>Basado en el filtro actual</p>
              </div>
              <div className="text-right">
                <h3 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  <span className={`text-sm mr-1 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>S/</span>{metricasDinamicas.ingresosTotales.toFixed(2)}
                </h3>
              </div>
            </div>

            <div className={`flex items-end justify-between h-48 gap-2 sm:gap-3 mt-4 relative border-b border-dashed pb-2 ${isDark ? 'border-[#333]' : 'border-gray-200'}`}>
              {datosGrafico.length === 0 ? (
                <div className="w-full h-full flex flex-col items-center justify-center opacity-50">
                  <TrendingUp size={24} className={`mb-2 ${isDark ? 'text-neutral-600' : 'text-gray-400'}`} />
                  <p className={`text-xs font-bold ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>No hay ventas para graficar</p>
                </div>
              ) : (
                datosGrafico.map((d, i) => (
                  <div key={i} className="flex flex-col items-center justify-end h-full flex-1 group relative">
                    <span className={`opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 text-[10px] font-bold px-2 py-1 rounded-md shadow-md z-10 pointer-events-none whitespace-nowrap ${isDark ? 'bg-white text-black' : 'bg-gray-900 text-white'}`}>
                      S/ {d.valor}
                    </span>
                    <div
                      style={{ height: d.alto, backgroundColor: config.colorPrimario || '#8b5cf6' }}
                      className="w-full rounded-t-xl transition-all duration-500 group-hover:brightness-110"
                    ></div>
                    <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-widest whitespace-nowrap mt-2 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
                      {d.dia}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* DISTRIBUCIÓN DE CANALES */}
          <div className={`p-6 rounded-2xl border ${isDark ? 'bg-[#111] border-[#222]' : 'bg-white border-gray-200'}`}>
            <h3 className={`font-black text-lg mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>Canales de Venta</h3>
            
            {metricasDinamicas.totalOrdenes === 0 ? (
              <p className={`text-xs font-medium ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>Esperando datos de ventas...</p>
            ) : (
              <div className="space-y-6">
                <div className={`flex h-3 rounded-full overflow-hidden w-full ${isDark ? 'bg-[#222]' : 'bg-gray-100'}`}>
                  <div style={{ width: `${distribucionVentas.pSalon}%`, backgroundColor: colorPrimario }} className="h-full transition-all duration-1000" title={`Salón: ${distribucionVentas.pSalon}%`}></div>
                  <div style={{ width: `${distribucionVentas.pDelivery}%` }} className="h-full bg-emerald-500 transition-all duration-1000" title={`Delivery: ${distribucionVentas.pDelivery}%`}></div>
                  <div style={{ width: `${distribucionVentas.pLlevar}%` }} className="h-full bg-purple-500 transition-all duration-1000" title={`Para Llevar: ${distribucionVentas.pLlevar}%`}></div>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#161616] border-[#222]' : 'bg-gray-50 border-gray-100'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colorPrimario }}></span>
                      <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>Salón</span>
                    </div>
                    <p className={`text-lg font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>{distribucionVentas.pSalon}%</p>
                    <p className={`text-[10px] ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>{distribucionVentas.salon} órdenes</p>
                  </div>
                  
                  <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#161616] border-[#222]' : 'bg-gray-50 border-gray-100'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>Delivery</span>
                    </div>
                    <p className={`text-lg font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>{distribucionVentas.pDelivery}%</p>
                    <p className={`text-[10px] ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>{distribucionVentas.delivery} órdenes</p>
                  </div>

                  <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#161616] border-[#222]' : 'bg-gray-50 border-gray-100'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                      <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>Llevar</span>
                    </div>
                    <p className={`text-lg font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>{distribucionVentas.pLlevar}%</p>
                    <p className={`text-[10px] ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>{distribucionVentas.llevar} órdenes</p>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* ========================================== */}
        {/* FEED DE ÓRDENES (Columna Derecha 1/3)      */}
        {/* ========================================== */}
        <div className={`lg:col-span-1 rounded-2xl p-6 border flex flex-col transition-all ${
          isDark ? 'bg-[#111] border-[#222]' : 'bg-white border-gray-200'
        }`} 
        style={{ height: 'calc(100vh - 120px)', minHeight: '600px' }}>
          
          <div className="flex justify-between items-center mb-6 shrink-0">
            <h3 className={`font-black text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Lista de Órdenes
            </h3>
            {tipoFiltroTiempo === 'hoy' && (
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-green-500' : 'text-green-600'}`}>En vivo</span>
              </div>
            )}
          </div>
          
          <div className="flex-1 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
            {ordenesFiltradas.length === 0 ? (
              <div className={`flex flex-col items-center justify-center h-full text-center rounded-xl border border-dashed ${isDark ? 'border-[#333] text-neutral-600' : 'border-gray-200 text-gray-400'}`}>
                <ShoppingBag size={24} className="mb-2 opacity-50" />
                <p className="font-bold text-sm">Sin resultados</p>
              </div>
            ) : (
              ordenesFiltradas.map(orden => {
                const isSelected = ordenDetalleId === orden.id;
                const esDelivery = orden.origen?.toLowerCase().includes('delivery');
                const esLlevar = orden.origen?.toLowerCase().includes('llevar');
                const IconoCanal = esDelivery ? Truck : esLlevar ? ShoppingBag : Utensils;
                
                return (
                  <div 
                    key={orden.id} 
                    className={`flex flex-col p-3 rounded-xl cursor-pointer transition-all border ${
                      isSelected 
                        ? (isDark ? 'bg-[#1a1a1a] border-[#333]' : 'bg-gray-50 border-gray-300 shadow-sm') 
                        : (isDark ? 'bg-[#111] border-transparent hover:bg-[#161616]' : 'bg-white border-transparent hover:bg-gray-50')
                    }`}
                    onClick={() => setOrdenDetalleId(isSelected ? null : orden.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${
                          isDark ? 'bg-[#161616] border-[#2a2a2a] text-neutral-400' : 'bg-white border-gray-100 text-gray-500'
                        }`}>
                          <IconoCanal size={16} />
                        </div>
                        <div>
                          <p className={`font-bold text-sm leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>{orden.origen}</p>
                          <p className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
                            #{orden.id} • {new Date(orden.creado_en?.replace(' ', 'T')).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <p className={`font-black text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          S/ {parseFloat(orden.total).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {isSelected && (
                      <div className={`mt-3 pt-3 border-t border-dashed animate-slideDown ${isDark ? 'border-[#333]' : 'border-gray-200'}`}>
                        <div className="space-y-1.5">
                          {orden.detalles?.map((det, idx) => (
                            <div key={idx} className="flex justify-between items-start gap-3">
                              <p className={`text-xs font-medium ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>
                                <span className="font-black mr-1.5" style={{ color: colorPrimario }}>{det.cantidad}x</span>
                                {det.producto_nombre}
                              </p>
                              <p className={`text-xs font-black font-mono ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
                                {(det.cantidad * det.precio_unitario).toFixed(2)}
                              </p>
                            </div>
                          ))}
                        </div>
                        
                        {orden.notas && (
                          <div className={`mt-3 p-2.5 rounded-lg border ${isDark ? 'bg-[#1a1a1a] border-[#333]' : 'bg-gray-50 border-gray-200'}`}>
                            <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>Nota:</p>
                            <p className={`text-xs italic ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>{orden.notas}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}