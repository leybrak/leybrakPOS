import React, { useState, useEffect } from 'react';
import { Truck, Building2, MessageCircle, CheckCircle2, PackageCheck, XCircle, Send } from 'lucide-react';
import PedidoTimeline from '../PedidoTimeline';
import ModalRecibirPedido from './ModalRecibirPedido';
import ModalAvisarProveedor from './ModalAvisarProveedor';
import { solicitarOrdenCompra, confirmarOrdenCompra, enCaminoOrdenCompra, cancelarOrdenCompra } from '../../api/api';

export default function ModalDetallePedido({ isOpen, onClose, onSuccess, config, orden: ordenProp }) {
  const colorBtn = config?.colorPrimario || '#ff5a1f';
  const [orden, setOrden] = useState(ordenProp);
  const [procesando, setProcesando] = useState(false);
  const [modalRecibirOpen, setModalRecibirOpen] = useState(false);
  const [modalAvisarOpen, setModalAvisarOpen] = useState(false);

  useEffect(() => { setOrden(ordenProp); }, [ordenProp]);

  if (!isOpen || !orden) return null;

  const actualizarLocal = (data) => {
    setOrden(data);
    onSuccess?.();
  };

  const ejecutar = async (fn) => {
    setProcesando(true);
    try {
      const res = await fn();
      actualizarLocal(res.data);
    } catch (err) {
      alert(err.response?.data?.error || 'No se pudo completar la acción.');
    } finally {
      setProcesando(false);
    }
  };

  const esProveedor = orden.origen === 'proveedor';

  return (
    <>
      <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[120] flex items-center justify-center p-4 md:p-6 animate-fadeIn">
        <div className="bg-[#111] border border-[#222] w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">

          <div className="p-8 border-b border-[#222] flex justify-between items-center bg-[#161616] shrink-0">
            <div>
              <p className="text-[10px] text-[#ff5a1f] font-black uppercase tracking-widest mb-1">Pedido #{orden.id}</p>
              <h2 className="text-2xl font-black text-white flex items-center gap-3">
                {esProveedor ? <Truck size={26} /> : <Building2 size={26} />}
                {esProveedor ? (orden.nombre_proveedor || 'Proveedor') : 'Reabastecimiento Interno'}
              </h2>
            </div>
            <button onClick={onClose} className="text-neutral-500 hover:text-white text-4xl font-light transition-colors">×</button>
          </div>

          <div className="p-8 overflow-y-auto custom-scrollbar space-y-6">
            <div className="flex justify-center py-2">
              <PedidoTimeline estado={orden.estado} />
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-[#161616] border border-[#222] rounded-2xl p-4">
                <p className="text-[10px] text-neutral-500 uppercase font-bold">Destino</p>
                <p className="text-white font-bold">{orden.nombre_sede_destino || 'Almacén Central'}</p>
              </div>
              <div className="bg-[#161616] border border-[#222] rounded-2xl p-4">
                <p className="text-[10px] text-neutral-500 uppercase font-bold">Solicitado</p>
                <p className="text-white font-bold">{orden.fecha_pedido ? new Date(orden.fecha_pedido).toLocaleDateString() : '—'}</p>
              </div>
              {orden.creado_por && (
                <div className="bg-[#161616] border border-[#222] rounded-2xl p-4 col-span-2">
                  <p className="text-[10px] text-neutral-500 uppercase font-bold">Creado por</p>
                  <p className="text-white font-bold">{orden.nombre_creado_por}</p>
                </div>
              )}
              {orden.notas && (
                <div className="bg-[#161616] border border-[#222] rounded-2xl p-4 col-span-2">
                  <p className="text-[10px] text-neutral-500 uppercase font-bold">Notas</p>
                  <p className="text-neutral-300">{orden.notas}</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {(orden.lineas || []).map(l => (
                <div key={l.id} className="flex justify-between items-center bg-[#0a0a0a] border border-[#222] rounded-xl px-4 py-3">
                  <span className="text-white font-bold">{l.nombre_insumo}</span>
                  <span className="text-neutral-400 text-sm font-mono">
                    {l.cantidad_recibida > 0 ? `${l.cantidad_recibida} / ` : ''}{l.cantidad_pedida} {l.unidad_medida}
                  </span>
                </div>
              ))}
            </div>

            {esProveedor && orden.whatsapp_enviado && (
              <p className="text-xs text-green-500 flex items-center gap-1.5">
                <CheckCircle2 size={14} /> Avisado por WhatsApp el {new Date(orden.whatsapp_enviado_en).toLocaleString()}
              </p>
            )}
          </div>

          <div className="p-6 border-t border-[#222] bg-[#161616] shrink-0 flex flex-wrap justify-end gap-3">
            {orden.estado === 'borrador' && (
              <button disabled={procesando} onClick={() => ejecutar(() => solicitarOrdenCompra(orden.id))}
                className="px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest bg-[#1a1a1a] hover:bg-[#222] text-neutral-300 border border-[#333] flex items-center gap-2 disabled:opacity-50">
                <Send size={14} /> Solicitar
              </button>
            )}
            {esProveedor && orden.estado !== 'cancelado' && (
              <button disabled={procesando} onClick={() => setModalAvisarOpen(true)}
                className="px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest bg-[#1a1a1a] hover:bg-[#222] text-neutral-300 border border-[#333] flex items-center gap-2 disabled:opacity-50">
                <MessageCircle size={14} /> Avisar por WhatsApp
              </button>
            )}
            {orden.estado === 'solicitado' && (
              <button disabled={procesando} onClick={() => ejecutar(() => confirmarOrdenCompra(orden.id, {}))}
                style={{ backgroundColor: colorBtn }}
                className="px-6 py-3 rounded-2xl text-white font-black text-xs uppercase tracking-widest shadow-lg flex items-center gap-2 disabled:opacity-50">
                <CheckCircle2 size={14} /> Confirmar
              </button>
            )}
            {orden.estado === 'confirmado' && (
              <button disabled={procesando} onClick={() => ejecutar(() => enCaminoOrdenCompra(orden.id))}
                style={{ backgroundColor: colorBtn }}
                className="px-6 py-3 rounded-2xl text-white font-black text-xs uppercase tracking-widest shadow-lg flex items-center gap-2 disabled:opacity-50">
                <Truck size={14} /> Marcar En Camino
              </button>
            )}
            {['solicitado', 'confirmado', 'en_camino', 'recibido_parcial'].includes(orden.estado) && (
              <button disabled={procesando} onClick={() => setModalRecibirOpen(true)}
                style={{ backgroundColor: colorBtn }}
                className="px-6 py-3 rounded-2xl text-white font-black text-xs uppercase tracking-widest shadow-lg flex items-center gap-2 disabled:opacity-50">
                <PackageCheck size={14} /> Recibir
              </button>
            )}
            {!['recibido', 'cancelado'].includes(orden.estado) && (
              <button
                disabled={procesando}
                onClick={() => {
                  const motivo = window.prompt('¿Motivo de la cancelación? (opcional)') || '';
                  ejecutar(() => cancelarOrdenCompra(orden.id, { motivo }));
                }}
                className="px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 flex items-center gap-2 disabled:opacity-50"
              >
                <XCircle size={14} /> Cancelar
              </button>
            )}
          </div>
        </div>
      </div>

      <ModalRecibirPedido
        isOpen={modalRecibirOpen} onClose={() => setModalRecibirOpen(false)}
        onSuccess={() => { setModalRecibirOpen(false); onSuccess?.(); onClose(); }}
        config={config} orden={orden}
      />
      <ModalAvisarProveedor
        isOpen={modalAvisarOpen} onClose={() => setModalAvisarOpen(false)}
        onSuccess={() => { setModalAvisarOpen(false); onSuccess?.(); }}
        config={config} orden={orden}
      />
    </>
  );
}
