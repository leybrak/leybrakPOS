import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

const negocios = new SharedArray('negocios', function () {
  return JSON.parse(open('./loadtest_data.json'));
});

const BASE = __ENV.BASE_URL || 'http://localhost:18000';

export const options = {
  scenarios: {
    ramping: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '20s', target: 30 },
        { duration: '20s', target: 30 },
        { duration: '20s', target: 100 },
        { duration: '20s', target: 100 },
        { duration: '20s', target: 200 },
        { duration: '25s', target: 200 },
        { duration: '20s', target: 300 },
        { duration: '25s', target: 300 },
        { duration: '20s', target: 400 },
        { duration: '25s', target: 400 },
        { duration: '15s', target: 0 },
      ],
    },
  },
};

export default function () {
  const idx = __VU % negocios.length;
  const n = negocios[idx];
  const headers = {
    'Content-Type': 'application/json',
    'Cookie': `access_token=${n.access_token}`,
    'X-Empleado-Id': String(n.empleado_id),
  };

  // 1. Crear orden (mesero toma el pedido)
  const crearPayload = JSON.stringify({
    sede: n.sede_id,
    tipo: 'llevar',
    detalles: [{ producto: n.producto_id, cantidad: 1 }],
  });
  const crearRes = http.post(`${BASE}/api/ordenes/`, crearPayload, { headers, tags: { name: 'crear_orden' } });
  const crearOk = check(crearRes, { 'crear orden 201': (r) => r.status === 201 });

  if (!crearOk) {
    sleep(1);
    return;
  }

  const ordenId = crearRes.json('id');
  sleep(0.5); // pausa corta antes de cobrar

  // 2. Cobrar (cajero cierra la cuenta)
  const cobrarPayload = JSON.stringify({
    pagos: [{ metodo: 'efectivo', monto: '20.00' }],
    sesion_caja_id: n.sesion_caja_id,
  });
  const cobrarRes = http.post(`${BASE}/api/ordenes/${ordenId}/cobrar_orden/`, cobrarPayload, { headers, tags: { name: 'cobrar_orden' } });
  check(cobrarRes, { 'cobrar orden 200': (r) => r.status === 200 });

  sleep(1 + Math.random() * 2); // ritmo realista: 1-3s entre pedidos por cajero
}
