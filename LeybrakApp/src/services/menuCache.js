import AsyncStorage from '@react-native-async-storage/async-storage';
import { getProductos, getCategorias, getModificadores } from '../api/api';

// ─── Cache local de la carta (productos/categorias/modificadores) ───
// Antes PosScreen pedía la carta entera por red cada vez que un mozo abría
// una mesa distinta — con el negocio lleno eso es una consulta de red por
// cada toque de mesa, sin necesidad (la carta casi no cambia). Guardamos la
// última carta descargada en AsyncStorage para abrir la mesa al instante
// (optimistic UI) y solo la refrescamos: (a) en segundo plano cada vez que
// se abre una mesa, (b) cuando el WS del salón avisa 'menu_actualizado'
// (ver negocios/signals.py → avisar_menu_actualizado_*), o (c) cada
// REFRESCO_MINIMO_MS como red de seguridad si el WS se perdió algún evento.

const REFRESCO_MINIMO_MS = 5 * 60 * 1000; // 5 minutos

const claveProductos     = (sedeId) => `menu_cache_productos_${sedeId}`;
const claveCategorias    = (sedeId) => `menu_cache_categorias_${sedeId}`;
const claveModificadores = (sedeId) => `menu_cache_modificadores_${sedeId}`;
const claveTimestamp     = (sedeId) => `menu_cache_ts_${sedeId}`;

// Lee la carta guardada localmente. Devuelve null si nunca se descargó.
export async function leerMenuCache(sedeId) {
  try {
    const pares = await AsyncStorage.multiGet([
      claveProductos(sedeId), claveCategorias(sedeId), claveModificadores(sedeId), claveTimestamp(sedeId),
    ]);
    const [prodRaw, catRaw, modRaw, tsRaw] = pares.map(([, v]) => v);
    if (!prodRaw) return null;
    return {
      productos: JSON.parse(prodRaw),
      categorias: catRaw ? JSON.parse(catRaw) : [],
      modificadores: modRaw ? JSON.parse(modRaw) : [],
      timestamp: tsRaw ? parseInt(tsRaw, 10) : 0,
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
export async function refrescarMenuCache(negocioId, sedeId) {
  const [resProd, resCat, resMods] = await Promise.all([
    getProductos({ negocio_id: negocioId, sede_id: sedeId, disponible: true }),
    getCategorias({ negocio_id: negocioId }),
    getModificadores({ negocio_id: negocioId }),
  ]);
  const resultado = {
    productos: resProd.data || [],
    categorias: resCat.data || [],
    modificadores: resMods.data || [],
  };
  try {
    await AsyncStorage.multiSet([
      [claveProductos(sedeId), JSON.stringify(resultado.productos)],
      [claveCategorias(sedeId), JSON.stringify(resultado.categorias)],
      [claveModificadores(sedeId), JSON.stringify(resultado.modificadores)],
      [claveTimestamp(sedeId), String(Date.now())],
    ]);
  } catch {
    // Si falla el guardado local no rompemos el flujo — igual se muestra la carta fresca.
  }
  return resultado;
}

// Fuerza a que la próxima lectura sea considerada vieja (sin borrar los
// datos, para que la mesa siga abriendo con algo en pantalla mientras se
// refresca en segundo plano).
export async function invalidarMenuCache(sedeId) {
  try {
    await AsyncStorage.removeItem(claveTimestamp(sedeId));
  } catch {}
}
