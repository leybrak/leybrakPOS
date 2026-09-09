import React, { useState, useEffect } from 'react';
import { PackageCheck } from 'lucide-react';
import { recibirOrdenCompra } from '../../api/api';

export default function ModalRecibirPedido({ isOpen, onClose, onSuccess, config, orden }) {
  const colorBtn = config?.colorPrimario || '#ff5a1f';
  const [cantidades, setCantidades] = useState({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!isOpen || !orden) return;
    const iniciales = {};
    (orden.lineas || []).forEach(l => {
      const restante = parseFloat(l.cantidad_pedida) - parseFloat(l.cantidad_recibida || 0);
      iniciales[l.id] = restante > 0 ? String(restante) : '0';
    });
    setCantidades(iniciales);
  }, [isOpen, orden]);

  if (!isOpen || !orden) return null;

  const lineasPendientes = (orden.lineas || []).filter(
    l => parseFloat(l.cantidad_pedida) - parseFloat(l.cantidad_recibida || 0) > 0
  );

  const quedaraCompleto = lineasPendientes.every(l => {
    const restante = parseFloat(l.cantidad_pedida) - parseFloat(l.cantidad_recibida || 0);
    const ingresado = parseFloat(cantidades[l.id] || 0);
    return ingresado >= restante;
  });

  const handleConfirmar = async () => {
    const lineasPayload = Object.entries(cantidades)
      .map(([detalle_id, cantidad_recibida]) => ({ detalle_id: parseInt(detalle_id), cantidad_recibida }))
      .filter(l => parseFloat(l.cantidad_recibida) > 0);

    if (lineasPayload.length === 0) return alert('Ingresa al menos una cantidad recibida.');

    setGuardando(true);
    try {
      await recibirOrdenCompra(orden.id, { lineas: lineasPayload });
      alert('📦 Recepción registrada. El stock ya se actualizó.');
      onSuccess?.();
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al registrar la recepción.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[130] flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-[#111] border border-[#222] w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">

        <div className="p-8 border-b border-[#222] flex justify-between items-center bg-[#161616] shrink-0">
          <div>
            <p className="text-[10px] text-[#ff5a1f] font-black uppercase tracking-widest mb-1">Pedido #{orden.id}</p>
            <h2 className="text-2xl font-black text-white flex items-center gap-3"><PackageCheck size={26} /> Confirmar Recepción</h2>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-white text-4xl font-light transition-colors">×</button>
        </div>

        <div className="p-8 overflow-y-auto custom-scrollbar space-y-3">
          <p className="text-xs text-neutral-500 mb-2">
            Ingresa lo que realmente llegó. Si es menos de lo pedido, el pedido quedará "Recibido Parcial" y podrás
            completar la recepción después.
          </p>
          {(orden.lineas || []).map(l => {
            const restante = parseFloat(l.cantidad_pedida) - parseFloat(l.cantidad_recibida || 0);
            if (restante <= 0) {
              return (
                <div key={l.id} className="flex justify-between items-center bg-[#0a0a0a] border border-green-500/20 rounded-2xl p-4 opacity-60">
                  <span className="text-white font-bold">{l.nombre_insumo}</span>
                  <span className="text-green-500 text-xs font-black uppercase">Ya recibido: {l.cantidad_recibida} {l.unidad_medida}</span>
                </div>
              );
            }
            return (
              <div key={l.id} className="flex items-center gap-3 bg-[#0a0a0a] border border-[#222] rounded-2xl p-4">
                <div className="flex-1">
                  <p className="text-white font-bold">{l.nombre_insumo}</p>
                  <p className="text-xs text-neutral-500">Pedido: {l.cantidad_pedida} {l.unidad_medida} · Pendiente: {restante} {l.unidad_medida}</p>
                </div>
                <input
                  type="number" min="0" max={restante}
                  value={cantidades[l.id] ?? ''}
                  onChange={(e) => setCantidades(prev => ({ ...prev, [l.id]: e.target.value }))}
                  className="w-28 bg-[#161616] border border-[#333] px-4 py-3 rounded-xl text-white text-right font-mono outline-none focus:border-[#ff5a1f]"
                />
                <span className="text-xs text-neutral-500 font-bold w-10">{l.unidad_medida}</span>
              </div>
            );
          })}
        </div>

        <div className="p-6 border-t border-[#222] bg-[#161616] shrink-0 flex justify-between items-center gap-4">
          <span className={`text-xs font-black uppercase tracking-widest px-3 py-2 rounded-lg ${quedaraCompleto ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
            {quedaraCompleto ? 'Quedará: Recibido' : 'Quedará: Recibido Parcial'}
          </span>
          <button
            onClick={handleConfirmar} disabled={guardando}
            style={{ backgroundColor: colorBtn }}
            className="px-8 py-4 rounded-2xl text-white font-black text-xs uppercase tracking-widest shadow-lg transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
          >
            Confirmar Recepción
          </button>
        </div>
      </div>
    </div>
  );
}
