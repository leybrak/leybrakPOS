import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  StatusBar, ActivityIndicator, Alert, ScrollView,
  KeyboardAvoidingView, Platform
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import EncryptedStorage from 'react-native-encrypted-storage';
import { loginMovil, loginPinEmpleado, getSedes, guardarTokens, getEstadoCaja } from '../../api/api';

// ─── Teclado PIN ──────────────────────────────────────────────
function TecladoPin({ pin, onTecla, onBorrar, onLimpiar }) {
  const teclas = [1, 2, 3, 4, 5, 6, 7, 8, 9, 'limpiar', 0, 'borrar'];
  return (
    <View style={tk.grid}>
      {teclas.map((t, i) => {
        const esBorrar = t === 'borrar';
        const esLimpiar = t === 'limpiar';

        return (
          <TouchableOpacity
            key={i}
            style={[
              tk.tecla,
              esBorrar && tk.teclaBorrar,
              esLimpiar && tk.teclaLimpiar
            ]}
            activeOpacity={0.7}
            onPress={() => {
              if (esBorrar) onBorrar();
              else if (esLimpiar) onLimpiar();
              else onTecla(String(t));
            }}
          >
            {esBorrar ? (
              <Icon name="arrow-left" size={20} color="#6b7280" />
            ) : esLimpiar ? (
              <Text style={tk.teclaLimpiarText}>LIMPIAR</Text>
            ) : (
              <Text style={tk.teclaText}>{t}</Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const tk = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 24,
  },
  tecla: {
    width: '31%',
    height: 64,
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#1e1e1e',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  teclaBorrar: {
    backgroundColor: '#121212',
  },
  teclaLimpiar: {
    backgroundColor: '#121212',
  },
  teclaText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '500',
  },
  teclaLimpiarText: {
    color: '#6b7280',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
});

// ─── Pantalla principal ───────────────────────────────────────
export default function LoginScreen({ onLoginExitoso }) {
  const [modo, setModo]                 = useState('inicio');
  const [usuario, setUsuario]           = useState('');
  const [password, setPassword]         = useState('');
  const [showPass, setShowPass]         = useState(false);
  const [pin, setPin]                   = useState('');
  const [cargando, setCargando]         = useState(false);
  const [sedes, setSedes]               = useState([]);
  const [sedeSeleccionada, setSedeSeleccionada] = useState(null);
  const [negocioNombre, setNegocioNombre]   = useState('');
  const [sedeNombre, setSedeNombre]         = useState('');
  const [bloqueadoSeg, setBloqueadoSeg]     = useState(0);
  const [hora, setHora]                     = useState('');
  const [fecha, setFecha]                   = useState('');
  const [cajaAbierta, setCajaAbierta]       = useState(null);   // null=desconocido

  // Reloj
  useEffect(() => {
    const tick = () => {
      const ahora = new Date();
      setHora(ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true }));
      setFecha(ahora.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Countdown bloqueo
  useEffect(() => {
    if (bloqueadoSeg <= 0) return;
    const id = setTimeout(() => setBloqueadoSeg(s => s - 1), 1000);
    return () => clearTimeout(id);
  }, [bloqueadoSeg]);

  // Verificar si ya hay sede configurada
  useEffect(() => {
    const init = async () => {
      const sede = await EncryptedStorage.getItem('sede_id');
      const nombre = await EncryptedStorage.getItem('sede_nombre');
      const negocio = await EncryptedStorage.getItem('negocio_nombre');
      if (sede) {
        setSedeNombre(nombre || 'Sede Principal');
        setNegocioNombre(negocio || '');
        setModo('pin');
      }
    };
    init();
  }, []);

  // Estado de la caja (badge + saber si está cerrada). Solo en la pantalla de PIN.
  useEffect(() => {
    if (modo !== 'pin') return;
    let activo = true;
    const check = async () => {
      try {
        const sedeId = await EncryptedStorage.getItem('sede_id');
        if (!sedeId) return;
        const res = await getEstadoCaja({ sede_id: sedeId });
        if (activo) setCajaAbierta(res.data?.estado === 'abierto');
      } catch (_) { /* sin info → badge neutro, el server decide al ingresar */ }
    };
    check();
    const id = setInterval(check, 12000);
    return () => { activo = false; clearInterval(id); };
  }, [modo]);

  const handleLogin = async () => {
    if (!usuario.trim() || !password.trim()) {
      Alert.alert('Error', 'Ingresa usuario y contraseña.');
      return;
    }
    setCargando(true);
    try {
      const res = await loginMovil({ username: usuario.trim(), password });
      const { access, refresh, negocio_id, rol, nombre, empleado_id } = res.data;

      await guardarTokens(access, refresh);
      await EncryptedStorage.setItem('negocio_id',     String(negocio_id));
      await EncryptedStorage.setItem('usuario_rol',    rol);
      await EncryptedStorage.setItem('usuario_nombre', nombre);
      // ✅ Guardar empleado_id del dueño
      if (empleado_id) {
        await EncryptedStorage.setItem('empleado_id', String(empleado_id));
      }

      onLoginExitoso({ negocio_id, rol, nombre, tipo: 'dueno' });
    } catch (error) {
      const esErrorAuth = error.response?.status === 400 || error.response?.status === 401 || error.response?.status === 403;
      Alert.alert('Error', esErrorAuth ? 'Credenciales inválidas.' : 'Error de conexión. Inténtalo de nuevo.');
    } finally {
      setCargando(false);
    }
  };

  const handleLoginParaPos = async () => {
    if (!usuario.trim() || !password.trim()) {
      Alert.alert('Error', 'Ingresa usuario y contraseña.');
      return;
    }
    setCargando(true);
    try {
      const res = await loginMovil({ username: usuario.trim(), password });
      const { access, refresh, negocio_id, nombre } = res.data;

      await guardarTokens(access, refresh);
      await EncryptedStorage.setItem('negocio_id',     String(negocio_id));
      await EncryptedStorage.setItem('negocio_nombre', nombre);

      const resSedes = await getSedes({ negocio_id });
      setSedes(resSedes.data);
      if (resSedes.data.length > 0) setSedeSeleccionada(resSedes.data[0]);
      setModo('setup_sede');
    } catch (error) {
      const esErrorAuth = error.response?.status === 400 || error.response?.status === 401 || error.response?.status === 403;
      Alert.alert('Error', esErrorAuth ? 'Credenciales inválidas.' : 'Error de conexión. Inténtalo de nuevo.');
    } finally {
      setCargando(false);
    }
  };

  const confirmarSede = async () => {
    if (!sedeSeleccionada) return;
    await EncryptedStorage.setItem('sede_id',     String(sedeSeleccionada.id));
    await EncryptedStorage.setItem('sede_nombre', sedeSeleccionada.nombre);
    setSedeNombre(sedeSeleccionada.nombre);
    setModo('pin');
  };

  const procesarPin = async () => {
    if (pin.length !== 4 || bloqueadoSeg > 0) return;
    setCargando(true);
    try {
      const sedeId = await EncryptedStorage.getItem('sede_id');
      const res = await loginPinEmpleado({ pin, sede_id: sedeId, accion: 'entrar' });
      const empleado = res.data;

      setBloqueadoSeg(0);
      await EncryptedStorage.setItem('empleado_id',     String(empleado.id));
      await EncryptedStorage.setItem('empleado_nombre', empleado.nombre);
      await EncryptedStorage.setItem('usuario_rol',     empleado.rol);
      await EncryptedStorage.setItem('es_repartidor',   empleado.puede_repartir ? '1' : '0');

      setPin('');
      onLoginExitoso({ ...empleado, tipo: 'empleado', es_repartidor: !!empleado.puede_repartir });
    } catch (error) {
      const data = error.response?.data || {};
      if (error.response?.status === 429) {
        setBloqueadoSeg(data.segundos_restantes || 120);
        Alert.alert('Bloqueado', data.error || 'Terminal bloqueada. Espera unos minutos.');
      } else if (error.response?.status === 403 && data.caja_cerrada) {
        setCajaAbierta(false);
        Alert.alert('Caja cerrada', data.error || 'La caja está cerrada. Pídele al encargado que la abra.');
      } else {
        Alert.alert('Error', 'PIN incorrecto. Inténtalo de nuevo.');
      }
      setPin('');
    } finally {
      setCargando(false);
    }
  };

  // ════════════════════════════════════════════════════════════
  // RENDER: INICIO
  // ════════════════════════════════════════════════════════════
  if (modo === 'inicio') {
    return (
      <View style={s.container}>
        <StatusBar barStyle="light-content" backgroundColor="#050505" />
        
        {/* Header */}
        <View style={s.headerAbsolute}>
          <Text style={s.brand}>LEYBRAK<Text style={s.brandBlue}> POS</Text></Text>
          <View style={s.badge}><Text style={s.badgeText}>SAAS PLATFORM</Text></View>
        </View>

        <View style={s.contentCentered}>
          <View style={s.cardWrapper}>
            <Text style={s.titulo}>Bienvenido</Text>
            <Text style={s.subtitulo}>Selecciona cómo deseas acceder a la plataforma hoy.</Text>

            <View style={{ gap: 16, marginTop: 24, width: '100%' }}>
              <TouchableOpacity style={s.opcionBtn} onPress={() => setModo('login_erp')} activeOpacity={0.8}>
                <View style={s.opcionIcono}>
                  <Icon name="pie-chart" size={18} color="#9ca3af" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.opcionTitulo}>Panel de Control</Text>
                  <Text style={s.opcionSub}>Gestión, reportes y configuración</Text>
                </View>
                <Icon name="chevron-right" size={16} color="#4b5563" />
              </TouchableOpacity>

              <TouchableOpacity style={s.opcionBtn} onPress={() => setModo('login_pos')} activeOpacity={0.8}>
                <View style={s.opcionIcono}>
                  <Icon name="desktop" size={18} color="#9ca3af" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.opcionTitulo}>Terminal POS</Text>
                  <Text style={s.opcionSub}>Punto de venta y caja</Text>
                </View>
                <Icon name="chevron-right" size={16} color="#4b5563" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Botón Legal */}
        <TouchableOpacity style={s.legalBtn}>
          <Icon name="exclamation-circle" size={12} color="#6b7280" />
          <Text style={s.legalText}>LEGAL</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════
  // RENDER: LOGIN (ERP o POS)
  // ════════════════════════════════════════════════════════════
  if (modo === 'login_erp' || modo === 'login_pos') {
    const esErp = modo === 'login_erp';
    return (
      <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <StatusBar barStyle="light-content" backgroundColor="#050505" />
        
        <View style={s.headerAbsolute}>
          <Text style={s.brand}>LEYBRAK<Text style={s.brandBlue}> POS</Text></Text>
          <View style={s.badge}><Text style={s.badgeText}>SAAS PLATFORM</Text></View>
        </View>

        <ScrollView contentContainerStyle={s.contentCentered} keyboardShouldPersistTaps="handled">
          <View style={s.cardWrapper}>
            <TouchableOpacity onPress={() => setModo('inicio')} style={s.backBtn}>
              <Icon name="arrow-left" size={14} color="#6b7280" style={{marginRight: 8}}/>
              <Text style={s.backText}>Volver</Text>
            </TouchableOpacity>

            <Text style={s.titulo}>Iniciar Sesión</Text>
            <Text style={s.subtitulo}>Ingresa tus credenciales para acceder al sistema.</Text>

            <View style={s.formGroup}>
              <Text style={s.label}>USUARIO / CORREO</Text>
              <View style={s.inputWrapper}>
                <Icon name="user" size={18} color="#6b7280" style={s.inputIcon} />
                <TextInput
                  style={s.input}
                  value={usuario}
                  onChangeText={setUsuario}
                  placeholder="ejemplo@correo.com"
                  placeholderTextColor="#4b5563"
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            </View>

            <View style={s.formGroup}>
              <Text style={s.label}>CONTRASEÑA</Text>
              <View style={s.inputWrapper}>
                <Icon name="lock" size={18} color="#6b7280" style={s.inputIcon} />
                <TextInput
                  style={s.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#4b5563"
                  secureTextEntry={!showPass}
                />
                <TouchableOpacity style={s.eyeIcon} onPress={() => setShowPass(!showPass)}>
                  <Icon name={showPass ? "eye-slash" : "eye"} size={18} color="#6b7280" />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[s.buttonPrimary, cargando && s.buttonDisabled, { marginTop: 8 }]}
              onPress={esErp ? handleLogin : handleLoginParaPos}
              disabled={cargando}
              activeOpacity={0.8}
            >
              {cargando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={s.buttonText}>{esErp ? 'Ingresar al Panel' : 'Vincular Terminal'}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ════════════════════════════════════════════════════════════
  // RENDER: SETUP SEDE
  // ════════════════════════════════════════════════════════════
  if (modo === 'setup_sede') {
    return (
      <View style={s.container}>
        <StatusBar barStyle="light-content" backgroundColor="#050505" />
        <View style={s.contentCentered}>
          <View style={s.cardWrapper}>
            <Text style={s.titulo}>Configurar Caja</Text>
            <Text style={s.subtitulo}>Selecciona la sucursal para este dispositivo.</Text>

            <View style={{ width: '100%', gap: 12, marginTop: 16 }}>
              <Text style={s.label}>SEDE / LOCAL</Text>
              {sedes.map(sede => (
                <TouchableOpacity
                  key={sede.id}
                  style={[s.opcionBtn, sedeSeleccionada?.id === sede.id && s.opcionBtnActivo]}
                  onPress={() => setSedeSeleccionada(sede)}
                  activeOpacity={0.8}
                >
                  <Icon name="map-marker" size={20} color={sedeSeleccionada?.id === sede.id ? "#3b82f6" : "#6b7280"} />
                  <Text style={[s.opcionTitulo, { marginLeft: 12, flex: 1 }]}>{sede.nombre}</Text>
                  {sedeSeleccionada?.id === sede.id && <Icon name="check" size={16} color="#3b82f6" />}
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[s.buttonPrimary, { marginTop: 24 }]}
              onPress={confirmarSede}
              activeOpacity={0.8}
            >
              <Text style={s.buttonText}>Vincular Dispositivo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════
  // RENDER: PIN
  // ════════════════════════════════════════════════════════════
  if (modo === 'pin') {
    return (
      <View style={s.container}>
        <StatusBar barStyle="light-content" backgroundColor="#050505" />
        <View style={s.pinWrapper}>
          
          <View style={s.pinHeader}>
            <View style={s.brandRow}>
              <Text style={s.brand}>LEYBRAK<Text style={s.brandBlue}>POS</Text></Text>
            </View>
            <Text style={s.negocioNombre}>{negocioNombre || 'Terminal de Caja'}</Text>
            <Text style={s.sedeNombre}>{sedeNombre}</Text>

            <View style={s.estadoBadge}>
               <View style={[s.estadoDot, { backgroundColor:
                 bloqueadoSeg > 0 ? '#ef4444'
                 : cajaAbierta === false ? '#ef4444'
                 : cajaAbierta ? '#10b981'
                 : '#6b7280' }]} />
               <Text style={s.estadoText}>
                 {bloqueadoSeg > 0 ? 'BLOQUEADO'
                   : cajaAbierta === false ? 'CAJA CERRADA'
                   : cajaAbierta ? 'CAJA ABIERTA'
                   : 'CONECTANDO...'}
               </Text>
            </View>

            <View style={s.clockContainer}>
              <Text style={s.hora}>{hora || '--:--'}</Text>
              <Text style={s.fecha}>{fecha}</Text>
            </View>
          </View>

          {/* Puntos PIN */}
          <View style={s.pinDots}>
            {[0, 1, 2, 3].map(i => {
              const isActive = pin.length > i;
              return (
                <View
                  key={i}
                  style={[
                    s.dot,
                    isActive && s.dotActive,
                    bloqueadoSeg > 0 && s.dotBlocked,
                  ]}
                />
              );
            })}
          </View>

          {bloqueadoSeg > 0 && (
            <View style={s.bloqueoAlert}>
              <Icon name="lock" size={14} color="#f87171" style={{ marginRight: 6 }}/>
              <Text style={s.bloqueoText}>BLOQUEADO {bloqueadoSeg}s</Text>
            </View>
          )}

          <TecladoPin
            pin={pin}
            onTecla={(t) => pin.length < 4 && setPin(pin + t)}
            onBorrar={() => setPin(pin.slice(0, -1))}
            onLimpiar={() => setPin('')}
          />

          <TouchableOpacity
            style={[s.buttonPrimary, (pin.length < 4 || bloqueadoSeg > 0 || cargando) && s.buttonDisabled]}
            onPress={procesarPin}
            disabled={pin.length < 6 || bloqueadoSeg > 0 || cargando}
            activeOpacity={0.8}
          >
            {cargando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.buttonText}>
                {bloqueadoSeg > 0 ? `Esperar ${bloqueadoSeg}s...` : 'Ingresar PIN'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={{ marginTop: 20, padding: 10 }}
            onPress={() => setModo('inicio')}
          >
            <Text style={s.cambiarDispositivoText}>Cambiar dispositivo</Text>
          </TouchableOpacity>

        </View>

        <TouchableOpacity style={s.legalBtn}>
          <Icon name="exclamation-circle" size={12} color="#6b7280" />
          <Text style={s.legalText}>LEGAL</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#050505' },
  headerAbsolute:  { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 70, left: 25, flexDirection: 'row', alignItems: 'center', zIndex: 10 },
  brandRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  brand:           { fontSize: 24, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  brandBlue:       { color: '#3b82f6' },
  badge:           { marginLeft: 12, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#121212', borderWidth: 1, borderColor: '#222', borderRadius: 6 },
  badgeText:       { color: '#6b7280', fontSize: 9, fontWeight: '800', letterSpacing: 2 },
  
  contentCentered: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  cardWrapper:     { width: '100%', maxWidth: 400 },
  
  titulo:          { fontSize: 32, fontWeight: '700', color: '#fff', marginBottom: 6, letterSpacing: -0.5 },
  subtitulo:       { fontSize: 14, color: '#9ca3af', marginBottom: 32 },
  
  opcionBtn:       { width: '100%', backgroundColor: '#121212', borderWidth: 1, borderColor: '#1e1e1e', borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'center' },
  opcionBtnActivo: { borderColor: '#3b82f6', backgroundColor: '#161616' },
  opcionIcono:     { width: 44, height: 44, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  opcionTitulo:    { color: '#fff', fontSize: 15, fontWeight: '600' },
  opcionSub:       { color: '#6b7280', fontSize: 12, marginTop: 4 },
  
  backBtn:         { flexDirection: 'row', alignItems: 'center', marginBottom: 32 },
  backText:        { color: '#6b7280', fontSize: 13, fontWeight: '600' },
  
  formGroup:       { marginBottom: 16 },
  label:           { fontSize: 11, fontWeight: '800', color: '#6b7280', letterSpacing: 1.5, marginBottom: 8, marginLeft: 4 },
  inputWrapper:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#121212', borderWidth: 1, borderColor: '#222', borderRadius: 14, height: 56, paddingHorizontal: 16 },
  inputIcon:       { marginRight: 12 },
  input:           { flex: 1, color: '#fff', fontSize: 15, height: '100%' },
  eyeIcon:         { padding: 8 },
  
  buttonPrimary:   { width: '100%', backgroundColor: '#3b82f6', borderRadius: 14, paddingVertical: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  buttonDisabled:  { opacity: 0.5 },
  buttonText:      { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
  
  // PIN Styles
  pinWrapper:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, width: '100%', maxWidth: 380, alignSelf: 'center' },
  pinHeader:       { alignItems: 'center', width: '100%', marginBottom: 24 },
  negocioNombre:   { fontSize: 14, fontWeight: '600', color: '#d1d5db', letterSpacing: 0.5 },
  sedeNombre:      { fontSize: 10, fontWeight: '800', color: '#6b7280', letterSpacing: 3, marginTop: 4, textTransform: 'uppercase' },
  estadoBadge:     { marginTop: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#121212', borderWidth: 1, borderColor: '#222', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  estadoDot:       { width: 6, height: 6, borderRadius: 3, marginRight: 8 },
  estadoText:      { color: '#9ca3af', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  clockContainer:  { marginTop: 24, alignItems: 'center' },
  hora:            { fontSize: 56, fontWeight: '300', color: '#fff', letterSpacing: -1 },
  fecha:           { fontSize: 13, color: '#6b7280', fontWeight: '500', marginTop: 4, textTransform: 'capitalize' },
  
  pinDots:         { flexDirection: 'row', gap: 16, marginBottom: 32 },
  dot:             { width: 12, height: 12, borderRadius: 6, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a' },
  dotActive:       { backgroundColor: '#3b82f6', borderColor: '#3b82f6', shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 10, elevation: 8 },
  dotBlocked:      { backgroundColor: '#ef4444', borderColor: '#ef4444' },
  
  bloqueoAlert:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 24, width: '100%' },
  bloqueoText:     { color: '#f87171', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  
  cambiarDispositivoText: { color: '#6b7280', fontSize: 12, fontWeight: '600' },
  
  // Boton flotante legal
  legalBtn:        { position: 'absolute', bottom: 35, right: 24, flexDirection: 'row', alignItems: 'center', backgroundColor: '#121212', borderWidth: 1, borderColor: '#1e1e1e', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  legalText:       { color: '#6b7280', fontSize: 10, fontWeight: '800', letterSpacing: 2, marginLeft: 6 },
});