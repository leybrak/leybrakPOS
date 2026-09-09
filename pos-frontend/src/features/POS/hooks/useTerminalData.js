import { useState, useEffect, useRef } from 'react';
import { getMesas, getOrdenes, getSedes, getNegocio ,getEstadoCaja} from '../../../api/api';

export const useTerminalData = (sedeActualId, triggerRecarga, setConfiguracionGlobal, setEstadoCaja) => {
  const [sedes, setSedes] = useState([]);
  const [mesas, setMesas] = useState([]);
  const [ordenesLlevar, setOrdenesLlevar] = useState([]);
  const [todasLasOrdenesActivas, setTodasLasOrdenesActivas] = useState([]);
  const [vistaLocal, setVistaLocal] = useState(null);
  const [modulos, setModulos] = useState({ salon: true, delivery: true, cocina: true });
  const [cargandoCaja, setCargandoCaja] = useState(true); // ← agregar

  // 🔧 Ref que siempre apunta a la sede activa — el WS lo usa para ignorar
  // eventos de mesas de otras sedes cuando se está reconectando.
  const sedeActualIdRef = useRef(sedeActualId);
  useEffect(() => { sedeActualIdRef.current = sedeActualId; }, [sedeActualId]);

  // 1. Configuración del Negocio
  useEffect(() => {
    let isMounted = true;
    const initNegocio = async () => {
      try {
        const negocioId = localStorage.getItem('negocio_id') || 1;
        const { data } = await getNegocio(negocioId);
        if (!isMounted) return;

        const mods = {
          salon: data.mod_salon_activo !== false,
          delivery: data.mod_delivery_activo !== false,
          cocina: data.mod_cocina_activo !== false,
        };
        setModulos(mods);

        if (setConfiguracionGlobal) {
          setConfiguracionGlobal({
            colorPrimario:           data.color_primario || '#ff5a1f',
            temaFondo:               data.tema_fondo     || 'dark',
            ruc:                     data.ruc            || '',
            razon_social:            data.razon_social   || '',
            logo:                    data.logo           || null,
            yape_numero:             data.yape_numero    || '',
            yape_qr:                 data.yape_qr        || null,
            plin_numero:             data.plin_numero    || '',
            plin_qr:                 data.plin_qr        || null,
            // ✅ Automatización Yape/Plin
            confirmacion_automatica: data.confirmacion_automatica || false,
            device_token:            data.device_token            || null,
            negocio_id:              data.id,
            facturacion_emision:     data.facturacion_emision || 'desactivado',
            modulos: mods,
          });
        }

        if (mods.salon) setVistaLocal('salon');
        else if (mods.delivery) setVistaLocal('llevar');
        else setVistaLocal('fastfood');
      } catch {
        if (isMounted) setVistaLocal('salon');
      }
    };
    initNegocio();
    return () => { isMounted = false; };
  }, [setConfiguracionGlobal]);

  // 2. Carga de Sedes
  useEffect(() => {
    let isMounted = true;
    const cargarSedes = async () => {
      try {
        // 🔧 FIX: negocio_id para que el interceptor NO inyecte sede_id
        // y el dueño vea TODAS sus sedes, no solo la activa.
        const negocioId = localStorage.getItem('negocio_id');
        const resSedes = await getSedes({ negocio_id: negocioId });
        if (isMounted) setSedes(resSedes.data);
      } catch (e) {
        console.error('Error cargando sedes:', e);
      }
    };
    cargarSedes();
    return () => { isMounted = false; };
  }, []);

  // 3. Carga de Mesas y Órdenes — reacciona al cambio de sede
  useEffect(() => {
    if (!sedeActualId) return;
    let isMounted = true;

    // 🔧 FIX: Limpiamos las mesas ANTES de cargar las nuevas para que
    // el UI no muestre las mesas de la sede anterior mientras carga.
    setMesas([]);

    const cargarSalon = async () => {
      try {
        const [resMesas, resOrdenes] = await Promise.all([
          getMesas({ sede_id: sedeActualId }),
          getOrdenes({ sede_id: sedeActualId }),
        ]);

        if (!isMounted) return;

        const ordenesVivas = resOrdenes.data.filter(
          (o) => o.estado !== 'completado' && o.estado !== 'cancelado' && o.estado_pago !== 'pagado'
        );

        setTodasLasOrdenesActivas(ordenesVivas);
        setOrdenesLlevar(
          resOrdenes.data
            // 🛠️ Antes solo 'llevar' — las órdenes 'delivery' (bot de WhatsApp)
            // quedaban afuera de esta pestaña y solo aparecían (mal) en el
            // resumen genérico de "Órdenes en curso" del costado.
            .filter((o) => (o.tipo === 'llevar' || o.tipo === 'delivery') && o.estado !== 'completado' && o.estado !== 'cancelado')
            .reverse()
            .slice(0, 10)
        );

        setMesas(
          resMesas.data.map((m) => {
            const orden = ordenesVivas.find(
              (o) => o.mesa !== null && (o.mesa === m.id || o.mesa === m.mesa_principal)
            );
            return {
              id: m.id,
              numero: m.numero_o_nombre || m.id,
              estado: m.mesa_principal ? 'unida' : orden ? 'ocupada' : 'libre',
              unida_a: m.mesa_principal || null,
              capacidad: m.capacidad || 4,
              totalConsumido: orden ? parseFloat(orden.total) : 0,
              posicion_x: m.posicion_x,
              posicion_y: m.posicion_y,
            };
          })
        );
      } catch (e) {
        console.error('Error cargando el salón:', e);
      }
    };

    cargarSalon();
    return () => { isMounted = false; };
  }, [triggerRecarga, sedeActualId]);
  
  useEffect(() => {
    if (!sedeActualId) return;
    const cargarEstadoCaja = async () => {
      try {
        const res = await getEstadoCaja({ sede_id: sedeActualId });
        const estado = res.data?.estado || 'cerrado';
        setEstadoCaja(estado);
        if (res.data?.id) {
          localStorage.setItem('sesion_caja_id', res.data.id);
        }
      } catch {
        setEstadoCaja('cerrado');
      } finally {
        setCargandoCaja(false); // ← siempre termina la carga
      }
    };
    cargarEstadoCaja();
  }, [sedeActualId, triggerRecarga , setEstadoCaja]);
  // Exponemos el ref para que useTerminalWS pueda ignorar eventos de otras sedes
  return {
    sedes, mesas, setMesas, ordenesLlevar, setOrdenesLlevar,
    todasLasOrdenesActivas, vistaLocal, setVistaLocal, modulos,
    sedeActualIdRef,cargandoCaja,
  };
};