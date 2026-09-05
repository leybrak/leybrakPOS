import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Platform, StatusBar
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import EncryptedStorage from 'react-native-encrypted-storage';
import { getOrdenes, getSedes } from '../../api/api';
import useAppStore from '../../store/useAppStore';

// ─── Hook de tema ─────────────────────────────────────────────
const useTema = () => {
  const { configuracionGlobal } = useAppStore();
  const isDark = configuracionGlobal.temaFondo !== 'light';
  const color  = configuracionGlobal.colorPrimario || '#3b82f6';
  return {
    isDark, color,
    bg:        isDark ? '#050505' : '#f0f0f0',
    bgCard:    isDark ? '#121212' : '#ffffff',
    bgCard2:   isDark ? '#161616' : '#f9fafb',
    border:    isDark ? '#1e1e1e' : '#e5e7eb',
    border2:   isDark ? '#222222' : '#d1d5db',
    textPrim:  isDark ? '#ffffff' : '#111111',
    textSec:   isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#4b5563' : '#9ca3af',
    pill:      isDark ? '#121212' : '#ffffff',
    pillBorder:isDark ? '#1e1e1e' : '#e5e7eb',
  };
};

// ─── Filtrar órdenes ──────────────────────────────────────────
const filtrarOrdenes = (ordenes, tipo, sedes, sedeFiltro) => {
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const ayer = new Date(hoy); ayer.setDate(ayer.getDate()-1);
  const inicioSemana = new Date(hoy); inicioSemana.setDate(hoy.getDate()-hoy.getDay()+1);
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const sedeObj = sedes.find(s => s.nombre === sedeFiltro);
  return ordenes.filter(o => {
    if (sedeObj && String(o.sede) !== String(sedeObj.id)) return false;
    const d = new Date((o.creado_en||'').replace(' ','T'));
    const f = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (tipo === 'hoy')    return f.getTime() === hoy.getTime();
    if (tipo === 'ayer')   return f.getTime() === ayer.getTime();
    if (tipo === 'semana') return f >= inicioSemana;
    if (tipo === 'mes')    return f >= inicioMes;
    return true;
  });
};

// ─── Tarjeta métrica ─────────────────────────────────────────
const MetricaCard = ({ titulo, valor, icono, prefijo, t }) => (
  <View style={[s.metricaCard, { backgroundColor: t.bgCard, borderColor: t.border }]}>
    <View style={s.metricaHeader}>
      <Text style={[s.metricaLabel, { color: t.textMuted }]}>{titulo.toUpperCase()}</Text>
      <View style={[s.metricaIconWrapper, { backgroundColor: t.bgCard2, borderColor: t.border2 }]}>
        <Icon name={icono} size={12} color={t.textSec} />
      </View>
    </View>
    <Text style={[s.metricaValor, { color: t.textPrim }]}>
      {prefijo && <Text style={[s.metricaPrefijo, { color: t.textSec }]}>{prefijo} </Text>}
      {valor}
    </Text>
  </View>
);

// ─── Pantalla principal ───────────────────────────────────────
export default function DashboardScreen() {
  const t = useTema();

  const [ordenes, setOrdenes]           = useState([]);
  const [sedes, setSedes]               = useState([]);
  const [sedeFiltro, setSedeFiltro]     = useState('Todas');
  const [tipoFiltro, setTipoFiltro]     = useState('hoy');
  const [cargando, setCargando]         = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [ordenAbierta, setOrdenAbierta] = useState(null);

  const filtros = [
    { id: 'hoy',    label: 'Hoy'    },
    { id: 'ayer',   label: 'Ayer'   },
    { id: 'semana', label: 'Semana' },
    { id: 'mes',    label: 'Mes'    },
  ];

  const cargar = async () => {
    try {
      const nid = await EncryptedStorage.getItem('negocio_id');
      const [resOrdenes, resSedes] = await Promise.all([
        getOrdenes({ negocio_id: nid, modo: 'dashboard' }),
        getSedes({ negocio_id: nid }),
      ]);
      setOrdenes(resOrdenes.data);
      setSedes(resSedes.data);
    } catch (e) {
      console.error('Error cargando dashboard:', e);
    } finally {
      setCargando(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const onRefresh = () => { setRefreshing(true); cargar(); };

  const ordenesFiltradas = useMemo(
    () => filtrarOrdenes(ordenes, tipoFiltro, sedes, sedeFiltro),
    [ordenes, tipoFiltro, sedes, sedeFiltro]
  );

  const metricas = useMemo(() => {
    const ingresos = ordenesFiltradas.reduce((s, o) => s + parseFloat(o.total||0), 0);
    const total    = ordenesFiltradas.length;
    return {
      ingresos: ingresos.toFixed(2),
      total,
      ticket: total > 0 ? (ingresos/total).toFixed(2) : '0.00',
    };
  }, [ordenesFiltradas]);

  const datosGrafico = useMemo(() => {
    const agrup = {};
    ordenesFiltradas.forEach(o => {
      const f = new Date((o.creado_en||'').replace(' ','T'));
      const k = f.toLocaleDateString('es-PE', { weekday:'short', day:'numeric' });
      agrup[k] = (agrup[k]||0) + parseFloat(o.total||0);
    });
    const dias = Object.keys(agrup);
    if (!dias.length) return [];
    const max = Math.max(...Object.values(agrup), 1);
    return dias.slice(-7).map(d => ({
      dia: d, valor: agrup[d].toFixed(2),
      pct: Math.round((agrup[d]/max)*100),
    }));
  }, [ordenesFiltradas]);

  const distribucion = useMemo(() => {
    let salon=0, delivery=0, llevar=0;
    ordenesFiltradas.forEach(o => {
      const tp = (o.origen||o.tipo||'').toLowerCase();
      if (tp.includes('delivery')) delivery++;
      else if (tp.includes('llevar')) llevar++;
      else salon++;
    });
    const total = salon+delivery+llevar||1;
    return {
      salon,    pSalon:    Math.round(salon/total*100),
      delivery, pDelivery: Math.round(delivery/total*100),
      llevar,   pLlevar:   Math.round(llevar/total*100),
    };
  }, [ordenesFiltradas]);

  if (cargando) {
    return (
      <View style={[s.loader, { backgroundColor: t.bg }]}>
        <StatusBar barStyle={t.isDark ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />
        <ActivityIndicator size="large" color={t.color} />
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: t.bg }]}>
      <StatusBar barStyle={t.isDark ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.color} />}
      >
        {/* Header */}
        <View style={s.headerRow}>
          <Text style={[s.titulo, { color: t.textPrim }]}>Dashboard</Text>
          <Text style={[s.fecha, { color: t.textSec }]}>
            {new Date().toLocaleDateString('es-PE', { weekday:'long', day:'numeric', month:'long' })}
          </Text>
        </View>

        {/* Filtro sedes — solo tiene sentido si hay más de una para elegir */}
        {sedes.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.sedesScroll}>
            {['Todas', ...sedes.map(sd => sd.nombre)].map(nombre => (
              <TouchableOpacity
                key={nombre}
                style={[s.sedePill, { backgroundColor: t.pill, borderColor: t.pillBorder },
                  sedeFiltro === nombre && { borderColor: t.color, backgroundColor: t.bgCard2 }]}
                onPress={() => setSedeFiltro(nombre)}
                activeOpacity={0.8}
              >
                <Text style={[s.sedePillText, { color: t.textSec },
                  sedeFiltro === nombre && { color: t.isDark ? '#fff' : '#111' }]}>
                  {nombre}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Filtro tiempo */}
        <View style={s.filtrosRow}>
          {filtros.map(f => (
            <TouchableOpacity
              key={f.id}
              style={[s.filtroPill, { backgroundColor: t.pill, borderColor: t.pillBorder },
                tipoFiltro === f.id && { borderColor: t.color, backgroundColor: t.bgCard2 }]}
              onPress={() => setTipoFiltro(f.id)}
              activeOpacity={0.8}
            >
              <Text style={[s.filtroPillText, { color: t.textSec },
                tipoFiltro === f.id && { color: t.color }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Métricas */}
        <View style={s.metricasGrid}>
          <MetricaCard titulo="Ingresos" valor={metricas.ingresos} icono="dollar"        prefijo="S/" t={t} />
          <MetricaCard titulo="Órdenes"  valor={metricas.total}    icono="shopping-cart"              t={t} />
          <MetricaCard titulo="Ticket"   valor={metricas.ticket}   icono="tag"           prefijo="S/" t={t} />
        </View>

        {/* Gráfico */}
        <View style={[s.card, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          <Text style={[s.cardTitulo, { color: t.textPrim }]}>Evolución de Ventas</Text>
          {datosGrafico.length === 0 ? (
            <View style={s.emptyState}>
              <Icon name="bar-chart" size={28} color={t.textMuted} />
              <Text style={[s.emptyText, { color: t.textMuted }]}>Sin datos para graficar</Text>
            </View>
          ) : (
            <View style={s.grafico}>
              {datosGrafico.map((d, i) => (
                <View key={i} style={s.barraCol}>
                  <Text style={[s.barraValor, { color: t.textSec }]}>S/{d.valor}</Text>
                  <View style={[s.barraContainer, { backgroundColor: t.bgCard2 }]}>
                    <View style={[s.barra, { height: `${d.pct}%`, backgroundColor: t.color }]} />
                  </View>
                  <Text style={[s.barraDia, { color: t.textSec }]}>{d.dia}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Canales */}
        <View style={[s.card, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          <Text style={[s.cardTitulo, { color: t.textPrim }]}>Canales de Venta</Text>
          {ordenesFiltradas.length === 0 ? (
            <View style={s.emptyState}>
              <Icon name="pie-chart" size={28} color={t.textMuted} />
              <Text style={[s.emptyText, { color: t.textMuted }]}>Sin datos</Text>
            </View>
          ) : (
            <>
              <View style={s.barraCanales}>
                <View style={[s.segmento, { flex: distribucion.pSalon,    backgroundColor: t.color   }]} />
                <View style={[s.segmento, { flex: distribucion.pDelivery, backgroundColor: '#10b981' }]} />
                <View style={[s.segmento, { flex: distribucion.pLlevar,   backgroundColor: '#a855f7' }]} />
              </View>
              <View style={s.canalesRow}>
                {[
                  { label:'Salón',    pct: distribucion.pSalon,    cnt: distribucion.salon,    color: t.color   },
                  { label:'Delivery', pct: distribucion.pDelivery, cnt: distribucion.delivery, color:'#10b981'  },
                  { label:'Llevar',   pct: distribucion.pLlevar,   cnt: distribucion.llevar,   color:'#a855f7'  },
                ].map(c => (
                  <View key={c.label} style={[s.canalCard, { backgroundColor: t.bgCard2, borderColor: t.border2 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                      <View style={[s.canalDot, { backgroundColor: c.color }]} />
                      <Text style={[s.canalLabel, { color: t.textSec }]}>{c.label.toUpperCase()}</Text>
                    </View>
                    <Text style={[s.canalPct, { color: t.textPrim }]}>{c.pct}%</Text>
                    <Text style={[s.canalCnt, { color: t.textMuted }]}>{c.cnt} órdenes</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>

        {/* Lista de órdenes */}
        <View style={[s.card, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          <View style={s.ordenesHeader}>
            <Text style={[s.cardTitulo, { color: t.textPrim, marginBottom: 0 }]}>Lista de Órdenes</Text>
            {tipoFiltro === 'hoy' && (
              <View style={s.liveBadge}>
                <View style={s.liveDot} />
                <Text style={s.liveText}>EN VIVO</Text>
              </View>
            )}
          </View>

          {ordenesFiltradas.length === 0 ? (
            <View style={s.emptyState}>
              <Icon name="shopping-bag" size={28} color={t.textMuted} />
              <Text style={[s.emptyText, { color: t.textMuted }]}>Sin resultados</Text>
            </View>
          ) : (
            ordenesFiltradas.map(orden => {
              const abierta = ordenAbierta === orden.id;
              return (
                <TouchableOpacity
                  key={orden.id}
                  style={[s.ordenRow, { backgroundColor: t.bgCard2, borderColor: t.border },
                    abierta && { borderColor: t.color }]}
                  onPress={() => setOrdenAbierta(abierta ? null : orden.id)}
                  activeOpacity={0.8}
                >
                  <View style={s.ordenInfo}>
                    <View style={[s.ordenIcono, { backgroundColor: t.bgCard, borderColor: t.border2 }]}>
                      <Icon name={orden.origen?.toLowerCase().includes('delivery') ? 'truck' : 'cutlery'} size={14} color={t.textSec} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.ordenOrigen, { color: t.textPrim }]}>{orden.origen || `Mesa ${orden.mesa}`}</Text>
                      <Text style={[s.ordenMeta, { color: t.textSec }]}>
                        #{orden.id} · {new Date((orden.creado_en||'').replace(' ','T')).toLocaleTimeString('es-PE', { hour:'2-digit', minute:'2-digit' })}
                      </Text>
                    </View>
                    <Text style={[s.ordenTotal, { color: t.textPrim }]}>S/ {parseFloat(orden.total).toFixed(2)}</Text>
                  </View>

                  {abierta && orden.detalles?.map((d, i) => (
                    <View key={i} style={[s.detalleRow, { borderTopColor: t.border2 }]}>
                      <Text style={[s.detalleCant, { color: t.color }]}>{d.cantidad}x</Text>
                      <Text style={[s.detalleNombre, { color: t.textSec }]}>{d.producto_nombre}</Text>
                      <Text style={[s.detallePrecio, { color: t.textMuted }]}>{(d.cantidad * d.precio_unitario).toFixed(2)}</Text>
                    </View>
                  ))}
                </TouchableOpacity>
              );
            })
          )}
        </View>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container:          { flex: 1 },
  content:            { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 40 },
  loader:             { flex: 1, alignItems: 'center', justifyContent: 'center' },

  headerRow:          { marginBottom: 24 },
  titulo:             { fontSize: 32, fontWeight: '700', letterSpacing: -0.5, marginBottom: 4 },
  fecha:              { fontSize: 13, fontWeight: '500', textTransform: 'capitalize' },

  sedesScroll:        { marginBottom: 16 },
  sedePill:           { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, marginRight: 8, borderWidth: 1 },
  sedePillText:       { fontSize: 13, fontWeight: '600' },

  filtrosRow:         { flexDirection: 'row', gap: 8, marginBottom: 24 },
  filtroPill:         { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', borderWidth: 1 },
  filtroPillText:     { fontSize: 12, fontWeight: '700' },

  metricasGrid:       { flexDirection: 'row', gap: 12, marginBottom: 20 },
  metricaCard:        { flex: 1, borderRadius: 16, padding: 16, borderWidth: 1 },
  metricaHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  metricaLabel:       { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  metricaIconWrapper: { width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  metricaValor:       { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  metricaPrefijo:     { fontSize: 14, fontWeight: '600' },

  card:               { borderRadius: 20, padding: 20, marginBottom: 20, borderWidth: 1 },
  cardTitulo:         { fontSize: 16, fontWeight: '700', marginBottom: 20, letterSpacing: -0.5 },

  emptyState:         { height: 120, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText:          { fontSize: 13, fontWeight: '600' },

  grafico:            { flexDirection: 'row', alignItems: 'flex-end', height: 160, gap: 6 },
  barraCol:           { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barraValor:         { fontSize: 9, fontWeight: '700', marginBottom: 6 },
  barraContainer:     { width: '100%', flex: 1, justifyContent: 'flex-end', borderRadius: 6, overflow: 'hidden' },
  barra:              { width: '100%', borderRadius: 6, minHeight: 4 },
  barraDia:           { fontSize: 10, fontWeight: '600', marginTop: 8, textAlign: 'center', textTransform: 'capitalize' },

  barraCanales:       { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 20 },
  segmento:           { height: '100%' },
  canalesRow:         { flexDirection: 'row', gap: 10 },
  canalCard:          { flex: 1, borderRadius: 14, padding: 12, borderWidth: 1 },
  canalDot:           { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  canalLabel:         { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  canalPct:           { fontSize: 20, fontWeight: '900', marginBottom: 2 },
  canalCnt:           { fontSize: 11, fontWeight: '600' },

  ordenesHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  liveBadge:          { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(16,185,129,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)' },
  liveDot:            { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  liveText:           { fontSize: 9, fontWeight: '800', color: '#10b981', letterSpacing: 1.5 },

  ordenRow:           { borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1 },
  ordenInfo:          { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ordenIcono:         { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  ordenOrigen:        { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  ordenMeta:          { fontSize: 11, fontWeight: '600' },
  ordenTotal:         { fontSize: 16, fontWeight: '900' },

  detalleRow:         { flexDirection: 'row', alignItems: 'center', paddingTop: 12, marginTop: 12, borderTopWidth: 1, gap: 8 },
  detalleCant:        { fontSize: 13, fontWeight: '900', width: 32 },
  detalleNombre:      { flex: 1, fontSize: 13, fontWeight: '500' },
  detallePrecio:      { fontSize: 13, fontWeight: '600' },
});