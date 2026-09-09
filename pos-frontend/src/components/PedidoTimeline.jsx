import React from 'react';
import { FileEdit, Send, CheckCircle2, Truck, PackageCheck, XCircle } from 'lucide-react';

const PASOS = [
  { key: 'solicitado', label: 'Solicitado', icon: Send },
  { key: 'confirmado', label: 'Confirmado', icon: CheckCircle2 },
  { key: 'en_camino', label: 'En Camino', icon: Truck },
  { key: 'recibido', label: 'Recibido', icon: PackageCheck },
];

const IDX_POR_ESTADO = { solicitado: 0, confirmado: 1, en_camino: 2, recibido_parcial: 3, recibido: 3 };

export default function PedidoTimeline({ estado, compacto = false }) {
  if (estado === 'cancelado') {
    return (
      <span className="inline-flex items-center gap-1.5 text-red-500 font-black text-[10px] uppercase tracking-widest">
        <XCircle size={14} /> Cancelado
      </span>
    );
  }
  if (estado === 'borrador') {
    return (
      <span className="inline-flex items-center gap-1.5 text-neutral-500 font-black text-[10px] uppercase tracking-widest">
        <FileEdit size={14} /> Borrador
      </span>
    );
  }

  const idxActual = IDX_POR_ESTADO[estado] ?? 0;

  return (
    <div className="flex items-center">
      {PASOS.map((paso, i) => {
        const Icon = paso.icon;
        const esParcial = i === 3 && estado === 'recibido_parcial';
        const alcanzado = i <= idxActual;
        return (
          <React.Fragment key={paso.key}>
            {i > 0 && (
              <div className={`${compacto ? 'w-3' : 'w-6'} h-0.5 ${alcanzado ? 'bg-green-500' : 'bg-[#333]'}`} />
            )}
            <div
              title={esParcial ? `${paso.label} (parcial)` : paso.label}
              className={`${compacto ? 'w-6 h-6' : 'w-8 h-8'} rounded-full flex items-center justify-center border-2 shrink-0 ${
                esParcial
                  ? 'bg-yellow-500/20 border-yellow-500 text-yellow-500'
                  : alcanzado && !(i === idxActual && esParcial)
                  ? 'bg-green-500/20 border-green-500 text-green-500'
                  : 'bg-[#111] border-[#333] text-neutral-600'
              }`}
            >
              <Icon size={compacto ? 12 : 15} />
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
