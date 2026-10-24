# WadriAim

Entrenamiento FPS en el navegador. Vite + JavaScript modular + Three.js/WebGL + Web Audio.

## Ejecutar

Requiere Node.js 22.12 o posterior y npm.

```sh
npm ci
# Copia .env.example a .env.local y configura tu proyecto Supabase
npm run dev
```

Abre la dirección que muestra Vite. En Windows también puedes ejecutar `INICIAR.cmd`.
**No abras index.html como file://**: los módulos, texturas y modelos se sirven por HTTP.

## Comprobaciones

```sh
npm test
npm run assets:check
npm run format:check
npm run build
npm run preview
```

La aplicación compilada queda en `dist/`. El acceso de cuentas, perfiles y salas usa Supabase; configura las variables públicas de `.env.example` en `.env.local`. Las consultas y funciones del backend están en `supabase/`. Nunca subas claves privadas ni archivos `.env.local`.

Web publicada: https://wadriaim.vercel.app/

## Estructura

```text
src/
  app/          Interfaz, perfil y navegación
  game/         Reglas de sesiones, controles y coordinación
  renderer/     Escena WebGL, modelos, manos y materiales
  audio/        Efectos propios y carga opcional de muestras
  features/     Importación de códigos y colección de miras
  data/         Armas, reglas, modelos y acabados configurables
  lib/          Persistencia local
  styles/       Interfaz y HUD
public/models/  Los seis GLB proporcionados, con texturas incrustadas
scripts/        Importación y verificación de recursos
 tests/         Pruebas de reglas, recursos y miras
 docs/          Arquitectura y notas de modelos
```

## Incluido

- Seis ejercicios con reglas de aparición independientes y separación angular entre objetivos.
- Los objetivos se eliminan de un impacto válido; Headshot Only exige cabeza. Las eliminaciones tienen pausa de reaparición, partículas y confirmación sonora. Smooth Tracking mide tiempo sobre el objetivo en vez de muertes.
- Vandal Forsaken blanca, Phantom BlastX, Ghost, Guardian y Sheriff: son los archivos GLB entregados por el usuario.
- Antebrazos y manos extraídos del modelo de Chamber entregado por el usuario. Se adaptan a los puntos de sujeción del arma cuando existen.
- Acabado original y dos variaciones de color propias. No se presentan como skins oficiales adicionales.
- Disparos de las cinco armas recortados de los MP3 proporcionados. Vandal usa el showcase Sovereign/Forsaken para disparo, impactos, recarga y bajas 1→2→3→4→ace→1; las otras armas usan las bajas generales. Música ambiental original suave y controles independientes de volumen/silencio.
- Perfil, sens, DPI, tema, armas y colección de miras guardados en el navegador.

## Límites actuales

Los archivos de armas no incluyen animaciones; el retroceso y la recarga actuales son animaciones procedurales del conjunto, no las animaciones oficiales. Las manos se adaptan desde un modelo de cuerpo completo, no un rig FPS original. La sujeción puede necesitar ajustes específicos por arma. Física, daños, cadencia y animaciones son una simulación de entrenamiento, no una reproducción exacta del motor de VALORANT. Los sonidos aportados se usan como muestras recortadas para entrenamiento.

La captura del ratón depende del navegador. Si el navegador integrado la rechaza, se ofrece control alternativo dentro del área visible; para FPS continuo usa Chrome o Edge. El navegador no cambia el DPI físico de tu ratón.

Los modelos conservan los archivos proporcionados por el usuario. Los ZIP no incluyen declaraciones de licencia ni créditos completos. Consulta `docs/assets.md` para su procedencia; no se presupone una licencia de redistribución.


### NO APTO PARA PLATAS
Reto de 45 segundos con tres objetivos estáticos de 650 ms y reaparición de 45 ms.
Munición ilimitada. Cada acierto suma 100 puntos, más velocidad y racha.
El récord se guarda en este navegador y se muestra al terminar.

