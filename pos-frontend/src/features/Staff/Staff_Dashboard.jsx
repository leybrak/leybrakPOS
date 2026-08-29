import React, { useEffect, useState } from 'react';
import { getMetricasStaff } from '../../api/api';

const ESTADOS_META = {
  activo:     { label: 'Activos',   color: '#10b981', icono: 'fi-rr-check-circle' },
  prueba:     { label: 'En prueba', color: '#3b82f6', icono: 'fi-rr-hourglass-end' },
  vencido:    { label: 'Vencidos',  color: '#f59e0b', icono: 'fi-rr-exclamation' },
  bloqueado:  { label: 'Bloqueados',color: '#ef4444', icono: 'fi-rr-ban' },
};

const MODULOS_META = {
  mod_salon_activo:       'Gestión de Salón',
  mod_cocina_activo:      'Pantalla KDS',
  mod_inventario_activo:  'Inventario',
  mod_delivery_activo:    'Delivery',
  mod_clientes_activo:    'CRM',
  mod_facturacion_activo: 'Facturación',
  mod_carta_qr_activo:    'Carta QR',
  mod_bot_wsp_activo:     'Bot WhatsApp',
  mod_ml_activo:          'Predicciones IA',
};

const fmtSoles = (n) => `S/ ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;

function Tarjeta({ children, className = '' }) {
  return (
    <div className={`p-6 rounded-2xl border bg-[#111] border-[#222] ${className}`}>
      {children}
    </div>
  );
}

function StatTile({ label, valor, icono, color }) {
  return (
    <Tarjeta className="flex flex-col gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}15`, color }}>
        <i className={`fi ${icono}`}></i>
      </div>
      <div>
        <p className="text-2xl font-black text-white">{valor}</p>
        <p className="text-[11px] text-neutral-500 font-bold uppercase tracking-widest mt-1">{label}</p>
      </div>
    </Tarjeta>
  );
}

export default function Staff_Dashboard() {
  const [metricas, setMetricas] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getMetricasStaff()
      .then(res => setMetricas(res.data))
      .catch(() => setError('No se pudieron cargar las métricas.'));
  }, []);

  if (error) {
    return <div className="text-red-400 text-sm font-bold">{error}</div>;
  }
  if (!metricas) {
    return <div className="text-neutral-500 text-sm">Cargando métricas…</div>;
  }

  const { negocios, ventas_pos_ultimos_30_dias, ordenes_hoy, modulos_adopcion } = metricas;
  const maxModulo = Math.max(1, ...Object.values(modulos_adopcion));

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Negocios totales" valor={negocios.total} icono="fi-rr-shop" color="#ff5a1f" />
        <StatTile label="Ventas POS (30d)" valor={fmtSoles(ventas_pos_ultimos_30_dias)} icono="fi-rr-sack-dollar" color="#10b981" />
        <StatTile label="Órdenes hoy" valor={ordenes_hoy} icono="fi-rr-receipt" color="#3b82f6" />
        <StatTile label="Negocios activos" valor={negocios.activo} icono="fi-rr-check-circle" color="#10b981" />
      </div>

      <Tarjeta>
        <h3 className="text-sm font-black text-white mb-4">Negocios por estado de suscripción</h3>
        <div className="space-y-3">
          {Object.entries(ESTADOS_META).map(([key, meta]) => {
            const valor = negocios[key] || 0;
            const pct = negocios.total > 0 ? (valor / negocios.total) * 100 : 0;
            return (
              <div key={key} className="flex items-center gap-3">
                <div className="flex items-center gap-2 w-32 shrink-0">
                  <i className={`fi ${meta.icono} text-xs`} style={{ color: meta.color }}></i>
                  <span className="text-xs font-bold text-neutral-400">{meta.label}</span>
                </div>
                <div className="flex-1 h-2 rounded-full bg-[#1a1a1a] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: meta.color }}
                  />
                </div>
                <span className="text-xs font-black text-white w-6 text-right">{valor}</span>
              </div>
            );
          })}
        </div>
      </Tarjeta>

      <Tarjeta>
        <h3 className="text-sm font-black text-white mb-4">Adopción de módulos</h3>
        <div className="space-y-3">
          {Object.entries(MODULOS_META).map(([key, label]) => {
            const valor = modulos_adopcion[key] || 0;
            const pct = (valor / maxModulo) * 100;
            return (
              <div key={key} className="flex items-center gap-3">
                <span className="text-xs font-bold text-neutral-400 w-32 shrink-0">{label}</span>
                <div className="flex-1 h-2 rounded-full bg-[#1a1a1a] overflow-hidden">
                  <div className="h-full rounded-full bg-[#ff5a1f] transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs font-black text-white w-6 text-right">{valor}</span>
              </div>
            );
          })}
        </div>
      </Tarjeta>
    </div>
  );
}
