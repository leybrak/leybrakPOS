import React, { useEffect, useState } from 'react';
import {
  getPagosPendientesStaff, getPagosHistorialStaff, actualizarPagoSuscripcion,
  listarNegociosStaff, registrarPagoStaff,
} from '../../api/api';

const METODOS_LABEL = {
  yape: 'Yape', plin: 'Plin', transferencia: 'Transferencia',
  tarjeta: 'Tarjeta', efectivo: 'Efectivo', otro: 'Otro',
};
const METODOS_REGISTRO = ['yape', 'plin', 'transferencia', 'tarjeta', 'efectivo', 'otro'];
const ESTADO_META = {
  pagado:  { label: 'Aprobado',  color: '#10b981' },
  fallido: { label: 'Rechazado', color: '#ef4444' },
};

function fmtFecha(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

function PagoCard({ pago, onResuelto }) {
  const [procesando, setProcesando] = useState(false);

  const resolver = async (estado) => {
    setProcesando(true);
    try {
      const resp = await actualizarPagoSuscripcion(pago.id, { estado });
      onResuelto(resp.data);
    } catch {
      alert('No se pudo actualizar el pago.');
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="p-5 rounded-2xl border bg-[#111] border-[#222] flex flex-col md:flex-row gap-4">
      {pago.captura_pago && (
        <a href={pago.captura_pago} target="_blank" rel="noreferrer" className="shrink-0">
          <img src={pago.captura_pago} alt="Comprobante" className="w-32 h-32 object-cover rounded-xl border border-[#2a2a2a]" />
        </a>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h4 className="font-black text-sm text-white">{pago.negocio_nombre}</h4>
          <span className="text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest text-blue-400 bg-blue-400/15">
            {METODOS_LABEL[pago.metodo_pago] || pago.metodo_pago}
          </span>
        </div>
        <p className="text-2xl font-black text-emerald-500">S/ {Number(pago.monto).toFixed(2)}</p>
        <p className="text-[11px] text-neutral-500 font-bold mt-1">{fmtFecha(pago.creado_en)}</p>
        {!pago.captura_pago && (
          <p className="text-[11px] text-amber-500 mt-2">Sin comprobante adjunto.</p>
        )}

        <div className="flex items-center gap-2 mt-4">
          <button
            disabled={procesando}
            onClick={() => resolver('pagado')}
            className="px-4 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
          >
            Aprobar
          </button>
          <button
            disabled={procesando}
            onClick={() => resolver('fallido')}
            className="px-4 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-500 text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
          >
            Rechazar
          </button>
        </div>
      </div>
    </div>
  );
}

function FilaHistorial({ pago }) {
  const estado = ESTADO_META[pago.estado] || { label: pago.estado, color: '#6b7280' };
  return (
    <div className="p-4 rounded-xl border bg-[#111] border-[#1a1a1a] flex items-center gap-4">
      {pago.captura_pago ? (
        <a href={pago.captura_pago} target="_blank" rel="noreferrer" className="shrink-0">
          <img src={pago.captura_pago} alt="Comprobante" className="w-12 h-12 object-cover rounded-lg border border-[#2a2a2a]" />
        </a>
      ) : (
        <div className="w-12 h-12 rounded-lg bg-[#0a0a0a] border border-[#1a1a1a] shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white truncate">{pago.negocio_nombre}</p>
        <p className="text-[11px] text-neutral-500">
          {METODOS_LABEL[pago.metodo_pago] || pago.metodo_pago} · {fmtFecha(pago.fecha_pago || pago.creado_en)}
        </p>
      </div>
      <p className="text-sm font-black text-white shrink-0">S/ {Number(pago.monto).toFixed(2)}</p>
      <span
        className="text-[9px] px-2 py-1 rounded-full font-black uppercase tracking-widest shrink-0"
        style={{ color: estado.color, backgroundColor: `${estado.color}20` }}
      >
        {estado.label}
      </span>
    </div>
  );
}

function ModalRegistrarPago({ negocios, onClose, onRegistrado }) {
  const [form, setForm] = useState({ negocio: '', monto: '', metodo_pago: 'efectivo', notas: '' });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const set = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  const registrar = async () => {
    if (!form.negocio || !form.monto) {
      setError('Elegí el negocio e indicá el monto.');
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const resp = await registrarPagoStaff({
        negocio: form.negocio, monto: form.monto, metodo_pago: form.metodo_pago,
        estado: 'pagado', notas: form.notas || undefined,
      });
      onRegistrado(resp.data);
    } catch (e) {
      setError(e?.response?.data?.error || 'No se pudo registrar el pago.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-6 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-white font-black text-sm">Registrar pago ya confirmado</h3>
        <p className="text-[11px] text-neutral-500">
          Para pagos negociados fuera de la app (WhatsApp, llamada) — queda directo como "pagado" y reactiva el negocio si estaba bloqueado.
        </p>

        <select value={form.negocio} onChange={set('negocio')}
          className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#ff5a1f]">
          <option value="">Elegí un negocio…</option>
          {negocios.map(n => <option key={n.id} value={n.id}>{n.nombre} — {n.propietario_username}</option>)}
        </select>

        <input type="number" step="0.01" placeholder="Monto (S/)" value={form.monto} onChange={set('monto')}
          className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#ff5a1f]" />

        <select value={form.metodo_pago} onChange={set('metodo_pago')}
          className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#ff5a1f]">
          {METODOS_REGISTRO.map(m => <option key={m} value={m}>{METODOS_LABEL[m]}</option>)}
        </select>

        <input placeholder="Notas (opcional)" value={form.notas} onChange={set('notas')}
          className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#ff5a1f]" />

        {error && <p className="text-red-400 text-xs font-bold">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] text-neutral-400 text-xs font-black uppercase tracking-widest">
            Cancelar
          </button>
          <button onClick={registrar} disabled={enviando}
            className="flex-1 py-2.5 rounded-xl bg-[#ff5a1f] text-white text-xs font-black uppercase tracking-widest disabled:opacity-40">
            {enviando ? 'Registrando…' : 'Registrar pago'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Staff_Pagos() {
  const [tab, setTab] = useState('pendientes');
  const [pendientes, setPendientes] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [negocios, setNegocios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarModalRegistro, setMostrarModalRegistro] = useState(false);

  const cargar = () => {
    setCargando(true);
    Promise.all([getPagosPendientesStaff(), getPagosHistorialStaff(), listarNegociosStaff()])
      .then(([r1, r2, r3]) => { setPendientes(r1.data); setHistorial(r2.data); setNegocios(r3.data); })
      .finally(() => setCargando(false));
  };

  useEffect(cargar, []);

  const handleResuelto = (actualizado) => {
    setPendientes(prev => prev.filter(p => p.id !== actualizado.id));
    setHistorial(prev => [actualizado, ...prev]);
  };

  const handleRegistrado = (nuevo) => {
    setHistorial(prev => [nuevo, ...prev]);
    setMostrarModalRegistro(false);
  };

  if (cargando) return <div className="text-neutral-500 text-sm">Cargando pagos…</div>;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab('pendientes')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors ${
              tab === 'pendientes' ? 'bg-[#ff5a1f] text-white' : 'bg-[#111] border border-[#222] text-neutral-500'
            }`}
          >
            Pendientes ({pendientes.length})
          </button>
          <button
            onClick={() => setTab('historial')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors ${
              tab === 'historial' ? 'bg-[#ff5a1f] text-white' : 'bg-[#111] border border-[#222] text-neutral-500'
            }`}
          >
            Resueltos ({historial.length})
          </button>
        </div>
        <button
          onClick={() => setMostrarModalRegistro(true)}
          className="px-4 py-2 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] text-neutral-300 text-xs font-black uppercase tracking-widest hover:bg-[#222]"
        >
          + Registrar pago
        </button>
      </div>

      {tab === 'pendientes' && (
        pendientes.length === 0 ? (
          <div className="p-10 rounded-2xl border border-dashed border-[#222] text-center text-neutral-600 text-sm">
            No hay pagos por Yape/Plin/Transferencia esperando aprobación.
          </div>
        ) : (
          <div className="space-y-4">
            {pendientes.map(p => <PagoCard key={p.id} pago={p} onResuelto={handleResuelto} />)}
          </div>
        )
      )}

      {tab === 'historial' && (
        historial.length === 0 ? (
          <div className="p-10 rounded-2xl border border-dashed border-[#222] text-center text-neutral-600 text-sm">
            Todavía no resolviste ningún pago.
          </div>
        ) : (
          <div className="space-y-2">
            {historial.map(p => <FilaHistorial key={p.id} pago={p} />)}
          </div>
        )
      )}

      {mostrarModalRegistro && (
        <ModalRegistrarPago
          negocios={negocios}
          onClose={() => setMostrarModalRegistro(false)}
          onRegistrado={handleRegistrado}
        />
      )}
    </div>
  );
}
