import React, { useEffect, useState } from 'react';
import { getResumenFinancieroStaff } from '../../api/api';

const fmtSoles = (n) => `S/ ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;

function Tarjeta({ children, className = '' }) {
  return (
    <div className={`p-6 rounded-2xl border bg-[#111] border-[#222] ${className}`}>
      {children}
    </div>
  );
}

function StatTile({ label, valor, sub, icono, color }) {
  return (
    <Tarjeta className="flex flex-col gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}15`, color }}>
        <i className={`fi ${icono}`}></i>
      </div>
      <div>
        <p className="text-2xl font-black text-white">{valor}</p>
        <p className="text-[11px] text-neutral-500 font-bold uppercase tracking-widest mt-1">{label}</p>
        {sub && <p className="text-[11px] font-bold mt-1" style={{ color }}>{sub}</p>}
      </div>
    </Tarjeta>
  );
}

export default function Staff_Finanzas() {
  const [resumen, setResumen] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getResumenFinancieroStaff()
      .then(res => setResumen(res.data))
      .catch(() => setError('No se pudo cargar el resumen financiero.'));
  }, []);

  if (error) return <div className="text-red-400 text-sm font-bold">{error}</div>;
  if (!resumen) return <div className="text-neutral-500 text-sm">Cargando finanzas…</div>;

  const {
    facturado_mes_actual, facturado_mes_anterior, variacion_pct,
    mrr_estimado, negocios_pagando, negocios_vencidos, tasa_vencimiento_pct,
  } = resumen;

  const variacionTexto = variacion_pct === null
    ? 'Sin datos del mes anterior'
    : `${variacion_pct >= 0 ? '+' : ''}${variacion_pct.toFixed(1)}% vs. mes anterior`;
  const variacionColor = variacion_pct === null ? '#6b7280' : (variacion_pct >= 0 ? '#10b981' : '#ef4444');

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile
          label="Facturado este mes"
          valor={fmtSoles(facturado_mes_actual)}
          sub={variacionTexto}
          icono="fi-rr-sack-dollar"
          color={variacion_pct === null ? '#ff5a1f' : variacionColor}
        />
        <StatTile
          label="Facturado mes anterior"
          valor={fmtSoles(facturado_mes_anterior)}
          icono="fi-rr-calendar"
          color="#6b7280"
        />
        <StatTile
          label="MRR estimado"
          valor={fmtSoles(mrr_estimado)}
          sub={`${negocios_pagando} negocio(s) pagando`}
          icono="fi-rr-refresh"
          color="#3b82f6"
        />
        <StatTile
          label="Tasa de vencidos"
          valor={tasa_vencimiento_pct === null ? '—' : `${tasa_vencimiento_pct}%`}
          sub={`${negocios_vencidos} negocio(s) vencido(s)`}
          icono="fi-rr-exclamation"
          color="#f59e0b"
        />
      </div>

      <Tarjeta>
        <h3 className="text-sm font-black text-white mb-2">Sobre estos números</h3>
        <ul className="text-[12px] text-neutral-500 space-y-1.5 leading-relaxed">
          <li>• <b className="text-neutral-300">Facturado</b>: suma de pagos de suscripción marcados "pagado" con fecha dentro del mes.</li>
          <li>• <b className="text-neutral-300">MRR estimado</b>: precio de plan de los negocios con suscripción vigente ahora mismo — es una proyección a partir del plan asignado, no necesariamente lo que se cobró (puede haber descuentos negociados). No incluye negocios en período de prueba.</li>
          <li>• <b className="text-neutral-300">Tasa de vencidos</b>: de los negocios que ya deberían estar pagando (pagando + vencidos), qué porcentaje no tiene un pago vigente ahora. No es una tasa de cancelación real mes a mes — no llevamos historial de transiciones de estado.</li>
        </ul>
      </Tarjeta>
    </div>
  );
}
