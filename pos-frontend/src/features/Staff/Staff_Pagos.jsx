import React, { useEffect, useState } from 'react';
import { getPagosPendientesStaff, actualizarPagoSuscripcion } from '../../api/api';

const METODOS_LABEL = { yape: 'Yape', plin: 'Plin', transferencia: 'Transferencia' };

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

export default function Staff_Pagos() {
  const [pagos, setPagos] = useState([]);
  const [cargando, setCargando] = useState(true);

  const cargar = () => {
    setCargando(true);
    getPagosPendientesStaff().then(res => setPagos(res.data)).finally(() => setCargando(false));
  };

  useEffect(cargar, []);

  const handleResuelto = (id) => setPagos(prev => prev.filter(p => p.id !== id));

  if (cargando) return <div className="text-neutral-500 text-sm">Cargando pagos…</div>;

  return (
    <div className="space-y-4 max-w-3xl">
      <h3 className="text-sm font-black text-white">{pagos.length} pagos pendientes de revisión</h3>

      {pagos.length === 0 ? (
        <div className="p-10 rounded-2xl border border-dashed border-[#222] text-center text-neutral-600 text-sm">
          No hay pagos por Yape/Plin/Transferencia esperando aprobación.
        </div>
      ) : (
        pagos.map(p => <PagoCard key={p.id} pago={p} onResuelto={(actualizado) => handleResuelto(actualizado.id)} />)
      )}
    </div>
  );
}
