import { getProductos, getCategorias, getModificadores } from '../api/api';

// ─── Cache local de la carta (productos/categorias/modificadores) ───
// Espejo de LeybrakApp/src/services/menuCache.js (mobile), usando
// localStorage en vez de AsyncStorage. Antes usePosData.js pedía la carta
// entera por red cada vez que se abría OTRA mesa (su efecto dependía de
// mesaId) — con el local lleno eso es una consulta de red por cada mesa
// que toca el mozo, sin necesidad (la carta casi no cambia). Guardamos la
// última carta descargada para abrir la mesa al instante (optimistic UI)
// y solo la refrescamos: (a) en segundo plano cada vez que cambia la
// sede, (b) cuando el WS del salón avisa 'menu_actualizado' (ver
// negocios/signals.py → avisar_menu_actualizado_* y useTerminalWS.js), o
// (c) cada REFRESCO_MINIMO_MS como red de seguridad si el WS se perdió
// algún evento.

const REFRESCO_MINIMO_MS = 5 * 60 * 1000; // 5 minutos

const claveProductos     = (sedeId) => `menu_cache_productos_${sedeId}`;
const claveCategorias    = (sedeId) => `menu_cache_categorias_${sedeId}`;
const claveModificadores = (sedeId) => `menu_cache_modificadores_${sedeId}`;
const claveTimestamp     = (sedeId) => `menu_cache_ts_${sedeId}`;

// Lee la carta guardada localmente. Devuelve null si nunca se descargó.
export function leerMenuCache(sedeId) {
  try {
    const prodRaw = localStorage.getItem(claveProductos(sedeId));
    if (!prodRaw) return null;
    const catRaw = localStorage.getItem(claveCategorias(sedeId));
    const modRaw = localStorage.getItem(claveModificadores(sedeId));
    const tsRaw  = localStorage.getItem(claveTimestamp(sedeId));
    return {
      productos:     JSON.parse(prodRaw),
      categorias:    catRaw ? JSON.parse(catRaw) : [],
      modificadores: modRaw ? JSON.parse(modRaw) : [],
      timestamp:     tsRaw ? parseInt(tsRaw, 10) : 0,
    };
  } catch {
    return null;
  }
}

// true si un timestamp de cache (de leerMenuCache) es reciente y no hace
// falta pedir la carta de nuevo todavía.
export function esCacheReciente(timestamp) {
  return !!timestamp && (Date.now() - timestamp) < REFRESCO_MINIMO_MS;
}

// Descarga la carta fresca del backend y la deja guardada localmente.
// 🛠️ Sin filtro `disponible` — a diferencia de mobile, la web SÍ muestra
// los productos agotados (grisados, ver ProductCard.jsx) en vez de
// ocultarlos del todo.
export async function refrescarMenuCache(sedeId) {
  const [resProd, resCat, resMods] = await Promise.all([
    getProductos({ sede_id: sedeId }),
    getCategorias(),
    getModificadores(),
  ]);
  const resultado = {
    productos:     resProd.data || [],
    categorias:    resCat.data || [],
    modificadores: resMods.data || [],
  };
  try {
    localStorage.setItem(claveProductos(sedeId), JSON.stringify(resultado.productos));
    localStorage.setItem(claveCategorias(sedeId), JSON.stringify(resultado.categorias));
    localStorage.setItem(claveModificadores(sedeId), JSON.stringify(resultado.modificadores));
    localStorage.setItem(claveTimestamp(sedeId), String(Date.now()));
  } catch {
    // localStorage lleno/bloqueado — no rompe el flujo, igual se sirve la carta fresca.
  }
  return resultado;
}
