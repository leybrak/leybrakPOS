"""
Interruptor global de módulos (ModuloGlobal): Leybrak puede apagar un
módulo para todos los negocios sin tocar el flag individual de cada uno.
Viaja como un campo aparte (modulos_globales) en NegocioSerializer.
"""
from datetime import timedelta

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APITestCase

from negocios.models import Negocio, ModuloGlobal


class ModulosGlobalesTest(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user(username='dueno', password='x')
        self.negocio = Negocio.objects.create(
            propietario=self.user, nombre='Mi Negocio',
            fin_prueba=timezone.now() + timedelta(days=30),
            mod_bot_wsp_activo=True,
        )
        self.client.force_authenticate(user=self.user)

    def test_por_defecto_todo_viene_habilitado(self):
        resp = self.client.get(f'/api/negocios/{self.negocio.id}/')
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data['modulos_globales'], {
            'salon': True, 'cocina': True, 'inventario': True, 'delivery': True,
            'clientes': True, 'facturacion': True, 'cartaQr': True, 'botWsp': True,
            'machineLearning': True,
        })

    def test_apagar_globalmente_no_toca_el_flag_del_negocio(self):
        g = ModuloGlobal.actual()
        g.bot_wsp_activo = False
        g.save()

        resp = self.client.get(f'/api/negocios/{self.negocio.id}/')
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertFalse(resp.data['modulos_globales']['botWsp'])
        # El flag real del negocio sigue intacto: al reactivar el interruptor
        # global, el bot vuelve a aparecer tal cual estaba, sin pedirle al
        # dueño que lo prenda de nuevo.
        self.assertTrue(resp.data['mod_bot_wsp_activo'])

        self.negocio.refresh_from_db()
        self.assertTrue(self.negocio.mod_bot_wsp_activo)

    def test_es_singleton(self):
        ModuloGlobal.objects.create(salon_activo=False)
        ModuloGlobal.objects.create(cocina_activo=False)
        self.assertEqual(ModuloGlobal.objects.count(), 1)
        self.assertFalse(ModuloGlobal.objects.first().cocina_activo)
