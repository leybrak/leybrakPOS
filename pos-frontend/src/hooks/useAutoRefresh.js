import { useEffect, useRef } from 'react';

// Refresco periódico en segundo plano — no toca ningún estado de "cargando"
// (eso lo maneja cada pantalla en su carga inicial), así que nunca hace
// parpadear ni desmontar un formulario a medio llenar. Se pausa cuando la
// pestaña del navegador no está visible, para no gastar requests de más.
export const useAutoRefresh = (callback, intervalMs = 20000) => {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') callbackRef.current();
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
};
