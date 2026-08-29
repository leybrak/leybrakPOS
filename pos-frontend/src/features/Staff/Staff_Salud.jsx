import React, { useEffect, useState } from 'react';
import { getSaludBot, getSaludServidor } from '../../api/api';

function Tarjeta({ children, className = '' }) {
  return (
    <div className={`p-6 rounded-2xl border bg-[#111] border-[#222] ${className}`}>
      {children}
    </div>
  );
}

function BarraRecurso({ label, usado, total, porcentaje, unidad = 'GB' }) {
  const color = porcentaje >= 85 ? '#ef4444' : porcentaje >= 65 ? '#f59e0b' : '#10b981';
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-neutral-400">{label}</span>
        <span className="font-black text-white">
          {usado} / {total} {unidad} <span style={{ color }}>({porcentaje.toFixed(0)}%)</span>
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-[#1a1a1a] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(porcentaje, 100)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export default function Staff_Salud() {
  const [bot, setBot] = useState(null);
  const [servidor, setServidor] = useState(null);
  const [error, setError] = useState(null);

  const cargar = () => {
    Promise.all([getSaludBot(), getSaludServidor()])
      .then(([r1, r2]) => { setBot(r1.data); setServidor(r2.data); })
      .catch(() => setError('No se pudo cargar la salud del sistema.'));
  };

  useEffect(() => {
    cargar();
    const intervalo = setInterval(cargar, 30000); // refresco cada 30s
    return () => clearInterval(intervalo);
  }, []);

  if (error) return <div className="text-red-400 text-sm font-bold">{error}</div>;
  if (!bot || !servidor) return <div className="text-neutral-500 text-sm">Cargando…</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <Tarjeta>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black text-white">Servidor</h3>
          <span className="text-[10px] text-neutral-600 font-bold">Se actualiza cada 30s</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-neutral-400">CPU</span>
            <span className="text-3xl font-black text-white">{servidor.cpu_percent.toFixed(0)}%</span>
          </div>
          <BarraRecurso label="Memoria" usado={servidor.memoria.usado_gb} total={servidor.memoria.total_gb} porcentaje={servidor.memoria.porcentaje} />
          <BarraRecurso label="Disco" usado={servidor.disco.usado_gb} total={servidor.disco.total_gb} porcentaje={servidor.disco.porcentaje} />
        </div>
        <p className="text-[10px] text-neutral-600 mt-4">{servidor.disco.nota}</p>
      </Tarjeta>

      <Tarjeta>
        <h3 className="text-sm font-black text-white mb-4">WhatsApp (Evolution API)</h3>
        <div className="flex items-center gap-6 mb-4">
          <div>
            <p className="text-2xl font-black text-emerald-500">{bot.evolution.conectadas}</p>
            <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Conectadas</p>
          </div>
          <div>
            <p className="text-2xl font-black text-red-500">{bot.evolution.desconectadas}</p>
            <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Desconectadas</p>
          </div>
          <div>
            <p className="text-2xl font-black text-white">{bot.evolution.total_instancias}</p>
            <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Total sedes</p>
          </div>
        </div>
        {bot.evolution.detalle.length > 0 && (
          <div className="space-y-2">
            {bot.evolution.detalle.map(d => (
              <div key={d.sede_id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#0a0a0a] border border-[#1a1a1a]">
                <span className="text-xs font-bold text-neutral-300">{d.negocio_nombre} — {d.sede_nombre}</span>
                <span className="text-[10px] font-black uppercase text-red-500">{d.estado}</span>
              </div>
            ))}
          </div>
        )}
      </Tarjeta>

      <Tarjeta>
        <h3 className="text-sm font-black text-white mb-3">n8n</h3>
        {!bot.n8n.configurado ? (
          <p className="text-xs text-neutral-500">
            No configurado. Agrega <code className="text-neutral-400">N8N_API_URL</code> y{' '}
            <code className="text-neutral-400">N8N_API_KEY</code> en el servidor para ver ejecuciones y errores acá.
          </p>
        ) : bot.n8n.error ? (
          <p className="text-xs text-red-400">{bot.n8n.error}</p>
        ) : (
          <p className="text-2xl font-black text-white">
            {bot.n8n.errores_recientes} <span className="text-xs text-neutral-500 font-bold uppercase tracking-widest">errores recientes</span>
          </p>
        )}
      </Tarjeta>
    </div>
  );
}
