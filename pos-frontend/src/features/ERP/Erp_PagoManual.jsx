import React, { useEffect, useState } from 'react';
import { Smartphone, Landmark, UploadCloud, CheckCircle2 } from 'lucide-react';
import { getDatosPagoNegocio, reportarPagoSuscripcion } from '../../api/api';

const METODOS = [
  { id: 'yape', label: 'Yape', icon: Smartphone, color: '#722ed1' },
  { id: 'plin', label: 'Plin', icon: Smartphone, color: '#00c2ff' },
  { id: 'transferencia', label: 'Transferencia', icon: Landmark, color: '#10b981' },
];

export default function Erp_PagoManual({ isDark, colorPrimario }) {
  const [datos, setDatos] = useState(null);
  const [metodo, setMetodo] = useState('yape');
  const [monto, setMonto] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { getDatosPagoNegocio().then(res => setDatos(res.data)).catch(() => {}); }, []);

  const enviar = async () => {
    if (!monto) { setError('Indica el monto que pagaste.'); return; }
    setEnviando(true);
    setError(null);
    try {
      await reportarPagoSuscripcion({ metodo_pago: metodo, monto, captura_pago: archivo || undefined });
      setEnviado(true);
    } catch (e) {
      setError(e?.response?.data?.error || 'No se pudo enviar el reporte.');
    } finally {
      setEnviando(false);
    }
  };

  if (enviado) {
    return (
      <div className={`p-6 rounded-[2rem] border shadow-sm flex items-center gap-4 ${isDark ? 'bg-[#111] border-[#222]' : 'bg-white border-gray-200'}`}>
        <CheckCircle2 size={28} className="text-emerald-500 shrink-0" />
        <div>
          <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>Reporte enviado</p>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
            Lo vamos a revisar y activar tu cuenta apenas lo confirmemos. Podés verlo en "Historial" como pendiente.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 md:p-8 rounded-[2rem] border shadow-sm ${isDark ? 'bg-[#111] border-[#222]' : 'bg-white border-gray-200'}`}>
      <h4 className={`text-sm font-black mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
        Pagar por Yape, Plin o Transferencia
      </h4>
      <p className={`text-xs mb-4 ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
        Si no querés usar MercadoPago, pagá directo y avisanos — lo confirmamos a mano.
      </p>

      {datos && (
        <div className={`grid grid-cols-1 md:grid-cols-3 gap-3 mb-5 text-xs`}>
          {datos.yape_numero && (
            <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#0a0a0a] border-[#222]' : 'bg-gray-50 border-gray-200'}`}>
              <p className="font-black text-[10px] uppercase tracking-widest text-neutral-500">Yape</p>
              <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{datos.yape_numero}</p>
              <p className="text-neutral-500">{datos.yape_titular}</p>
            </div>
          )}
          {datos.plin_numero && (
            <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#0a0a0a] border-[#222]' : 'bg-gray-50 border-gray-200'}`}>
              <p className="font-black text-[10px] uppercase tracking-widest text-neutral-500">Plin</p>
              <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{datos.plin_numero}</p>
              <p className="text-neutral-500">{datos.plin_titular}</p>
            </div>
          )}
          {datos.numero_cuenta && (
            <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#0a0a0a] border-[#222]' : 'bg-gray-50 border-gray-200'}`}>
              <p className="font-black text-[10px] uppercase tracking-widest text-neutral-500">{datos.banco || 'Cuenta'}</p>
              <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{datos.numero_cuenta}</p>
              {datos.cci && <p className="text-neutral-500">CCI: {datos.cci}</p>}
              <p className="text-neutral-500">{datos.titular_cuenta}</p>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {METODOS.map(m => (
          <button
            key={m.id}
            onClick={() => setMetodo(m.id)}
            className={`flex-1 py-2.5 rounded-xl border-2 text-xs font-black flex items-center justify-center gap-2 transition-all`}
            style={metodo === m.id
              ? { borderColor: m.color, color: isDark ? '#fff' : '#111', backgroundColor: isDark ? '#1a1a1a' : '#fff' }
              : { borderColor: isDark ? '#333' : '#e5e7eb', color: isDark ? '#555' : '#9ca3af' }}
          >
            <m.icon size={14} /> {m.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <input
          type="number" step="0.01" placeholder="Monto pagado (S/)"
          value={monto} onChange={(e) => setMonto(e.target.value)}
          className={`px-4 py-3 rounded-xl border text-sm ${isDark ? 'bg-[#0a0a0a] border-[#2a2a2a] text-white placeholder-neutral-600' : 'bg-gray-50 border-gray-200'}`}
        />
        <label className={`px-4 py-3 rounded-xl border text-sm flex items-center gap-2 cursor-pointer ${isDark ? 'bg-[#0a0a0a] border-[#2a2a2a] text-neutral-400' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
          <UploadCloud size={14} />
          {archivo ? archivo.name : 'Foto del comprobante (opcional)'}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => setArchivo(e.target.files?.[0] || null)} />
        </label>
      </div>

      {error && <p className="text-red-400 text-xs font-bold mb-3">{error}</p>}

      <button
        onClick={enviar}
        disabled={enviando}
        className="px-6 py-3 rounded-2xl text-white text-xs font-black uppercase tracking-widest disabled:opacity-50"
        style={{ backgroundColor: colorPrimario }}
      >
        {enviando ? 'Enviando…' : 'Ya pagué, avisar'}
      </button>
    </div>
  );
}
