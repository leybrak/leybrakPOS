import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Platform, StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import EncryptedStorage from 'react-native-encrypted-storage';
import { obtenerAnaliticas } from '../../api/api';
import useAppStore from '../../store/useAppStore';

// ─── Hook de tema (igual que DashboardScreen.jsx) ──────────────
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

const PRESETS = [
  { id: 'hoy', label: 'Hoy' },
  { id: '7d',  label: '7 días' },
  { id: '30d', label: '30 días' },
  { id: 'mes', label: 'Este mes' },
];

const hoyISO = () => new Date().toISOString().split('T')[0];
const restarDias = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().split('T')[0];
};
const inicioDeMesISO = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
};

const calcularRango = (preset) => {
  const hoy = hoyISO();
  switch (preset) {
    case 'hoy': return { fecha_inicio: hoy, fecha_fin: hoy };
    case '7d':  return { fecha_inicio: restarDias(6), fecha_fin: hoy };
    case 'mes': return { fecha_inicio: inicioDeMesISO(), fecha_fin: hoy };
    case '30d':
    default:    return { fecha_inicio: restarDias(29), fecha_fin: hoy };
  }
};

const formatearFechaCorta = (iso) => {
  const [, mes, dia] = iso.split('-');
  return `${dia}/${mes}`;
};

const MetricaCard = ({ titulo, valor, icono, prefijo, t }) => (
  <View style={[s.metricaCard, { backgroundColor: t.bgCard, borderColor: t.border }]}>
    <View style={s.metricaHeader}>
      <Text style={[s.metricaLabel, { color: t.textMuted }]}>{titulo.toUpperCase()}</Text>
      <View style={[s.metricaIconWrapper, { backgroundColor: t.bgCard2, borderColor: t.border2 }]}>
        <Icon name={icono} size={12} color={t.textSec} />
      </View>
    </View>
    <Text style={[s.metricaValor, { color: t.textPrim }]} numberOfLines={1} adjustsFontSizeToFit>
      {prefijo && <Text style={[s.metricaPrefijo, { color: t.textSec }]}>{prefijo} </Text>}
      {valor}
    </Text>
  </View>
);

// ─── Fila de ranking (top productos/categorías) — barra horizontal
// proporcional al máximo del grupo, mismo estilo de tarjeta que el resto
// del ERP mobile. ─────────────────────────────────────────────────────
const FilaRanking = ({ nombre, cantidad, maxCantidad, color, t }) => {
  const pct = maxCantidad > 0 ? Math.max(6, Math.round((cantidad / maxCantidad) * 100)) : 0;
  return (
    <View style={s.rankingFila}>
      <View style={s.rankingHeader}>
        <Text style={[s.rankingNombre, { color: t.textPrim }]} numberOfLines={1}>{nombre}</Text>
        <Text style={[s.rankingCantidad, { color: t.textSec }]}>{cantidad}</Text>
      </View>
      <View style={[s.rankingBarraFondo, { backgroundColor: t.bgCard2 }]}>
        <View style={[s.rankingBarra, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
};

export default function AnaliticasScreen() {
  const t = useTema();

  const [preset, setPreset]         = useState('30d');
  const [sedeId, setSedeId]         = useState('');
  const [datos, setDatos]           = useState(null);
  const [cargando, setCargando]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      const negocioId = await EncryptedStorage.getItem('negocio_id');
      const sid = await EncryptedStorage.getItem('sede_id');
      setSedeId(sid || '');
      const { fecha_inicio, fecha_fin } = calcularRango(preset);
      const { data } = await obtenerAnaliticas({
        negocio_id: negocioId, sede_id: sid, fecha_inicio, fecha_fin,
      });
      setDatos(data);
    } catch (e) {
      setError('No se pudieron cargar las analíticas.');
    } finally {
      setCargando(false);
      setRefreshing(false);
    }
  }, [preset]);

  useEffect(() => { cargar(); }, [cargar]);

  const onRefresh = () => { setRefreshing(true); cargar(); };

  const evolucion = datos?.evolucion_ventas || [];
  const maxIngresoDia = useMemo(
    () => Math.max(...evolucion.map(d => d.ingresos), 1),
    [evolucion]
  );

  const horasConVentas = datos?.horas_pico || [];
  const maxOrdenesHora = useMemo(
    () => Math.max(...horasConVentas.map(h => h.ordenes), 1),
    [horasConVentas]
  );

  const maxCantidadProducto = useMemo(
    () => Math.max(...(datos?.productos_top || []).map(p => p.cantidad), 1),
    [datos]
  );
  const maxCantidadCategoria = useMemo(
    () => Math.max(...(datos?.categorias_top || []).map(c => c.cantidad), 1),
    [datos]
  );

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
        <View style={s.headerRow}>
          <Text style={[s.titulo, { color: t.textPrim }]}>Analíticas</Text>
          <Text style={[s.fecha, { color: t.textSec }]}>
            {datos ? `${datos.rango.fecha_inicio} — ${datos.rango.fecha_fin}` : ''}
          </Text>
        </View>

        {/* Filtro de periodo */}
        <View style={s.filtrosRow}>
          {PRESETS.map(p => (
            <TouchableOpacity
              key={p.id}
              style={[s.filtroPill, { backgroundColor: t.pill, borderColor: t.pillBorder },
                preset === p.id && { borderColor: t.color, backgroundColor: t.bgCard2 }]}
              onPress={() => setPreset(p.id)}
              activeOpacity={0.8}
            >
              <Text style={[s.filtroPillText, { color: t.textSec },
                preset === p.id && { color: t.color }]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {error ? (
          <View style={[s.card, { backgroundColor: t.bgCard, borderColor: t.border }]}>
            <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 13 }}>{error}</Text>
          </View>
        ) : (
          <>
            {/* Métricas */}
            <View style={s.metricasGrid}>
              <MetricaCard titulo="Ingresos" valor={(datos?.resumen.ingresos_totales ?? 0).toFixed(2)} icono="dollar" prefijo="S/" t={t} />
              <MetricaCard titulo="Órdenes" valor={String(datos?.resumen.total_ordenes ?? 0)} icono="shopping-cart" t={t} />
              <MetricaCard titulo="Ticket" valor={(datos?.resumen.ticket_promedio ?? 0).toFixed(2)} icono="tag" prefijo="S/" t={t} />
            </View>

            {/* Evolución de ventas — scroll horizontal, una barra por día */}
            <View style={[s.card, { backgroundColor: t.bgCard, borderColor: t.border }]}>
              <Text style={[s.cardTitulo, { color: t.textPrim }]}>Evolución de Ventas</Text>
              {evolucion.length === 0 ? (
                <View style={s.emptyState}>
                  <Icon name="bar-chart" size={28} color={t.textMuted} />
                  <Text style={[s.emptyText, { color: t.textMuted }]}>Sin ventas en este periodo</Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={s.grafico}>
                    {evolucion.map((d) => {
                      const pct = Math.max(4, Math.round((d.ingresos / maxIngresoDia) * 100));
                      return (
                        <View key={d.fecha} style={s.barraColFija}>
                          <View style={[s.barraContainer, { backgroundColor: t.bgCard2 }]}>
                            <View style={[s.barra, { height: `${pct}%`, backgroundColor: t.color }]} />
                          </View>
                          <Text style={[s.barraDia, { color: t.textSec }]}>{formatearFechaCorta(d.fecha)}</Text>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              )}
            </View>

            {/* Productos más vendidos */}
            <View style={[s.card, { backgroundColor: t.bgCard, borderColor: t.border }]}>
              <Text style={[s.cardTitulo, { color: t.textPrim }]}>Productos Más Vendidos</Text>
              {(datos?.productos_top || []).length === 0 ? (
                <View style={s.emptyState}>
                  <Icon name="cutlery" size={28} color={t.textMuted} />
                  <Text style={[s.emptyText, { color: t.textMuted }]}>Sin ventas en este periodo</Text>
                </View>
              ) : (
                datos.productos_top.map(p => (
                  <FilaRanking key={p.producto_id} nombre={p.nombre} cantidad={p.cantidad} maxCantidad={maxCantidadProducto} color={t.color} t={t} />
                ))
              )}
            </View>

            {/* Categorías más vendidas */}
            <View style={[s.card, { backgroundColor: t.bgCard, borderColor: t.border }]}>
              <Text style={[s.cardTitulo, { color: t.textPrim }]}>Categorías Más Vendidas</Text>
              {(datos?.categorias_top || []).length === 0 ? (
                <View style={s.emptyState}>
                  <Icon name="tags" size={28} color={t.textMuted} />
                  <Text style={[s.emptyText, { color: t.textMuted }]}>Sin ventas en este periodo</Text>
                </View>
              ) : (
                datos.categorias_top.map(c => (
                  <FilaRanking key={c.categoria_id ?? c.nombre} nombre={c.nombre} cantidad={c.cantidad} maxCantidad={maxCantidadCategoria} color="#10b981" t={t} />
                ))
              )}
            </View>

            {/* Horas pico */}
            <View style={[s.card, { backgroundColor: t.bgCard, borderColor: t.border }]}>
              <Text style={[s.cardTitulo, { color: t.textPrim, marginBottom: 4 }]}>Horas Pico</Text>
              <Text style={[s.cardSubtitulo, { color: t.textSec }]}>Órdenes por hora, sumado en todo el periodo</Text>
              <View style={s.graficoHoras}>
                {horasConVentas.map((h) => {
                  const pct = h.ordenes > 0 ? Math.max(4, Math.round((h.ordenes / maxOrdenesHora) * 100)) : 0;
                  return (
                    <View key={h.hora} style={s.barraColHora}>
                      <View style={[s.barraContainer, { backgroundColor: t.bgCard2 }]}>
                        <View style={[s.barra, { height: `${pct}%`, backgroundColor: t.color, minHeight: pct > 0 ? 4 : 0 }]} />
                      </View>
                      {h.hora % 4 === 0 && (
                        <Text style={[s.barraHoraLabel, { color: t.textSec }]}>{h.hora}h</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        )}
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
  fecha:              { fontSize: 13, fontWeight: '500' },

  filtrosRow:         { flexDirection: 'row', gap: 8, marginBottom: 24 },
  filtroPill:         { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', borderWidth: 1 },
  filtroPillText:     { fontSize: 12, fontWeight: '700' },

  metricasGrid:       { flexDirection: 'row', gap: 12, marginBottom: 20 },
  metricaCard:        { flex: 1, borderRadius: 16, padding: 16, borderWidth: 1 },
  metricaHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  metricaLabel:       { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  metricaIconWrapper: { width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  metricaValor:       { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  metricaPrefijo:     { fontSize: 13, fontWeight: '600' },

  card:               { borderRadius: 20, padding: 20, marginBottom: 20, borderWidth: 1 },
  cardTitulo:         { fontSize: 16, fontWeight: '700', marginBottom: 20, letterSpacing: -0.5 },
  cardSubtitulo:      { fontSize: 11, fontWeight: '600', marginTop: -14, marginBottom: 16 },

  emptyState:         { height: 100, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText:          { fontSize: 13, fontWeight: '600' },

  grafico:            { flexDirection: 'row', alignItems: 'flex-end', height: 140, gap: 8, paddingRight: 8 },
  barraColFija:       { width: 32, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barraContainer:     { width: '100%', flex: 1, justifyContent: 'flex-end', borderRadius: 6, overflow: 'hidden' },
  barra:              { width: '100%', borderRadius: 6, minHeight: 4 },
  barraDia:           { fontSize: 9, fontWeight: '600', marginTop: 6, textAlign: 'center' },

  graficoHoras:       { flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: 3 },
  barraColHora:       { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barraHoraLabel:     { fontSize: 8, fontWeight: '600', marginTop: 4 },

  rankingFila:        { marginBottom: 14 },
  rankingHeader:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  rankingNombre:      { fontSize: 13, fontWeight: '700', flex: 1, marginRight: 8 },
  rankingCantidad:    { fontSize: 12, fontWeight: '800' },
  rankingBarraFondo:  { height: 8, borderRadius: 4, overflow: 'hidden' },
  rankingBarra:       { height: '100%', borderRadius: 4 },
});
