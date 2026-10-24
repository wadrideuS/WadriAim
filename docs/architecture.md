# Arquitectura

`TrainingSession` es una simulación sin dependencias del DOM ni WebGL. Mantiene tiempo, munición, movimiento, objetivos, daño y eventos de eliminación. Recibe entradas por fotograma y una función de hit test inyectada.

`TrainingController` coordina el ciclo de vida de una sesión: carga recursos, activa entrada, atiende pausa/salida, actualiza HUD y persiste resultados. Los eventos generan confirmación sonora y visual. Ninguna descarga requiere credenciales en el cliente.

`ArenaRenderer` usa dos escenas: mundo y modelo en primera persona. Esto permite mantener el FOV de entrenamiento independiente del FOV del arma. El raycast solo consulta objetivos activos; los eliminados se ocultan antes de reaparecer.

`ModelRepository` carga GLB mediante GLTFLoader de Three.js, mantiene una caché de los originales y clona instancias. `WeaponViewmodel` normaliza escala/orientación usando el eje principal y el socket Muzzle. `ChamberArms` conserva UVs/materiales del modelo original y hornea los polígonos influenciados por huesos de manos/antebrazos en una pose de agarre. No carga el cuerpo completo en cámara.

La configuración de modelos está en `src/data/models.json`, con hashes SHA-256 y nombre del archivo original. Los GLB actuales son autocontenidos: no dependen de Sketchfab durante una sesión.

`WeaponAudio` genera sonidos originales con ruido filtrado y osciladores; también puede cargar packs locales de muestras. La inicialización de audio se hace con el clic de entrada. Al pausar/salir se detienen las fuentes programadas.

Los tests ejecutan reglas deterministas, validan recursos y verifican que la geometría de manos no invada el plano cercano. La inspección visual sigue siendo necesaria para cada nuevo modelo o cambio de encuadre.
