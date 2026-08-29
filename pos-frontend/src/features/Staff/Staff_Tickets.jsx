import React, { useEffect, useState } from 'react';
import { getTicketsStaff, actualizarTicketStaff } from '../../api/api';

const ESTADOS = {
  abierto:     { label: 'Abierto',     color: '#ef4444' },
  en_progreso: { label: 'En progreso', color: '#f59e0b' },
  resuelto:    { label: 'Resuelto',    color: '#10b981' },
};

const PRIORIDADES = {
  alta:  { label: 'Alta',  color: '#ef4444' },
  media: { label: 'Media', color: '#f59e0b' },
  baja:  { label: 'Baja',  color: '#6b7280' },
};

function fmtFecha(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

function TicketCard({ ticket, onActualizado }) {
  const [respuesta, setRespuesta] = useState(ticket.respuesta_staff || '');
  const [guardando, setGuardando] = useState(false);
  const estado = ESTADOS[ticket.estado] || ESTADOS.abierto;
  const prioridad = PRIORIDADES[ticket.prioridad] || PRIORIDADES.media;

  const cambiarEstado = async (nuevoEstado) => {
    setGuardando(true);
    try {
      const resp = await actualizarTicketStaff(ticket.id, { estado: nuevoEstado, respuesta_staff: respuesta });
      onActualizado(resp.data);
    } catch {
      alert('No se pudo actualizar el ticket.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="p-5 rounded-2xl border bg-[#111] border-[#222] space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-black text-sm text-white">{ticket.asunto}</h4>
            <span
              className="text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest"
              style={{ color: estado.color, backgroundColor: `${estado.color}20` }}
            >
              {estado.label}
            </span>
            <span
              className="text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest"
              style={{ color: prioridad.color, backgroundColor: `${prioridad.color}20` }}
            >
              {prioridad.label}
            </span>
          </div>
          <p className="text-[11px] text-neutral-500 font-bold mt-1">
            {ticket.negocio_nombre} · {fmtFecha(ticket.creado_en)}
          </p>
        </div>
      </div>

      <p className="text-sm text-neutral-300 whitespace-pre-wrap">{ticket.mensaje}</p>

      <div className="pt-2 border-t border-[#1a1a1a] space-y-2">
        <textarea
          value={respuesta}
          onChange={(e) => setRespuesta(e.target.value)}
          placeholder="Escribe una respuesta (opcional)…"
          rows={2}
          className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl p-3 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-[#ff5a1f]"
        />
        <div className="flex items-center gap-2">
          {ticket.estado !== 'en_progreso' && (
            <button
              disabled={guardando}
              onClick={() => cambiarEstado('en_progreso')}
              className="px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-amber-500 text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
            >
              Marcar en progreso
            </button>
          )}
          {ticket.estado !== 'resuelto' && (
            <button
              disabled={guardando}
              onClick={() => cambiarEstado('resuelto')}
              className="px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-emerald-500 text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
            >
              Marcar resuelto
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Staff_Tickets() {
  const [tickets, setTickets] = useState([]);
  const [filtro, setFiltro] = useState('todos');
  const [cargando, setCargando] = useState(true);

  const cargar = () => {
    setCargando(true);
    getTicketsStaff()
      .then(res => setTickets(res.data))
      .finally(() => setCargando(false));
  };

  useEffect(cargar, []);

  const handleActualizado = (actualizado) => {
    setTickets(prev => prev.map(t => (t.id === actualizado.id ? actualizado : t)));
  };

  const filtrados = filtro === 'todos' ? tickets : tickets.filter(t => t.estado === filtro);

  if (cargando) return <div className="text-neutral-500 text-sm">Cargando tickets…</div>;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-2">
        {['todos', 'abierto', 'en_progreso', 'resuelto'].map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
              filtro === f ? 'bg-[#ff5a1f] text-white' : 'bg-[#111] border border-[#222] text-neutral-500'
            }`}
          >
            {f === 'todos' ? 'Todos' : ESTADOS[f].label}
          </button>
        ))}
      </div>

      {filtrados.length === 0 ? (
        <div className="p-10 rounded-2xl border border-dashed border-[#222] text-center text-neutral-600 text-sm">
          No hay tickets {filtro !== 'todos' ? `en estado "${ESTADOS[filtro].label}"` : ''}.
        </div>
      ) : (
        filtrados.map(t => <TicketCard key={t.id} ticket={t} onActualizado={handleActualizado} />)
      )}
    </div>
  );
}
