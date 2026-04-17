# Spec: Dockerización opmodel para desarrollo remoto

**Fecha**: 2026-03-19
**Estado**: Aprobado
**Autor**: steipete (dev/steipete)

## Contexto

opmodel es un monorepo Bun (4 packages: core, cli, nl, web) que necesita migrar su entorno de desarrollo a un servidor Hetzner (i7-7700, 62GB RAM, Ubuntu 24.04, Docker 29.3.0) para continuar desarrollo remoto via SSH + Claude Code.

## Decisiones de diseño

### DD-1: Split host/container

- **Host**: Bun nativo + source code + Claude Code. Ejecuta tests, typecheck, git.
- **Container**: Solo Vite dev server con HMR. Sirve la app web al browser via Traefik.
- **Justificación**: Claude Code necesita acceso directo al runtime sin indirección de `docker exec`. El container tiene un solo job: servir al browser.

### DD-2: Volume mount (no COPY)

- El source vive en el host (`/home/felix/projects/opmodel/`).
- El container monta ese directorio como volume.
- `node_modules` se instala en el host — una sola fuente de verdad.
- **Justificación**: Cambios de Claude Code se reflejan instantáneamente en el container via HMR. Sin rebuilds de imagen por cambios de código.

### DD-3: Vite dev server (no nginx estático)

- El web editor está en desarrollo activo (canvas, OPL panel, componentes sin tests).
- HMR es esencial para el flujo de desarrollo.
- **Justificación**: `vite build` manual por cada cambio es fricción innecesaria en un proyecto con UI activa.

### DD-4: Traefik + SSL automático

- Subdominio: `opmodel.sanixai.com`
- DNS A record en GoDaddy → IP Hetzner
- Traefik reverse proxy con Let's Encrypt (certresolver existente)
- WebSocket upgrade para HMR manejado nativamente por Traefik
- **Justificación**: Reusar infraestructura existente del servidor (red `web`, Traefik ya corriendo).

## Archivos

| Archivo | Acción | Propósito |
|---------|--------|-----------|
| `Dockerfile` | Crear | Imagen thin: `oven/bun:1.3.10-slim`, solo runtime |
| `docker-compose.yml` | Crear | Servicio `opmodel-dev`, volume mount, labels Traefik |
| `.dockerignore` | Crear | Excluir `.git`, `dist`, `sessions`, `analysis`, `audits` |
| `packages/web/vite.config.ts` | Editar | `server.host: '0.0.0.0'` para acceso externo |

## Blast radius

- **Nivel**: small
- **Archivos**: 3 nuevos + 1 editado
- **Dependencias**: ninguna — no toca core/cli/nl/web source
- **Riesgo**: bajo
- **Reversibilidad**: alta (`git revert` limpio)

## Setup en Hetzner

```bash
# 1. Clonar repo
cd /home/felix/projects
git clone <opmodel-repo-url> opmodel && cd opmodel

# 2. Instalar Bun en host
curl -fsSL https://bun.sh/install | bash && source ~/.bashrc

# 3. Instalar deps
bun install

# 4. Verificar tests
bunx vitest run   # 608 tests green

# 5. DNS (GoDaddy): A record opmodel.sanixai.com → <IP-hetzner>

# 6. Levantar container
docker compose up -d

# 7. Verificar
curl -s https://opmodel.sanixai.com | head -5
```

## Seguridad

- NL pipeline (Claude/OpenAI API keys): permanecen en localStorage del browser del operador. Sin cambios.
- No hay backend, no hay secrets en el container.
- Vite dev server expuesto solo via Traefik con SSL — no hay puerto expuesto directo al host.
