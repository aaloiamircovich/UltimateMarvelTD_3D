# Dispositivos en combate 3D

Primera integración visual de FieldDeviceSystem: torreta de Rocket junto al héroe y mina de Peni en la posición original del dispositivo. Son modelos geométricos provisionales; no se consumieron créditos de Meshy. El indicador ámbar identifica una mina armándose y el verde un dispositivo preparado/activo. Al seleccionar al dueño, el inspector muestra el estado y los segundos restantes.

Decisiones del usuario: objetos siempre visibles mientras existan; zonas y alcances sólo al seleccionar al dueño; impactos y peligros siempre visibles. Rocket conserva el alcance del héroe, no se dibuja un radio de tiro inventado alrededor de su torreta. Peni muestra activación (26 píxeles) y efecto (65), recortados por el patrón de alcance original del héroe. El alcance del héroe permanece visible al seleccionarlo.

`src/game/device-views.js` entrega copias de estado sin referencias mutables al sistema original. `src/render/devices.js` muestra esos datos y reutiliza objetos al retirarlos. La simulación original sigue decidiendo creación, armado, disparo, control, duración y cancelación; pausa y velocidad no tienen un reloj visual independiente. Las pruebas cubren expiración, mina preparada/activada, retirada, movimiento y aturdimiento, selección/deselección y congelación visual al pausar. Esta entrega no declara integradas las demás auras o zonas de los héroes.
