# WadriAim 0.4 · Novedades

## Combate
- **Daño real por arma y zona** (`src/data/weapons.js`), sacado de las tarjetas del juego: cabeza / cuerpo / piernas con caída por distancia (Phantom 20 m, Sheriff y Ghost 30 m). Ghost pasa a 13 balas.
- **Agentes con 150 de vida** (100 + escudo pesado). Vandal: 1 a la cabeza o 4 al cuerpo. Las esferas de los modos de solo cabeza siguen cayendo de un tiro.
- **Hitbox de piernas** propia (34 de daño con Vandal). Las hitboxes van pegadas a los huesos y siguen la animación.
- **Spray y retroceso**: patrón por arma (sube los primeros 8–10 tiros y después se mueve a los lados), la cámara sube un poco con cada disparo y vuelve al soltar. Dispersión del primer disparo (cadera / mira), bloom por tiros seguidos e imprecisión al caminar, correr y saltar.
- Con la mira (clic derecho) en rifles: zoom 1,25x, cadencia 90 % y movimiento 76 %.
- Sonidos de impacto no letal y clic continuo en Tracking.

## Agentes
- Piernas animadas: paso lateral al hacer strafe, zancada al avanzar y agachado real (las hitboxes bajan con el cuerpo).

## Manos
- Manos con guantes del paquete FPS en su pose original de agarre: el arma se coloca dentro de las manos. Las pistolas se sujetan con la mano fuerte.
- Opción **lado del arma**: derecha o izquierda.

## Ajustes en la arena (antes de empezar y en pausa)
Sensibilidad (con eDPI y cm/360°), mira, contorno enemigo, color de interfaz, arma, lado del arma, rendimiento (baja latencia) y música. Antes de cada modo: **munición recargable o infinita** y **con o sin límite de tiempo**. En pausa aparece «Terminar y ver resultados».

## Sensibilidad y latencia
- La fórmula ya era la de VALORANT (0,07° por cuenta × sens, FOV horizontal 103°). Ahora se usa **entrada en bruto** (`unadjustedMovement`) para que la aceleración de Windows no la altere, `pointerrawupdate` donde existe y un lienzo WebGL de baja latencia (`desynchronized`).
- «Baja latencia» baja la resolución interna a 1x y apaga las sombras.
- Firefox no admite la entrada en bruto: usa Chrome o Edge y desactiva «Mejorar la precisión del puntero» en Windows.

## Música
Selector de género (Electro, Pop, Chill · Lo-fi, Synthwave, Dance · House, Ambient) con radios de [Radio Browser](https://www.radio-browser.info) (API libre, sin clave). ⏭ cambia de emisora. Si no hay conexión vuelve a la música ambiental propia.

## Modos nuevos
- **Esquiva de flashes** (`src/game/flash-drill.js`): Curveball, Guiding Light, Flashpoint, FLASH/drive, Blindside, Arc Rose, Fakeout, Leer, Paranoia, Dizzy y Prowler, cada una con su mecánica (girar, moverse, destruirla o no dispararle). Tras cada habilidad asoma un enemigo.
- **Duelo dinámico** (`src/game/dynamic-arena.js`): strafe con agachadas, coberturas bajas, ventanas de segundo piso y torres altas.

## Ranking y equipos
- Página **Ranking**: mejor marca de cada jugador por modo, con rangos de Hierro 1 a Radiante (`src/data/ranks.js`). Las rondas sin límite o con munición infinita no cuentan.
- **Top equipos**: +1 por cada jugador que elige ese equipo.
- **Hay que ejecutar `supabase/queries/leaderboards.sql` una vez en el SQL Editor de Supabase.** Probado en PostgreSQL 16.
- Las puntuaciones salen del historial que guarda el navegador, así que alguien con conocimientos podría falsearlas.

## Pruebas
- `tests/combat.test.js`: daño, vida, spray, munición, tracking, flashes y rangos.
- Vistas en el navegador: `tests/fixtures/mode-preview.html?mode=13|14`, `viewmodel-preview.html?weapon=…&side=left`, `logic-check.html`.
