import secrets

from django.db import migrations


def backfill_bot_token(apps, schema_editor):
    Sede = apps.get_model('negocios', 'Sede')
    for sede in Sede.objects.filter(bot_token=''):
        sede.bot_token = secrets.token_urlsafe(32)
        sede.save(update_fields=['bot_token'])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('negocios', '0089_sede_bot_token'),
    ]

    operations = [
        migrations.RunPython(backfill_bot_token, noop),
    ]
