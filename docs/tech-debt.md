# Deuda técnica

## El header se desborda en pantallas angostas

- **Qué pasa:** a 375 px el header mide como mínimo unos 437 px (marca + navegación + perfil) y aparece scroll horizontal. Esto pasaba antes del cambio del control de música. En 600 px o menos el control de música ya es un mini-reproductor flotante abajo a la derecha.
- **Referencia:** WCAG 1.4.10 (Reflow).
- **Arreglo sugerido:** header en dos filas o menú compacto en pantallas angostas.
- **Prioridad:** baja. WadriAim se usa principalmente en PC; el móvil no es foco por ahora (decisión de Crisjo, 2026-10-23).
- **Archivos relacionados:** `src/styles/app.css` (header, nav, `@media (max-width: 800px)` y `480px`), `src/audio/MusicControl.js`.

## Los bots de Supervivencia se meten en la cabeza del jugador

- **Qué pasa:** los bots de Supervivencia caminan hasta la celda del jugador y la cámara queda dentro de su cabeza si nadie los frena. Es un problema preexistente.
- **Arreglo sugerido:** que la IA se detenga a unos metros (distancia de combate) y dispare desde ahí.
- **Prioridad:** media.
- **Archivos relacionados:** `src/renderer/EnemyAgents.js`, `src/game/SpikeDefense.js`.

## Posibles exports sin uso en el mapa de Haven

- **Qué pasa:** `src/game/haven-map.js` exporta `havenEnemySpawns`, `nearestHavenPoint` y `randomHavenSpawns`, que parecen no tener importadores.
- **Arreglo sugerido:** confirmar con grep en `src/` y `tests/` antes de borrarlos.
- **Prioridad:** baja.
- **Archivos relacionados:** `src/game/haven-map.js`.
