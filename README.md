# Faro AI

Front de Faro AI para la especialización FDE. Los estudiantes conversan con los interlocutores y el instructor opera el módulo. Corre en local. No se despliega desde este repositorio sin confirmación.

## Requisitos

- Node.js 22
- Docker, para Postgres local

## Variables de entorno

Copiar `.env.example` a `.env` y completar los valores ahí. Este archivo no los trae.

| Variable | Uso |
| --- | --- |
| `ELEVENLABS_API_KEY` | Clave de ElevenLabs. Solo la lee el servidor |
| `GOOGLE_CLIENT_ID` | Cliente OAuth de Google |
| `GOOGLE_CLIENT_SECRET` | Secreto de ese cliente |
| `AUTH_SECRET` | Secreto de la cookie de sesión |
| `DATABASE_URL` | Conexión a Postgres |
| `INSTRUCTOR_EMAILS` | Correos de instructor, separados por coma |
| `HSTS` | Opcional. `true` solo detrás de HTTPS |

El redirect local de Google es `http://localhost:3000/api/auth/callback/google`.

Para el Postgres del `docker-compose.yml`, el usuario, la contraseña y la base se llaman `faro`. El puerto en la máquina es 5433, para no usar el 5432 si ya hay otro Postgres.

## Comandos

```powershell
docker compose up -d
npm install
npx prisma migrate deploy
npm run dev
npm test
npm run plan-b
python -m http.server 8080 --directory plan-b
```

`npm run dev` abre la aplicación en `http://localhost:3000`. `npm run plan-b` regenera las páginas estáticas. El servidor del plan B queda en `http://127.0.0.1:8080`.

La documentación está en [docs/index.md](docs/index.md).
