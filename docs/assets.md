# Modelos, texturas y audio

## Archivos incorporados

| ID | Archivo entregado | Tamaño aproximado |
|---|---|---|
| vandal | foresaken_vandal_white.glb | 6.5 MiB |
| phantom | valorant_phantom_blastx.glb | 3.9 MiB |
| guardian | valorant_weapon_guardian_semi-automatic_rifle.glb | 5.8 MiB |
| sheriff | valorant_weapon_sheriff_pistol.glb | 5.9 MiB |
| ghost | valorant_weapon_ghost_pistol.glb | 6.9 MiB |
| chamber | chamber_valorant_3d_model.glb | 11.8 MiB |

Los originales se conservan bajo `public/models/<id>/model.glb`; su hash queda en `src/data/models.json`. Las texturas están incrustadas. Las armas no contienen clips de animación. Chamber contiene un clip de cuerpo completo que no se utiliza como animación FPS.

Los enlaces de referencia que proporcionó el usuario quedan registrados en el manifiesto. Vandal y Phantom en los ZIP corresponden a skins distintas de algunos enlaces iniciales: no se les asignan autores ni licencias sin verificar. `requestedSource` conserva el enlace inicial, no afirma ser el origen del GLB entregado. No se añaden avisos de licencia inventados.

## Sustituir un modelo

```sh
npm run assets:import -- vandal C:/modelos/modelo.glb
npm run assets:check
```

La herramienta acepta GLB 2.0 autocontenido. Para GLTF/FBX, prepara antes un GLB con texturas incrustadas. El runtime admite GLB autocontenido sin compresión Draco.

Ajusta `viewmodel.position`, `rotation` (radianes) y `length` en `src/data/models.json`. La orientación aprovecha `Muzzle` cuando existe. Phantom BlastX no tiene ese socket y usa su eje principal.

Las manos se colocan usando `Root` y `Left_Hand_Target` si el archivo los contiene. Los valores de reserva y la curvatura de dedos están en `src/renderer/ChamberArms.js`. Para un agarre/recarga idénticos al juego se necesita un rig FPS y animaciones específicas por arma.

## Sonidos

Los disparos de Vandal, Phantom, Ghost y Sheriff proceden de los MP3 adjuntados por el usuario. Se aislaron clips de 0.48 segundos, con fundidos breves, según su preferencia final. Los MP3 originales y los metadatos de recorte están en `assets/source-audio/`.

Las bajas usan `Valorant default kill sounds.mp3` como fuente: cinco clips generales que avanzan 1→2→3→4→5→1 para Phantom, Ghost, Guardian y Sheriff. El quinto conserva su cola completa; un disparo fallido no reinicia el conteo. El pack Forsaken anterior se conserva como fuente archivada pero no es la secuencia activa.

Guardian usa el MP3 proporcionado. Las recargas salvo Vandal y el clic de cargador vacío usan síntesis propia. La música de fondo es una composición ambiental sintetizada propia, con volumen inicial 8%, interruptor independiente y reducción de volumen durante la sesión.

Para muestras de audio que puedas utilizar, copia los archivos WAV/OGG/MP3 en `public/audio/` y configura, por ejemplo:

```json
"vandal": {"shot":"audio/vandal/shot.wav","reload":"audio/vandal/reload.wav","dry":null}
```

El registro está en `src/data/sound-packs.json`. Los sonidos de disparo/recarga registrados reemplazan los sintetizados cuando terminan de cargar. Si un archivo falla, se mantiene el sonido propio.

Vandal: extract-vandal-showcase.mjs recorta el showcase siguiendo las marcas indicadas por el usuario (23, 26, 28, 32, 35 y 39 segundos). Las bajas omiten el ataque inicial del disparo; los impactos conservan parte de la mezcla original. Los cortes exactos están en assets/source-audio/vandal-showcase.json. La tercera baja ocurre después del impacto al pecho, alrededor de 30.5 s. Los efectos se cargan por arma para evitar contaminación del pack general.

## Manos FPS
M4 - FPS Weapon Animations Pack (v.1), BarcodeGames, CC-BY-4.0.
https://sketchfab.com/3d-models/m4-fps-weapon-animations-pack-v1-662fc74dda2646cfb48fc610705768ef
Archivo entregado por el usuario; incluye rig y Draw/Fire/Reload/Reload_Empty/Holster.
Se toma la pose final de Draw, se extraen las manos y antebrazos originales conservando UV y materiales,
y se ajustan por separado al agarre derecho y al apoyo izquierdo de cada arma.
Se recuperan las texturas diffuse de KHR_materials_pbrSpecularGlossiness.
Las animaciones completas de M4 no se reproducen sobre las armas de Valorant: el movimiento del conjunto continúa siendo procedural.

## Enemigos (agentes)

Los bots de cuerpo completo usan el modelo de Reyna (`agent_reyna`, duelista) en lugar de los bocetos de primitivas; los aliados del modo Spike usan Sage (`agent_sage`) sin contorno. Los modos de solo cabeza (Microflicks, Smooth Tracking, NO APTO PARA PLATAS) conservan las esferas.

- Código: `src/renderer/EnemyAgents.js`. El modelo se normaliza (pies en y=0, hueso `Head` a 1.65 m, mirando a +Z) y se clona por bot compartiendo geometría y texturas.
- Contorno: silueta en espacio de pantalla con stencil (el agente marca stencil=1; una pasada plana desplazada en 8 direcciones pinta solo fuera de la silueta). Grosor constante a cualquier distancia y las paredes lo tapan. Colores: rojo `#ff3346`, amarillo `#f4f142`, morado `#c13dff`; se elige en el panel de entrada («Contorno enemigo») y se guarda como `wa-enemy-outline`.
- Disparos: la malla texturizada no recibe impactos. Cabeza (esfera r=0.15) y cuerpo (cápsulas torso, brazos y piernas) se generan a partir de los huesos `Head`, `Neck`, `Pelvis`, `*_Shoulder`, `*_Hand`, `*_Hip`, `*_Foot`.
- Si el GLB no carga, se usan los bots simples anteriores.
- Vista previa: `tests/fixtures/agents-preview.html?color=rojo|amarillo|morado&near=1`.
