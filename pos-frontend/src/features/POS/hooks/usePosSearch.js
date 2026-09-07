import { useState, useMemo } from 'react';

// Quita tildes/diacríticos y pasa a minúsculas — sin esto, buscar "limon"
// (sin tilde, lo normal escribiendo rápido durante el servicio) no
// encontraba "Limón", "jalapeno" no encontraba "Jalapeño", etc.
// Rango Unicode "Combining Diacritical Marks" (U+0300–U+036F) — se arma con
// String.fromCharCode en vez de escribir el rango literal en el archivo
// para no depender de que el editor/git conserven bien esos bytes no-ASCII.
const DIACRITICOS = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g');
const normalizar = (texto) => (texto || '')
  .normalize('NFD')
  .replace(DIACRITICOS, '')
  .toLowerCase()
  .trim();

// Puntaje de relevancia de un texto contra las palabras buscadas (ya
// normalizadas). null si no coincide con TODAS las palabras — así
// "pollo chaufa" encuentra "Chaufa de Pollo" aunque el orden no calce
// con una búsqueda de solo substring exacto (lo que había antes).
// Ordena mejor: que el nombre EMPIECE con la búsqueda pesa más que un
// match a mitad de palabra, y que empiece alguna palabra del nombre pesa
// más que un match a mitad de una palabra cualquiera.
const puntuarCoincidencia = (textoNormalizado, palabras) => {
  if (!palabras.length) return 0;
  if (!palabras.every(p => textoNormalizado.includes(p))) return null;

  const palabrasTexto = textoNormalizado.split(/\s+/);
  let puntaje = 0;
  for (const p of palabras) {
    if (textoNormalizado.startsWith(p)) puntaje += 30;
    else if (palabrasTexto.some(w => w.startsWith(p))) puntaje += 15;
    else puntaje += 5; // aparece, pero a mitad de palabra
  }
  return puntaje;
};

export const usePosSearch = (productosBase, categoriasReales, modificadoresGlobales) => {
  const [busqueda, setBusqueda] = useState('');
  const [inputBusquedaActivo, setInputBusquedaActivo] = useState(false);
  const [categoriaActiva, setCategoriaActiva] = useState('Todas');

  // El "Cerebro" que recuerda qué escoge la gente
  const [cerebroBusqueda, setCerebroBusqueda] = useState(() => {
    const memoria = localStorage.getItem('pos_cerebro');
    return memoria ? JSON.parse(memoria) : {};
  });

  const aprenderSeleccion = (productoId, termino) => {
    if (!termino || termino.trim().length < 2) return;
    const terminoLower = termino.trim().toLowerCase();

    setCerebroBusqueda(prev => {
      const nuevoCerebro = { ...prev };
      if (!nuevoCerebro[terminoLower]) nuevoCerebro[terminoLower] = {};
      nuevoCerebro[terminoLower][productoId] = (nuevoCerebro[terminoLower][productoId] || 0) + 1;
      localStorage.setItem('pos_cerebro', JSON.stringify(nuevoCerebro));
      return nuevoCerebro;
    });
  };

  // useMemo evita que este cálculo pesado se haga en CADA mini-render
  const productosFiltrados = useMemo(() => {
    const palabras = normalizar(busqueda).split(/\s+/).filter(Boolean);
    const terminoCerebro = busqueda.trim().toLowerCase();

    return productosBase
      .map(plato => {
        const nombreCatDelPlato = categoriasReales.find(c => String(c.id) === String(plato.categoria))?.nombre || plato.categoria;
        const pasaCategoria = (categoriaActiva === 'Todas' || categoriaActiva === 'Todos') || nombreCatDelPlato === categoriaActiva;
        if (!pasaCategoria) return null;

        if (!palabras.length) {
          plato._coincidenciaVariacion = null;
          return { plato, puntaje: 0 };
        }

        const puntajeNombre = puntuarCoincidencia(normalizar(plato.nombre), palabras);

        const modificadoresDelPlato = modificadoresGlobales.filter(m => String(m.producto_id) === String(plato.id) || String(m.producto) === String(plato.id));
        const variacionCoincidente = modificadoresDelPlato
          .map(m => ({ m, puntaje: puntuarCoincidencia(normalizar(m.nombre), palabras) }))
          .filter(({ puntaje }) => puntaje !== null)
          .sort((a, b) => b.puntaje - a.puntaje)[0];

        if (puntajeNombre === null && !variacionCoincidente) return null;

        plato._coincidenciaVariacion = (puntajeNombre === null && variacionCoincidente) ? variacionCoincidente.m.nombre : null;

        // Un match por nombre siempre pesa más que uno por variación —
        // buscar "pollo" debe mostrar primero los platos de pollo, no un
        // plato cualquiera que tenga una variación de sabor "pollo".
        const puntaje = puntajeNombre !== null ? puntajeNombre + 1000 : (variacionCoincidente?.puntaje || 0);
        return { plato, puntaje };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.puntaje !== b.puntaje) return b.puntaje - a.puntaje;
        if (terminoCerebro.length >= 2) {
          const scoreA = cerebroBusqueda[terminoCerebro]?.[a.plato.id] || 0;
          const scoreB = cerebroBusqueda[terminoCerebro]?.[b.plato.id] || 0;
          if (scoreA !== scoreB) return scoreB - scoreA;
        }
        return 0;
      })
      .map(({ plato }) => plato);
  }, [productosBase, categoriasReales, categoriaActiva, busqueda, modificadoresGlobales, cerebroBusqueda]);

  return {
    busqueda,
    setBusqueda,
    inputBusquedaActivo,
    setInputBusquedaActivo,
    categoriaActiva,
    setCategoriaActiva,
    aprenderSeleccion,
    productosFiltrados
  };
};
