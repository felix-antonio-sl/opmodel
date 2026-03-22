# Handoff: Dockerización opmodel → Hetzner

**Fecha**: 2026-03-19
**Sesión**: 10
**Agente**: steipete (dev/steipete)

## Qué se hizo

Diseño e implementación de la dockerización de opmodel para desarrollo remoto en servidor Hetzner.

### Archivos creados/editados

| Archivo | Acción |
|---------|--------|
| `Dockerfile` | Creado — imagen thin `oven/bun:1.3.10-slim`, solo Vite dev server |
| `docker-compose.yml` | Creado — servicio `opmodel-dev`, volume mount, labels Traefik, red `web` |
| `.dockerignore` | Creado — excluye `.git`, `dist`, `sessions`, `analysis`, `audits` |
| `packages/web/vite.config.ts` | Editado — `server.host: '0.0.0.0'` para acceso externo al container |
| `docs/superpowers/specs/2026-03-19-dockerization-design.md` | Creado — spec de diseño aprobada |

### Decisiones clave

1. **Split host/container**: Bun nativo en host (Claude Code, tests, typecheck) + container solo para Vite dev server (HMR al browser).
2. **Volume mount**: Source en host, montado en container. `node_modules` una sola fuente de verdad en host.
3. **Vite dev server** (no nginx): desarrollo activo del web editor requiere HMR.
4. **Dominio**: `opmodel.sanixai.com` via Traefik + Let's Encrypt SSL.

## Estado del proyecto

- **608 tests** (38 test files), todos green
- **4 packages**: core (347 tests), cli (90+), nl (52), web (0 — debt)
- **86 commits** en master
- Último handoff previo: `sessions/2026-03-18-iso-remediation-handoff.md`

## Pasos para continuar en Hetzner

### Prerequisitos

- Servidor Hetzner con Docker 29.3.0, Traefik corriendo en red `web`
- Acceso SSH configurado
- Dominio `sanixai.com` en GoDaddy

### Ejecución

```bash
# 1. Clonar repo en Hetzner
ssh felix@<IP-hetzner>
cd /home/felix/projects
git clone <opmodel-repo-url> opmodel
cd opmodel

# 2. Instalar Bun en host
curl -fsSL https://bun.sh/install | bash
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
# Agregar las 2 lineas de export a ~/.bashrc o ~/.zshrc

# 3. Instalar dependencias
bun install

# 4. Verificar tests
bunx vitest run
# Esperado: 608 tests pass (38 test files)

# 5. DNS en GoDaddy
# Crear A record: opmodel.sanixai.com → <IP-hetzner>
# TTL: 600 (10 min para propagación rápida)

# 6. Verificar que Traefik está en red 'web'
docker network ls | grep web
# Si no existe: docker network create web

# 7. Levantar container
docker compose up -d

# 8. Verificar container
docker logs opmodel-dev
# Esperado: "VITE vX.X.X ready in Xms" + "Local: http://0.0.0.0:5173/"

# 9. Verificar acceso externo (después de propagación DNS)
curl -sI https://opmodel.sanixai.com
# Esperado: HTTP/2 200, content-type: text/html

# 10. Abrir en browser
# https://opmodel.sanixai.com → OPModeling web editor
```

### Troubleshooting

| Problema | Diagnóstico | Solución |
|----------|-------------|----------|
| Container arranca pero Traefik no rutea | `docker inspect opmodel-dev` — verificar que está en red `web` | `docker network connect web opmodel-dev` |
| SSL no provisiona | DNS no propagado aún | Esperar 5-10 min, verificar con `dig opmodel.sanixai.com` |
| HMR no funciona en browser | WebSocket bloqueado | Verificar que Traefik no tiene middleware que bloquee WS upgrade |
| `bun install` falla | Bun no en PATH | `export PATH="$HOME/.bun/bin:$PATH"` |
| Tests fallan | Versión de Bun distinta | Instalar `bun@1.3.10` exacto |

## Flujo de trabajo post-deploy

```
Felix SSH → Hetzner → Claude Code edita archivos en /home/felix/projects/opmodel/
  → Vite HMR detecta cambios → browser en opmodel.sanixai.com actualiza en vivo
  → bunx vitest run directo en host para tests
  → git commit/push desde host
```

## Siguiente paso recomendado

Una vez deployado y verificado en Hetzner:
1. Agregar tests al web editor (`packages/web/tests/`) — debt declarado, 0 tests
2. Continuar desarrollo del canvas y OPL panel
3. Considerar basic auth en Traefik si se quiere restringir acceso (ahora es público)
