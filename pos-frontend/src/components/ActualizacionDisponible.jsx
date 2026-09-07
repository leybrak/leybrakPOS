import { useRegisterSW } from 'virtual:pwa-register/react';

// Registra el Service Worker (ver injectRegister:false en vite.config.js) y,
// cuando detecta una versión nueva desplegada, muestra un aviso fijo arriba
// de toda la pantalla en vez de actualizar en silencio — antes (registerType
// 'autoUpdate' + skipWaiting) el SW nuevo tomaba control por debajo mientras
// la pestaña seguía corriendo el JS viejo, mezclando código viejo con cache
// nueva sin que nadie se enterara. El local puede tener el POS abierto horas
// sin recargar la pestaña ni una vez, así que sin este aviso nunca se
// enteraban de que había una actualización esperando.
export default function ActualizacionDisponible() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Red de seguridad: revisa cada hora si hay una versión nueva, para no
      // depender de que alguien cierre y reabra la pestaña.
      if (registration) {
        setInterval(() => registration.update(), 60 * 60 * 1000);
      }
    },
  });

  if (!needRefresh) return null;

  return (
    <div
      role="alert"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100000,
        background: '#1a1006', borderBottom: '1px solid rgba(255,90,31,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 14, padding: '10px 16px', flexWrap: 'wrap',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      }}
    >
      <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>
        🚀 Hay una nueva versión disponible.
      </span>
      <button
        onClick={() => updateServiceWorker(true)}
        style={{
          background: '#ff5a1f', color: '#fff', border: 'none',
          borderRadius: 10, padding: '7px 18px', fontSize: 12, fontWeight: 900,
          textTransform: 'uppercase', letterSpacing: 1, cursor: 'pointer',
        }}
      >
        Actualizar ahora
      </button>
    </div>
  );
}
