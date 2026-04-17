# Tutorial: Setup de opmodel en Hetzner (Desarrollo Remoto)

**Fecha**: 2026-03-19  
**Versión**: 1.0  
**Tiempo estimado**: 30-45 minutos  
**Dificultad**: Intermedia

---

## Resumen

Este tutorial guía el setup completo de opmodel en un servidor Hetzner para desarrollo remoto via SSH + Claude Code. El resultado final:

- **Host (Hetzner)**: Bun nativo + código fuente + tests + Claude Code
- **Container**: Vite dev server con HMR servido via Traefik + SSL
- **Acceso**: https://opmodel.sanixai.com desde cualquier browser
- **Flujo**: SSH al server → Claude Code edita → HMR actualiza browser automáticamente

---

## Preparativos

### Hardware del servidor

- **CPU**: i7-7700 (4 cores / 8 threads)
- **RAM**: 62GB
- **OS**: Ubuntu 24.04 LTS
- **IP pública**: Disponible en tu dashboard de Hetzner
- **Acceso**: SSH configurado con tu usuario (ej: `felix`)

### Requisitos previos en el servidor

Verifica que tienes:

1. **Docker** 29.3.0+ instalado
2. **Docker Compose** v2+ instalado
3. **Traefik** corriendo en la red `web`
4. **Acceso SSH** funcionando
5. **Dominio** `sanixai.com` en GoDaddy

### Verificación rápida (ejecutar en Hetzner)

```bash
# Conectar al servidor
ssh felix@<TU-IP-HETZNER>

# Verificar Docker
docker --version
# Esperado: Docker version 29.3.0 o superior

# Verificar Docker Compose
docker compose version
# Esperado: Docker Compose version v2.x.x

# Verificar Traefik y red 'web'
docker ps | grep traefik
# Esperado: Container traefik corriendo

docker network ls | grep web
# Esperado: Red 'web' listada
```

**Si falta algo**, instálalo primero antes de continuar.

---

## Paso 1: Preparar el servidor (5 min)

### 1.1 Crear estructura de directorios

```bash
# En tu servidor Hetzner (via SSH)
ssh felix@<TU-IP-HETZNER>

# Crear directorio de proyectos si no existe
mkdir -p /home/felix/projects
cd /home/felix/projects
```

### 1.2 Verificar Docker Compose v2

```bash
# Verificar que tienes docker compose (not docker-compose)
docker compose version

# Si no está instalado:
# sudo apt update
# sudo apt install docker-compose-plugin
```

---

## Paso 2: Clonar el repositorio (2 min)

```bash
cd /home/felix/projects

# Clonar el repo (ajusta la URL si es diferente)
git clone https://github.com/tu-usuario/opmodel.git opmodel

# Entrar al directorio
cd opmodel

# Verificar estructura
ls -la
# Esperado: packages/, docs/, Dockerfile, docker-compose.yml, etc.
```

---

## Paso 3: Instalar Bun en el host (3 min)

**Importante**: Bun debe instalarse en el host (no en el container) para que Claude Code pueda ejecutar tests y typecheck directamente.

```bash
# Desde /home/felix/projects/opmodel

# Instalar Bun
curl -fsSL https://bun.sh/install | bash

# Configurar PATH (ejecutar ambos comandos)
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# Verificar instalación
bun --version
# Esperado: 1.3.10 (o la versión más reciente)

# Hacer permanente el PATH
# Agregar al final de ~/.bashrc o ~/.zshrc:
echo 'export BUN_INSTALL="$HOME/.bun"' >> ~/.bashrc
echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

**Verificación**:
```bash
which bun
# Esperado: /home/felix/.bun/bin/bun
```

---

## Paso 4: Instalar dependencias (5 min)

```bash
# Desde /home/felix/projects/opmodel

# Instalar todas las dependencias del monorepo
bun install

# Esto instala deps para: core, cli, nl, web
# Tiempo estimado: 2-5 minutos dependiendo de la conexión
```

**Verificación**:
```bash
# Verificar que node_modules existe
ls -la node_modules | head -5
# Esperado: Lista de paquetes instalados

# Verificar paquetes del monorepo
ls -la packages/*/node_modules | head -10
```

---

## Paso 5: Ejecutar tests (5 min)

```bash
# Desde /home/felix/projects/opmodel

# Ejecutar todos los tests
bunx vitest run

# Esperado: 608 tests passing (38 test files)
# Tiempo estimado: 10-30 segundos
```

**Si los tests pasan**, tu entorno de desarrollo está listo.

**Si fallan**:
- Verifica la versión de Bun (`bun --version`)
- Reinstala dependencias: `rm -rf node_modules && bun install`
- Revisa el handoff anterior si hay errores específicos

---

## Paso 6: Configurar DNS en GoDaddy (5 min)

### 6.1 Obtener la IP del servidor

```bash
# En tu servidor Hetzner
ip addr show | grep "inet " | grep -v "127.0.0.1"
# O simplemente usa la IP que usaste para SSH
```

### 6.2 Crear registro DNS en GoDaddy

1. Ingresar a https://dcc.godaddy.com/manage/YOUR-DOMAIN/dns
2. Buscar la sección **Registros** o **DNS Records**
3. Crear un nuevo registro **A**:
   - **Tipo**: A
   - **Nombre**: `opmodel` (o `@` si es dominio raíz)
   - **Valor**: `<IP-HETZNER>` (la IP pública de tu servidor)
   - **TTL**: 600 segundos (10 minutos)

4. Guardar cambios

### 6.3 Verificar propagación DNS

```bash
# Desde tu máquina local (no Hetzner)
dig opmodel.sanixai.com +short
# O
nslookup opmodel.sanixai.com

# Esperado: Debe mostrar la IP de tu servidor Hetzner
# Puede tardar 5-10 minutos en propagarse
```

**Mientras esperas**, continúa con los pasos siguientes.

---

## Paso 7: Verificar Traefik y red Docker (3 min)

### 7.1 Verificar que Traefik está corriendo

```bash
# En Hetzner
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Esperado: Container 'traefik' con status 'Up' y puertos 80/443 mapeados
```

### 7.2 Verificar red 'web'

```bash
docker network ls | grep web

# Esperado:
# web  bridge  local
#
# Si NO existe, créala:
docker network create web
```

### 7.3 Verificar configuración de Traefik

```bash
# Inspeccionar Traefik
docker inspect traefik | grep -A 20 "Networks"

# Esperado: La red 'web' debe estar conectada a Traefik
```

**Si Traefik no está configurado**, necesitas setearlo primero. Traefik típicamente se configura con:

- Puerto 80 y 443 mapeados
- Volumen para `/var/run/docker.sock`
- Certificados Let's Encrypt
- Red `web` conectada

---

## Paso 8: Deploy con Docker Compose (3 min)

```bash
# Desde /home/felix/projects/opmodel

# Construir imagen y levantar container
docker compose up -d --build

# Salida esperada:
# [+] Building X.Xs (X/X) FINISHED
#  => [internal] load build definition from Dockerfile
#  => [1/4] FROM oven/bun:1.3.10-slim
#  => ...
#  => naming to docker.io/library/opmodel-opmodel-dev
# [+] Running 2/2
#  ⠿ Container opmodel-dev  Started

# Verificar que el container está corriendo
docker ps | grep opmodel

# Esperado:
# opmodel-dev   X minutes ago   Up X minutes   0.0.0.0:XXXX->5173/tcp
```

---

## Paso 9: Verificación completa (5 min)

### 9.1 Verificar logs del container

```bash
# Ver logs
docker logs opmodel-dev

# Esperado:
# VITE v5.x.x  ready in XXX ms
#
#   ➜  Local:   http://0.0.0.0:5173/
#   ➜  Network: use --host to expose
```

**Si ves el mensaje de Vite listo**, el dev server está funcionando.

### 9.2 Verificar que está en la red correcta

```bash
docker inspect opmodel-dev | grep -A 10 '"Networks"'

# Esperado: Debe incluir "web" en las redes
```

### 9.3 Verificar acceso via Traefik (esperar DNS)

```bash
# Desde cualquier máquina (tu laptop, por ejemplo)
curl -sI https://opmodel.sanixai.com

# Esperado:
# HTTP/2 200
# content-type: text/html
# x-traefik-router: opmodel@docker
# strict-transport-security: max-age=31536000; includeSubDomains
```

**Si recibes error 404 o 502**:
- Verificar que el container está en la red `web`
- Revisar logs de Traefik: `docker logs traefik`

### 9.4 Abrir en browser

```bash
# En tu máquina local
open https://opmodel.sanixai.com
# O
xdg-open https://opmodel.sanixai.com
```

**Deberías ver** el OPModeling web editor cargando.

---

## Paso 10: Verificar HMR (Hot Module Replacement) (2 min)

HMR permite ver cambios en el código instantáneamente en el browser.

### 10.1 Test de HMR

1. Abre https://opmodel.sanixai.com en tu browser
2. Abre DevTools → Console
3. Edita un archivo en el servidor (via SSH + Claude Code o manual)

```bash
# En Hetzner, editar un archivo de prueba
echo "// Test HMR $(date)" >> packages/web/src/main.tsx
```

4. **Espera 1-2 segundos**
5. El browser debería recargar automáticamente o mostrar cambios sin recarga completa

**Si HMR no funciona**:
- Verificar WebSocket no está bloqueado
- Revisar que `server.host: '0.0.0.0'` está en `vite.config.ts`
- Verificar firewall permite WebSocket

---

## Flujo de trabajo diario

### Desarrollo normal

```bash
# 1. SSH al servidor
ssh felix@<IP-HETZNER>

# 2. Ir al proyecto
cd /home/felix/projects/opmodel

# 3. Iniciar Claude Code (si no está corriendo)
claude

# 4. Desarrollar
# - Claude Code edita archivos
# - Vite HMR actualiza el browser automáticamente
# - Tests corren directamente en host

# 5. Ejecutar tests cuando sea necesario
bunx vitest run

# 6. Hacer commit/push
git add .
git commit -m "mensaje"
git push
```

### Verificar estado

```bash
# Verificar que todo está corriendo
docker ps | grep opmodel
docker logs --tail 20 opmodel-dev
```

### Restart del container (si es necesario)

```bash
docker compose restart
# O
docker compose down && docker compose up -d
```

---

## Troubleshooting extendido

### Problema: Container no arranca

```bash
# Diagnóstico
docker logs opmodel-dev
docker compose config  # Verificar sintaxis del compose

# Solución típica: Rebuild limpio
docker compose down
docker compose up -d --build --force-recreate
```

### Problema: Traefik no rutea al container

```bash
# Diagnóstico
docker inspect opmodel-dev | grep -A 5 '"Networks"'
curl -s http://<IP-CONTAINER>:5173  # Desde Hetzner

# Si no está en red 'web':
docker network connect web opmodel-dev
docker compose restart
```

### Problema: SSL no se provisiona

```bash
# Diagnóstico
curl -sI https://opmodel.sanixai.com
dig opmodel.sanixai.com +short

# Si DNS no resuelve: Esperar propagación
# Si DNS resuelve pero SSL falla:
docker logs traefik | grep -i "certificate\|error"

# Solución típica: Verificar que Traefik tiene certresolver configurado
```

### Problema: HMR no funciona (WebSocket bloqueado)

```bash
# Diagnóstico
# En browser DevTools → Network → WS
# Buscar conexiones WebSocket a wss://opmodel.sanixai.com

# Verificar que Traefik permite WS upgrade
docker inspect traefik | grep -A 10 "Labels"

# Solución: Asegurar que no hay middleware bloqueando WS
```

### Problema: `bun` no encontrado

```bash
# Diagnóstico
which bun
echo $PATH

# Solución
export PATH="$HOME/.bun/bin:$PATH"
# Agregar a ~/.bashrc para persistencia
```

### Problema: Tests fallan en host

```bash
# Diagnóstico
bun --version  # Debe ser 1.3.10
ls node_modules | wc -l  # Debe tener deps instaladas

# Solución: Reinstalar
rm -rf node_modules
bun install
bunx vitest run
```

### Problema: Puerto 5173 ya en uso

```bash
# Diagnóstico
lsof -i :5173
# O
netstat -tlnp | grep 5173

# Solución: Matar proceso ocupando el puerto
# O cambiar puerto en docker-compose.yml y vite.config.ts
```

---

## Checklist de verificación final

Antes de considerar el setup completo, verifica:

- [ ] SSH al servidor funciona
- [ ] Bun instalado y en PATH (`bun --version`)
- [ ] Repo clonado en `/home/felix/projects/opmodel`
- [ ] `bun install` completado exitosamente
- [ ] Tests pasan (`bunx vitest run` = 608 tests)
- [ ] DNS A record creado en GoDaddy
- [ ] Docker y Docker Compose funcionan
- [ ] Red `web` existe (`docker network ls`)
- [ ] Traefik corriendo en red `web`
- [ ] `docker compose up -d` ejecutado sin errores
- [ ] Container `opmodel-dev` aparece en `docker ps`
- [ ] Logs muestran "VITE ready"
- [ ] `curl -sI https://opmodel.sanixai.com` retorna HTTP 200
- [ ] Web app carga en browser
- [ ] HMR funciona (cambios reflejan en browser)

---

## Próximos pasos recomendados

Una vez verificado el setup:

1. **Agregar tests al web editor** (`packages/web/tests/`) — debt actual: 0 tests
2. **Continuar desarrollo del canvas** y OPL panel
3. **Considerar basic auth** en Traefik si quieres restringir acceso público
4. **Setear CI/CD** para tests automáticos en push
5. **Documentar APIs** del core para integraciones futuras

---

## Referencias

- **Spec de diseño**: `docs/superpowers/specs/2026-03-19-dockerization-design.md`
- **Handoff**: `docs/archive/sessions/2026-03-19-dockerization-handoff.md`
- **Traefik docs**: https://doc.traefik.io/traefik/
- **Bun docs**: https://bun.sh/docs
- **Vite docs**: https://vitejs.dev/config/

---

**Documento creado**: 2026-03-19  
**Autor**: steipete (dev/steipete)  
**Estado**: Aprobado para implementación
