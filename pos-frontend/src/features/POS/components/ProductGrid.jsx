import React from 'react';
import ProductCard from './ProductCard';
import ComboPromoCard from './ComboPromoCard';

export default function ProductGrid({
  productosFiltrados,
  tema,
  colorPrimario,
  carrito,
  categoriasReales,
  ordenActiva,
  totalMesa,
  busqueda,
  abrirModalParaNuevo,
  aprenderSeleccion,
  agregarProducto,
  restarDesdeGrid,
  notificarEstadoMesa,
  formatearSoles,
  combosPromocionalesHoy = [],
  happyHours = [],
  agregarCombo,
  limpiarBusqueda,
}) {
  const isDark = tema === 'dark';

  return (
    <div className="flex-1 overflow-y-auto p-2 sm:p-4 min-h-0">

      {/* ── Sección Promociones (combos del día) ── */}
      {combosPromocionalesHoy.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-px" style={{ backgroundColor: colorPrimario + '40' }} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-1.5"
              style={{ color: colorPrimario }}>
              Promociones del día
            </span>
            <div className="flex-1 h-px" style={{ backgroundColor: colorPrimario + '40' }} />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
            {combosPromocionalesHoy.map(combo => (
              <ComboPromoCard
                key={`combo-promo-${combo.id}`}
                combo={combo}
                tema={tema}
                colorPrimario={colorPrimario}
                carrito={carrito}
                formatearSoles={formatearSoles}
                onAgregar={() => agregarCombo(combo)}
              />
            ))}
          </div>

          {/* Divisor */}
          <div className={`flex items-center gap-3 mt-6 mb-3`}>
            <div className={`flex-1 h-px ${isDark ? 'bg-[#222]' : 'bg-gray-200'}`} />
            <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isDark ? 'text-neutral-600' : 'text-gray-400'}`}>
              Carta
            </span>
            <div className={`flex-1 h-px ${isDark ? 'bg-[#222]' : 'bg-gray-200'}`} />
          </div>
        </div>
      )}

      {/* ── Grid normal de productos ── */}
      <div className="grid grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 relative z-0 pb-4">
        {productosFiltrados.map((prod) => (
          <ProductCard
            key={prod.id}
            prod={prod}
            tema={tema}
            colorPrimario={colorPrimario}
            carrito={carrito}
            categoriasReales={categoriasReales}
            ordenActiva={ordenActiva}
            totalMesa={totalMesa}
            busqueda={busqueda}
            abrirModalParaNuevo={abrirModalParaNuevo}
            aprenderSeleccion={aprenderSeleccion}
            agregarProducto={agregarProducto}
            restarDesdeGrid={restarDesdeGrid}
            notificarEstadoMesa={notificarEstadoMesa}
            formatearSoles={formatearSoles}
            happyHours={happyHours}
            limpiarBusqueda={limpiarBusqueda}
          />
        ))}
      </div>
    </div>
  );
}