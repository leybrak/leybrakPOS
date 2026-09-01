FROM python:3.11-slim

# Evita que Python escriba archivos .pyc y fuerza a que la consola muestre logs en tiempo real
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

WORKDIR /app

# Instalamos dependencias del sistema operativo que PostgreSQL podría necesitar
RUN apt-get update && apt-get install -y gcc libpq-dev && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Si aún no tienes daphne en tu requirements.txt, descomenta la siguiente línea
# RUN pip install daphne

COPY . .

EXPOSE 8000

# uvicorn con varios workers soporta WebSockets (Channels) e HTTP igual que
# Daphne, pero reparte el trabajo entre procesos — Daphne corre como uno
# solo y se queda pegado a 1 CPU sin importar cuántos núcleos tenga el
# servidor. docker-compose.yml sobreescribe este CMD con --workers 3.
CMD ["uvicorn", "core.asgi:application", "--host", "0.0.0.0", "--port", "8000"]