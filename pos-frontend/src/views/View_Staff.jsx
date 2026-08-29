import React, { useState } from 'react';
import Staff_Dashboard from '../features/Staff/Staff_Dashboard';
import Staff_Tickets from '../features/Staff/Staff_Tickets';
import Staff_Salud from '../features/Staff/Staff_Salud';

const TABS = [
  { id: 'dashboard', icono: 'fi-rr-apps',        nombre: 'Dashboard' },
  { id: 'tickets',   icono: 'fi-rr-ticket',       nombre: 'Tickets' },
  { id: 'salud',     icono: 'fi-rr-heart-arrow',  nombre: 'Salud' },
];

export default function View_Staff({ onLogout }) {
  const [tabActiva, setTabActiva] = useState('dashboard');

  return (
    <div className="h-screen w-full flex flex-col bg-[#0a0a0a] text-neutral-100">
      <header className="px-6 py-4 flex items-center justify-between border-b border-[#1a1a1a] shrink-0">
        <div>
          <h1 className="text-lg font-black tracking-tight">
            LEYBRAK <span className="text-[#ff5a1f]">STAFF</span>
          </h1>
          <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
            Panel interno de la plataforma
          </p>
        </div>

        <nav className="flex items-center gap-1 bg-[#111] border border-[#222] rounded-xl p-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTabActiva(t.id)}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-colors flex items-center gap-2 ${
                tabActiva === t.id
                  ? 'bg-[#ff5a1f] text-white'
                  : 'text-neutral-500 hover:text-white'
              }`}
            >
              <i className={`fi ${t.icono}`}></i>
              {t.nombre}
            </button>
          ))}
        </nav>

        <button
          onClick={onLogout}
          className="px-4 py-2 rounded-xl bg-[#161616] border border-[#2a2a2a] text-neutral-400 hover:text-red-500 hover:border-red-500/30 text-xs font-black uppercase tracking-widest transition-colors"
        >
          Cerrar sesión
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-6 md:p-8">
        {tabActiva === 'dashboard' && <Staff_Dashboard />}
        {tabActiva === 'tickets'   && <Staff_Tickets />}
        {tabActiva === 'salud'     && <Staff_Salud />}
      </main>
    </div>
  );
}
