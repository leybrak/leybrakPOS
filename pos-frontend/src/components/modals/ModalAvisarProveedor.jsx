import React, { useState, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import { avisarProveedorWsp } from '../../api/api';

function construirMensajeSugerido(orden) {
  const lineas = [`📦 Pedido para *${orden.nombre_proveedor || 'proveedor'}*`, ''];
  (orden.lineas || []).forEach(l => {
    lineas.push(`- ${l.cantidad_pedida} ${l.unidad_medida} de ${l.nombre_insumo}`);
  });
  if (orden.fecha_estimada) lineas.push('', `Fecha estimada de entrega: ${orden.fecha_estimada}`);
  if (orden.notas) lineas.push('', `Notas: ${orden.notas}`);
  lineas.push('', 'Por favor confirmar recepción de este pedido. ¡Gracias!');
  return lineas.join('\n');
}

export default function ModalAvisarProveedor({ isOpen, onClose, onSuccess, config, orden, proveedor }) {
  const colorBtn = config?.colorPrimario || '#ff5a1f';
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (isOpen && orden) setMensaje(construirMensajeSugerido(orden));
  }, [isOpen, orden]);

  if (!isOpen || !orden) return null;

  const handleEnviar = async () => {
    setEnviando(true);
    try {
      await avisarProveedorWsp(orden.id, { mensaje });
      alert('✅ Mensaje enviado por WhatsApp al proveedor.');
      onSuccess?.();
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'No se pudo enviar el mensaje.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[130] flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-[#111] border border-[#222] w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl">

        <div className="p-8 border-b border-[#222] flex justify-between items-center bg-[#161616]">
          <div>
            <p className="text-[10px] text-green-500 font-black uppercase tracking-widest mb-1">
              WhatsApp a {proveedor?.telefono || orden.nombre_proveedor}
            </p>
            <h2 className="text-2xl font-black text-white flex items-center gap-3"><MessageCircle size={26} /> Enviar Pedido</h2>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-white text-4xl font-light transition-colors">×</button>
        </div>

        <div className="p-8 space-y-4">
          <p className="text-xs text-neutral-500">
            Revisa o edita el mensaje antes de mandarlo. Solo se envía cuando confirmas acá abajo.
          </p>
          <textarea
            value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={10}
            className="w-full bg-[#0a0a0a] border border-[#333] px-5 py-4 rounded-2xl text-white text-sm font-mono outline-none focus:border-[#ff5a1f] resize-none"
          />
        </div>

        <div className="p-6 border-t border-[#222] bg-[#161616] flex justify-end">
          <button
            onClick={handleEnviar} disabled={enviando}
            style={{ backgroundColor: '#25D366' }}
            className="px-8 py-4 rounded-2xl text-white font-black text-xs uppercase tracking-widest shadow-lg transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 flex items-center gap-2"
          >
            <MessageCircle size={16} /> Enviar por WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
