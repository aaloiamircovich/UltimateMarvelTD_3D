# Matriz individual de identidad

Fecha: 2026-09-13. Roster: 105 heroes, data/heroes.json en 553ad63.
La columna de propuestas sigue pendiente salvo avances marcados en Actual.
Complementa PLAN_IDENTIDAD_HEROES.md y COBERTURA_CONTRATOS_HEROES.md.

La columna actual resume mecanismos, no repite literalmente el texto de la
habilidad. No incluye todos los multiplicadores de objetos/evoluciones.
Las rarezas se conservan. Cada fila propone una firma y una debilidad;
los valores finales se fijan despues de las pruebas de fase 1.

## Fase 2: soportes, economia y excepcion de Luke

Regla comun F2/lote 6: auras incondicionales del mismo atributo suman su
potencia activa, no se multiplican entre si. Maria conserva su capa por
victima marcada; Reed excluye su aporte de la geometria interna. Esta regla
cierra la politica de acumulacion pendiente en las filas anteriores, no las
comparativas de rutas/equipos ni la evolucion del buff.

Regla comun F2/lote 7: los nueve soportes multiplican su potencia de aura por
1.25 al nivel 50, sin bonus evolutivo de radio/ciclos ni ataques propios.
Incluye presupuesto y tope de X, pulso de Wasp, red de Panther y condicion de
Maria. Resuelve la evolucion del buff pendiente en estas filas; los cruces
especificos con objetos y comparativas de rutas siguen pendientes.

| ID | Heroe (rareza) | Actual | Firma propuesta y limite |
| --- | --- | --- | --- |
| `capitan_america` | Capitan America (Epic) | F2/lote 2: aura amplia constante, conservada y probada contra cobertura corta de Panther; no ataca ni con Mjolnir. | Liderazgo estable verificado; falta comparar equipos y politica global de acumulacion. |
| `black_panther` | Black Panther (Epic) | F2/lote 2: Red de Vibranium, seis ataques principales aliados elevan potencia de aura x1.5 por 3 s; preparacion/recarga 9 s, sin dano propio. | Sobrecarga para formacion compacta implementada; medir equipos y evolucion del buff, sin reactivar kit atacante. |
| `nick_fury` | Nick Fury (Rare) | F2/lote 3: Orden sostenida, +8% base a 265 px; estable, suspendida por stun, sin ataque ni deteccion aliada. | Cobertura constante verificada frente al pulso corto; falta comparar equipos completos y acumulacion global. |
| `wasp` | Wasp (Common) | F2/lote 3: Enlace Pym, 6 s de preparacion/descanso y 3 s con +36% base a 125 px; mover o recolocar reinicia. | Pulso corto implementado, reloj avanza bajo stun; comparativa estacionaria no certifica control ni economia en rutas. |
| `invisible_woman` | Invisible Woman (Legendary) | F2/lote 4: +8% base a 245 px y deteccion continua para aliados; no revela globalmente ni ataca. | Campo de cobertura conservado y probado; falta comparar equipos y rutas. |
| `mister_fantastic` | Mister Fantastic (Legendary) | F2/lote 4: +15% base a 145 px, solo extension exterior; su bonus no agranda hueco del anillo ni carriles cruz/X. | Geometria elastica implementada en seleccion, habilidades, signatures y dibujo; no deteccion ni ataques propios. |
| `wong` | Wong (Common) | F2/lote 4: +4.5% base de alcance a 205 px constante; 4 s de espera y 4 s de deteccion, sin atacar. | Sello de vigilancia implementado; stun no congela reloj, mover/recolocar rearma. Medir perdida de continuidad en rutas. |
| `maria_hill` | Maria Hill (Common) | F2/lote 5: deteccion a 225 px y +9% base de dano directo contra marcas activas; condicion por victima al impactar, sin atacar ni marcar. | Orden de prioridad implementada; requiere atacante/soporte desplegados, en radio y sin stun. No aumenta DoT ni ejecuciones; faltan comparativas de equipos/rutas. |
| `profesor_x` | Profesor X (Mythic) | F2/lote 3: reparte 50 puntos base de cadencia entre atacantes a 245 px, tope +30% por aliado; deteccion solo enlazada, sin ataque. | Presupuesto y dilucion implementados; soportes/aturdidos excluidos. Escala con nivel; falta balance de formaciones en rutas. |
| `domino` | Domino (Epic) | F2/lote 8: ceil(15% recompensa final) por disparo principal; sin duplicacion en secundarios, DoT o retorno, a todos los niveles. | Contabilidad con control y objetos probada; sin tope oculto. Falta medir ingreso por ruta y oportunidad de plaza; clones futuros deberan respetar el contrato. |
| `luke_cage` | Luke Cage (Common) | F2/lote 1: atacante con ruptura; sin buff aliado. Tenacidad propia reduce stun recibido 50%, sin inmunidad ni curacion. | Guardia de Harlem implementada en su contrato inicial; comparar aporte en equipos y encuentros con stun. |

## Fase 3: tiradores y tecnologia

| ID | Heroe (rareza) | Actual | Firma propuesta y limite |
| --- | --- | --- | --- |
| `iron_man` | Iron Man (Legendary) | F3/lote 1: carga de 3 disparos (2 Extremis), reactor de 2 s, carga saturada conservada durante calor y laser solo en siguiente ataque. | Alineacion y limite termico probados; detecta segun stats. Comparar Extremis/equipos/rutas en fases 8/10. |
| `black_widow` | Black Widow (Common) | F3/lote 2: cuarta descarga hasta 4 blancos, inhibe apoyos hasta 2 s + 3 s inmunidad posterior. Sin marca/stun nativos, conserva veneno y ruptura contra apoyos. | Jefes inmunes a inhibicion; no detiene movimiento. Medir perdida de CC y aporte anti-soporte en rutas. |
| `hawkeye` | Hawkeye (Common) | F3/lote 1: tres municiones, cuarto disparo +35% dano y refuerzo exclusivo: area 85 px, slow 60% o penetracion 80%. | Preparacion conserva timer/carga al cambiar municion; sin efecto retroactivo sobre proyectiles. Comparar control y coste de plaza en rutas. |
| `falcon` | Falcon (Common) | F3/lote 4: Redwing recon revela al identificado 2 s con resistencias, ademas de marca y aura de deteccion existentes. Asalto no revela. | Caducar restaura sigilo nativo; otros ocultos no cambian. Conserva tiempos y dano; falta medir aporte de revelado en rutas. |
| `winter_soldier` | Winter Soldier (Rare) | F3/lote 3: ciclo 85/85/160% dano; remate refuerza perforacion, explosion o stun electrico. Conserva Overclock y municiones. | Coste en dos disparos ligeros, no recarga temporal extra. Cambiar modo no reinicia ciclo. Falta contraste de control y rutas. |
| `war_machine` | War Machine (Rare) | F3/lote 4: sexto disparo fija zona 65 px; tras 0.9 s golpea hasta cinco detectados al 60% de poder por escala de habilidad. Conserva disparo y quemadura anteriores. | Una zona, no sigue blanco; mover/stun/retiro cancelan. Sin efectos o ingresos extra; corredores pueden salir antes. |
| `punisher` | Punisher (Common) | F3/lote 3: +8% dano por disparo previo al mismo blanco, maximo +32%; cruz y splash pequeno conservados. | Pierde rampa al cambiar blanco, mover, stun, perder deteccion/alcance o 2 s sin ataque. No control de movimiento; pendiente presupuesto/rutas. |
| `shuri` | Shuri (Common) | F3/lote 2: escaneo 3 s, +35% dano directo aliado solo contra barrera; no marca general, DoT ni bonus a vida. Conserva deteccion. | Primer impacto prepara siguientes; romper escudo borra estado. Ventaja contra barreras y desventaja sin ellas probadas; faltan rutas/equipos. |
| `rocket_raccoon` | Rocket Raccoon (Common) | F3/lote 8: torreta 5 s/recarga 6 s; mientras activa reserva 20% del disparo para pulsos a 0.5 s, sin objetos/firmas. | Una por dueno, reserva acotada, cobertura propia; mover/stun/retiro cancela. Reparte dano, no agrega DPS gratis. |
| `cable` | Cable (Epic) | F3/lote 5: 3 s apuntando al mismo jefe/amenaza 4+ preparan siguiente disparo al 190% de dano, sin cambiar cadencia. | Reinicia al perder objetivo, cobertura, mover/stun/retiro; cruz y objeto conservados. Pendiente balance en rutas. |
| `kate_bishop` | Kate Bishop (Common) | F3/lote 6: cuarta flecha revela hasta seis en 80 px durante 3 s al impactar. Conserva marca, deteccion y carcaj independiente. | Sin dano extra, no balizas por rebotes; si el blanco muere antes pierde flecha. Pendiente rutas/equipos. |
| `mockingbird` | Mockingbird (Common) | F3/lote 6: segundo golpe al mismo blanco al 140%, stun 0.35 s con recarga electrica 2 s. Sustituye stun aleatorio, conserva marca y Localizador. | Reinicios por cambio blanco, movimiento, stun, cobertura/retiro o 2.5 s sin ataque; recarga no se reinicia al perder combo. |
| `yelena_belova` | Yelena Belova (Common) | F3/lote 7: +20% al insistir sobre marcado; al abatir al seguido transfiere marca a uno cercano detectable dentro de alcance. | Sin revelar, dano incidental ni cambio de prioridad. Pierde seguimiento por interrupciones; veneno/marca base intactos. |
| `nebula` | Nebula (Rare) | F3/lote 5: +10 puntos de penetracion por disparo previo, maximo 50; +10 contra Tecnologicos tras el primero. | Pierde adaptacion al cambiar blanco, mover/stun/retiro, perder alcance o 2.5 s sin ataque. Techo con objetos 85%; no dano extra sin armadura. |
| `peni_parker` | Peni Parker (Rare) | F3/lote 8: mina fija, arma 1 s, caduca 5 s, trigger 26 px, area 65 px para cinco; web 35%/2 s, recarga 8 s. | Una por dueno, sin dano ni activacion de objetos; cobertura y deteccion efectivas, limpiar al mover/stun/retiro. |
| `howard_the_duck` | Howard the Duck (Common) | F3/lote 7: cada tercer disparo garantiza burn o slow alternadamente; el otro efecto sigue probabilistico. | Potencias originales, sin garantias de objetos ni cambio en vuelo. Pendiente aporte de control/DoT por ruta. |

## Fase 4: combate cercano y combos

| ID | Heroe (rareza) | Actual | Firma propuesta y limite |
| --- | --- | --- | --- |
| `hulk` | Hulk (Mythic) | F4/lote 1: furia 8/ataque y 6/s por enemigo cercano detectable (maximo 3); no vidas perdidas ni cadencia por furia. Conserva salto 2.25x y area/stun incidental. | Implementado: descarga por 50 de furia y recarga base 8s; validar balance de equipos en fase 10. |
| `wolverine` | Wolverine (Epic) | F4/lote 2: 7/14 de frenesi por ataque inicial/repetido, mitad al cambiar o retomar tras 3s, decae 12/s tras pausa. Sin cadencia por multitudes. Salto 3x/regreso 0.8s y Berserker preservados. | Implementado: persecucion sostenida, techo 100, movimiento/stun vacian; retorno respeta recolocacion manual. Balance de equipos pendiente. |
| `gamora` | Gamora (Common) | F4/lote 3: ejecucion primaria <=25% preservada, contador real de remates. Combo de dos vecinos detectables en cobertura prioriza porcentaje de HP bajo; no ejecuta secundarios. | Implementado: limpieza de debilitados, no bosses; registro de dano/bajas unicos. Balance de equipos pendiente. |
| `ant_man` | Ant-Man (Common) | F4/lote 4: tres ataques diminutos preparan impacto gigante, recarga minima 4s, cinco victimas detectables en cobertura; retroceso respeta inmunidades y ruta. Conserva splash ordinario. | Implementado: carga y recarga compartidas entre formas; cambiar no genera ataques ni evade espera. Balance de equipos pendiente. |
| `shang_chi` | Shang-Chi (Epic) | F4/lote 4: tres ataques preparan finalizador; Orbita mejora rebote, Rafaga area/penetracion, Guardia slow primario. Recarga minima 4s compartida entre patrones. | Implementado: eleccion de finalizador sin recarga por cambio ni monedas ocultas. No aura aliada atacante; balance de equipos pendiente. |
| `moon_knight` | Moon Knight (Epic) | F4/lote 5: fases de 10s con coste: Creciente -10% dano, Llena -15% cadencia, Menguante -10% dano. Conserva ventajas/perfiles, muestra siguiente fase y tiempo. | Implementado: ciclo automatico y prioridad manual preservada; transicion usa stats coherentes. Balance de equipos pendiente. |
| `she_hulk` | She-Hulk (Rare) | F4/lote 1: Objecion preparada en tres ataques, recarga minima 4s; hasta cuatro detectables, marca y retroceso resistible, stun solo principal. Conserva enfoque signature. | Implementado sin taunt ficticio: respeta prioridad elegida; interrumpe movimiento, no acciones de boss. Balance de equipos pendiente. |
| `iron_fist` | Iron Fist (Epic) | F4/lote 5: carga chi 5s desde despliegue/uso, siguiente disparo x1.9 y stun 0.45s resistible solo primario. Retira stun aleatorio; conserva critico propio. | Implementado: golpe concentrado sin area ni ejecucion; consumo al disparar y descanso fijo. Balance de equipos pendiente. |
| `jessica_jones` | Jessica Jones (Common) | F4/lote 6: Ultima linea contra detectable mas avanzado de cobertura con >=75% de su ruta; x1.45 dano y stun 0.5s, recarga minima 3s. Retira stun aleatorio. | Implementado: progreso relativo a ruta propia y prioridad manual respetada; sin bonus de fugas. Balance de equipos pendiente. |
| `elektra` | Elektra (Rare) | F4/lote 3: Sai Letal recarga 4s desde despliegue/uso; siguiente ataque a sangrante <=50% HP recibe x1.75 y consume. Conserva sangrado y signature. | Implementado: preparacion temporal transferible de presa, sin critico garantizado ni ejecucion de boss. Balance de equipos pendiente. |
| `okoye` | Okoye (Common) | F4/lote 6: tercera estocada consecutiva a la misma presa aplica ruptura 22%/3s garantizada y resistible. Pierde combo con cambio, movimiento, stun o pausa 2.5s. | Implementado: ruptura fiable reemplaza azar, conserva critico y signature. Balance de equipos pendiente. |
| `mbaku` | M'Baku (Common) | F4/lote 7: retira 20% de barrera actual al atacar, maximo 120% poder efectivo, recarga 4s. Conserva ruptura aleatoria y signature. | Implementado: sin sobrante a HP ni dano proporcional a vida del boss; necesita barrera detectable en alcance. Balance de equipos pendiente. |
| `red_guardian` | Red Guardian (Common) | F4/lote 7: cada 3s primer rebote intercepta al mas avanzado detectable en alcance; stun 0.3s si supera al primario. Sin stun aleatorio. | Implementado: consume al disparar; no multiplica control por rebotes de objetos; inmunidades y resistencias intactas. Balance de equipos pendiente. |
| `korg` | Korg (Common) | F4/lote 7: >=3 terrestres detectables a 65px activan pisoton 50% poder y slow 35%/1.5s a hasta 5, cada 5s. Conserva splash, sustituye slow aleatorio. | Implementado: no voladores ni penetracion universal, cobertura y radio limitados. Balance de equipos pendiente. |
| `echo` | Echo (Common) | F4/lote 7: tres ataques preparan cuarto x1.6 y marca 12%/2.2s, reemplaza marca aleatoria. Conserva critico, deteccion y evolucion. | Implementado: pierde aprendizaje al cambiar, mover/stun/retiro, perder cobertura o pausa 2.5s; no copia aliados. Balance de equipos pendiente. |
| `valkyrie` | Valkyrie (Rare) | F4/lote 8: tras 5s quieta en montana/techo, siguiente ataque x1.75; conserva sangrado/critico/signature. | Implementado como carga visual sin traslado logico; terreno real, movimiento/stun/retiro reinician. Balance de equipos pendiente. |
| `rogue` | Rogue (Epic) | F4/lote 8: cada6s absorbe de no-boss armadura->penetracion20%, runner->cadencia15%, volador->alcance15%, durante3s. Conserva signature independiente. | Implementado: un rasgo permitido, prioridad fija, no acumulacion ni robo de pasivas; movimiento/stun/retiro limpian. Balance de equipos pendiente. |
| `beast` | Beast (Epic) | F4/lote 8: dos ataques con pareja preparan golpe al vecino65% poder +slow35%/1.5s, recarga3s. Conserva rebote/slow/signature. | Implementado: pareja detectable en cobertura a80px; aislado, cambio, movimiento/stun/retiro o pausa2.5s reinician. Balance de equipos pendiente. |
| `x_23` | X-23 (Epic) | F4/lote 2: tres ataques preparan critico minimo x3 contra misma presa sangrante; se consume, pierde por cambio/stun/movimiento o pausa 2.5s. Conserva sangrado y Corte Multiple signature. | Implementado: remate de objetivo unico, sin ejecucion de boss ni doble multiplicacion critica. Balance de equipos pendiente. |
| `drax` | Drax (Rare) | F4/lote 8: +8% dano por ataque previo al mismo boss/amenaza4+, techo40%; conserva sangrado/signature. | Implementado: cambiar, movimiento/stun/retiro, perder cobertura/deteccion o pausa2.5s reinicia. Sin cadencia extra; balance de equipos pendiente. |
| `lady_sif` | Lady Sif (Rare) | F4/lote9: critico minimo x2.5 cada4s contra elite con armadura y ruptura activa; conserva ruptura/critico/signature. | Implementado: sin doble critico ni ejecucion, defensas intactas; movimiento/stun/retiro reinician recarga. Balance de equipos pendiente. |
| `white_tiger` | White Tiger (Rare) | F4/lote9: consume marca propia8%/<=2s para disparo x1.8 cada4s, sin reaplicarla en ese proyectil. Conserva deteccion/critico/signature. | Implementado: protege marcas ajenas/fuertes, remate visual sin traslado de casilla; recarga no evadible con retiro. Balance de equipos pendiente. |
| `tigra` | Tigra (Rare) | F4/lote9: +35% dano contra slow/web activos, sin acumulacion ni control nativo. Conserva sangrado/critico/signature. | Implementado: requiere combinacion con aliado/objeto; stun solo no activa ni mantiene un buff permanente. Balance de equipos pendiente. |
| `angela` | Angela (Epic) | F4/lote9: tres ataques preparan cuarto x1.9 contra mismo elite aislado, sin escoltas a90px. Conserva penetracion/rebote/critico. | Implementado: escolta incluso oculta, cambio, movimiento/stun/retiro, perdida de cobertura o pausa2.5s reinician. Balance de equipos pendiente. |
| `deadpool` | Deadpool (Epic) | F4/lote10: tres pistolas, dos katanas x1.5 a max90px, recarga1.2s real. Tras pausa2.5s en katana vuelve a pistolas recargando. Signature independiente preservada. | Implementado: despliegue/mover/stun/retiro recargan, sin procs durante pausa ni curacion a base. Balance de equipos pendiente. |
| `devil_dinosaur` | Devil Dinosaur (Rare) | F4/lote10: dos ataques con quorum3 terrestres preparan mordida x1.65, golpe35% a4 vecinos y stun0.3s, recarga6s. Conserva splash, elimina stun aleatorio. | Implementado: detectables en cobertura/radio58px, no desplaza, reinicio por grupo insuficiente o pausa2.5s/movimiento/stun/retiro. Balance de equipos pendiente. |

## Fase 5: control, deteccion y terreno

| ID | Heroe (rareza) | Actual | Firma propuesta y limite |
| --- | --- | --- | --- |
| `spiderman` | Spider-Man (Epic) | F5/lote1: umbral3/2 Iron Spider preservado; web comparte pausa por victima durante stun resistido+2s. Medidor de redes/pausa del ultimo objetivo. | Implementado: nuevas redes no evaden pausa ni la limpieza de estados; siguen ralentizando hasta umbral-1. No inmunidad a otros stuns. Balance de equipos pendiente. |
| `miles_morales` | Miles Morales (Epic) | F5/lote1: tres ataques sobre red cargan siguiente descarga45% poder, stun0.2s/reveal2s a3 blancos, radio65px, recarga5s. Retira stun aleatorio, conserva web/signature. | Implementado: sin red, pausa2.5s/mover/stun/retiro limpian carga; blancos detectables en cobertura, resistencias intactas. Balance de equipos pendiente. |
| `groot` | Groot (Common) | F5/lote2: raices radio48, 3.2s, slow68% terrestre resistible una vez por zona; cooldown10s. | Salir/mover/stun/retiro cancela sin borrar control aliado; sin slow aleatorio ni bloqueo de ruta. |
| `daredevil` | Daredevil (Epic) | F5/lote2: pulso190px, revelado2s cada8s; contraataque cada4 conservado. | Ventana local resistible sin vision global, no consume pulso vacio. |
| `quake` | Quake (Common) | F5/lote2: linea cada4s, hasta5 terrestres, 45% poder, ruptura16%/2s y slow30%/1.2s. | Cobertura y deteccion requeridas, sin desplazar ni afectar voladores con onda. |
| `medusa` | Medusa (Common) | F5/lote2: hasta3 enlaces2s cada5s; presupuesto slow60% repartido entre enlaces iniciales. | Distancia85px del ancla y cobertura; separacion/muerte/mover/stun/retiro cortan control. |
| `iceman` | Iceman (Legendary) | F5/lote3: rafaga1s, hasta4 detectables a44px; tres escarchas congelan0.6s. | Escarcha expira3s y victima comparte recuperacion4s mas stun real; splash ordinario conservado. |
| `storm` | Storm (Legendary) | F5/lote3: zona72px/4.2s cada9s captura modo y daño; ventisca55% o cinco pulsos42% a4. | Cambiar modo prepara siguiente zona; conserva anillo/ancla detectable y excepcion incidental. Mover/stun/retiro cancela. |
| `crystal` | Crystal (Common) | F5/lote3: ciclo nativo fuego/hielo/rayos cada2s con siguiente fase y color visibles. | Una fase por activacion; splash y ciclo signature con evolucion/objeto siguen independientes. |
| `namor` | Namor (Legendary) | F5/lote3: anfibio agua/pasto; daño x1.2 en agua, tres ataques preparan marea60% a3 vecinos cada6s. | Tierra conserva poder base/penetracion; agua real requerida, pausa3s/mover/stun/retiro limpian carga. |
| `namora` | Namora (Common) | F5/lote4: agua real, primer ataque preparado a presa nueva x1.65 y ruptura16%/2.8s al impacto; cooldown3s. | Historial por enemigo no se borra al mover/stun; ataque prematuro consume oportunidad, conserva penetracion22%. |
| `triton` | Triton (Common) | F5/lote4: sonar dirigido desde agua cada6s, revela3 ocultos por3s resistibles a65px del primario en cobertura. | No gasta sin ocultos, no vision global; deteccion propia y firma conservadas. |
| `jeff_the_land_shark` | Jeff The Land Shark (Rare) | F5/lote4: corriente90x44px por2.5s cada6s, slow45% terrestre resistible. | Salida/mover/stun/retiro corta solo su campo; sin desplazar, ejecutar ni curar. |
| `luna_snow` | Luna Snow (Rare) | F5/lote4: pulso cada1.5s alterna25/50% slow0.9s a4 detectables en cobertura/radio50. | Ritmo visible, sin escarcha ni stun; conserva splash38px y deteccion. |
| `mantis` | Mantis (Rare) | F5/lote5: sueno2s al impacto cada6s; daño directo despierta, DoT no. | Mantis evita dormidos; recuperacion compartida duracion real+4s. Conserva marca, sin curar. |
| `emma_frost` | Emma Frost (Legendary) | F5/lote5: modo psiquico mark17%/slow28% cada3s o Diamante60% resistencia al stun. | Cambio no limpia stun ni reinicia cooldown; critico/deteccion propios conservados, no aura. |
| `nightcrawler` | Nightcrawler (Epic) | F5/lote5: BAMF45% poder a3 detectables cada6s, saltos<=90px en cobertura. | Traslacion solo visual0.18s por punto; pausa disparos, regreso sin alterar casilla, conserva rebotes. |
| `cosmo` | Cosmo (Rare) | F5/lote5: red de4 marcas14%/2.5s a90px del ancla cada5s. | Separacion/perdida del ancla rompe contribucion sin borrar marca aliada; no stun global. |
| `heimdall` | Heimdall (Rare) | F5/lote6: pulso5s sobre3 amenazas avanzadas en cruz; revela y marca11%/2.5s resistibles. | Implementado; sin vision global, cooldown inicial y reinicio al mover/stun/retiro. |
| `squirrel_girl` | Squirrel Girl (Common) | F5/lote6: hostigamiento6s, cuatro golpes30% cada0.75s y slow inicial28%/1.4s sobre terrestre avanzado. | Implementado; una entidad, sin plazas/procs, poder capturado y cancelacion al perder presa/cobertura/fuente. |

## Fase 6: estados, marcas y magia

| ID | Heroe (rareza) | Actual | Firma propuesta y limite |
| --- | --- | --- | --- |
| `blade` | Blade (Epic) | F6/lote1: remate2x cada6s contra elite sangrante con vida<=50%; conserva sangrado y veneno. | Implementado; sustituye contador/cadencia por bajas, sin ejecucion ni curacion; consume al disparar. |
| `ghost_rider` | Ghost Rider (Legendary) | F6/lote1: Penitencia11s a1.3x rango, cap12% tras multiplicadores; cadena cada5 ataques con recuperacion6s/victima. | Implementado; prioridad de ruta, cooldown inicial/fijo, sin arrastre de voladores/fuera de cobertura; quemadura conservada. |
| `scarlet_witch` | Scarlet Witch (Secret) | F6/lote2: red cada7s sobre2-4 malditos en cobertura a90px; madura2s y detona70% poder. Conserva Hex incidental. | Implementado; aislamiento/muerte/fin de curse cancela, sin nuevas cadenas de procs; sustituye marca grupal por disparo. |
| `cloak` | Cloak (Rare) | F6/lote2: ventana65px/3s cada6s, hasta6 revelados con slow42%, resistibles y condicionados al campo. | Implementado; una exposicion por ventana, sin teletransporte ni revelado global; conserva deteccion propia. |
| `dagger` | Dagger (Rare) | F6/lote2: marca propia12%/3s al disparar; cada4s consume hasta3 propias a95px para65% poder. | Implementado; no consume marcas aliadas, conserva rebote basico, sin cura ni dependencia de Cloak. |
| `magik` | Magik (Epic) | F6/lote2: corte preparado6s sobre maldito,1.5x y ruptura; retorno0.6x a0.4s con penetracion55%. | Implementado; misma presa debe seguir maldita/detectable/en rango; sin mover casillas ni procs extra, reemplaza ruptura aleatoria. |
| `black_cat` | Black Cat (Rare) | F6/lote3: tres no criticos preparan garantia, cooldown3s; cualquier critico reinicia carga. | Implementado; conserva multiplicador critico/equipo sin duplicarlo, no economia; reinicio al mover/stun/retiro. |
| `elsa_bloodstone` | Elsa Bloodstone (Rare) | F6/lote3: tres ataques a jefe/amenaza4+, siguiente1.2x y dos venenos0.54%/4s, cooldown4s. | Implementado; misma presa, inactividad2.5s pierde carga; sin veneno nativo general. Firma Bloodstone permanece separada. |
| `gambit` | Gambit (Epic) | F6/lote3: tres cartas cargan detonacion65%/4 victimas a60px, cooldown4s; conserva rebote2. | Implementado; elimina propagacion duplicada, requiere misma presa y cobertura, sin procs secundarios. |
| `hela` | Hela (Legendary) | F6/lote3: baja propia maldita crea espinas diferidas0.6s,70% poder a3 detectados a65px, cooldown6s. | Implementado; una pendiente y cero recursion por bajas secundarias; conserva DoT y firma. |
| `human_torch` | Human Torch (Epic) | F6/lote4: zona55px/3s cada7s; ignicion90% poder a4 detectados con2s continuos de calor. Conserva burn y firma. | Implementado; corredores/reentrada pierden calor, snapshot de poder, sin procs en ignicion. |
| `the_hood` | The Hood (Rare) | F6/lote4: curse/marca preparada, penalizacion25% y cobro1.8x tras1.5s; ventana4s, recarga4s. | Implementado; misma presa maldita, sin cobro gratis al perderla; sustituye estados aleatorios, sin cura. |
| `psylocke` | Psylocke (Epic) | F6/lote4: concentracion1.5s sobre marcado prepara critico>=2.75x y ruptura28%/2s, cooldown5s. | Implementado; cambio/perdida de marca/cobertura o inactividad3s reinicia; sin area adicional. |
| `venom` | Venom (Epic) | F6/lote4: consume3 venenos propios cada6s para mordida limitada por poder y2% salud maxima de jefe. | Implementado; nunca consume aliadas; liquida fraccion transcurrida, sin ejecucion/curacion ni doble baja. |
| `jubilee` | Jubilee (Rare) | F6/lote5: destello6s retrasa un ciclo de apoyo preparado a0-1s, resistible, recuperacion6s/victima. | Implementado; sin stun, jefes ni phasers, conserva splash/slow y Danger Room; no gasta preparacion en blanco inelegible. |
| `loki` | Loki (Legendary) | F6/lote5: ilusion5s replica tras0.6s dano55% y slow42%/1.2s a misma presa en cobertura. | Implementado; sprite existente sin plazas, sin criticos/objetos/propagacion/economia extra; principales conservados. |

## Fase 7: energia y alcance especial

| ID | Heroe (rareza) | Actual | Firma propuesta y limite |
| --- | --- | --- | --- |
| `thor` | Thor (Mythic) | F7/lote1: red de3-5 a80px cada11s, madura1s para145% poder y stun0.3s; conserva cadena basica. | Implementado; pierde descarga al desconectar ancla/grupo; no carga aislados ni ocultos, sin nuevos procs. |
| `doctor_strange` | Doctor Strange (Legendary) | F7/lote1: portal65px/3s cada9s,4 contactos slow45%, un eco65% tras0.65s. | Implementado; todo en anillo, sin duplicar objetos/cadenas; campo fijo, no retarget, cancela al perder cobertura. |
| `captain_marvel` | Captain Marvel (Legendary) | F7/lote2:60 energia y9s preparan linea fija0.45s/2.2x,6 victimas; vuelo visual0.9s sin ataques. | Implementado; casilla logica fija, no gira ni gana cadencia por energia; burn y evolucion conservados. |
| `vision` | Vision (Legendary) | F7/lote2: rayo tras3 ataques y4s; fase atraviesa4, densa pen70% sobre uno. | Implementado; cambiar pierde carga y bloquea1.25s, sin reunir modos; Overclock conservado. |
| `star_lord` | Star-Lord (Rare) | F7/lote2: secundario1s contra otro blanco, elemento complementario y dano68% escalado. | Implementado; sin copia de objetos/criticos/area ni oro extra; aislados pierden secundario, burn con snapshot. |
| `jean_grey` | Jean Grey (Mythic) | F7/lote2:100 energia y12s preparan onda0.6s/1.2x,6 victimas; agotamiento2s con -25% dano/sin carga. | Implementado; empuje48/20 respeta vuelo/inmunes, sustituye empuje cada4 ataques; no rango por carga, Dark Phoenix conservado. |
| `cyclops` | Cyclops (Epic) | F7/lote3: carga3/2 en misma direccion, rayo1.3x hasta4; girar10 grados o inactividad3s pierde carga. | Implementado; modos conservados, no rellena X con AoE, reinicio por modo/movimiento/stun/retiro. |
| `silver_surfer` | Silver Surfer (Mythic) | F7/lote3: linea1.25x hasta6, factor distancia35%-120%, cada2 ataques. | Implementado; semiancho24px, mas debil cerca, carga se pierde por modo/movimiento/stun/retiro. |
| `nova` | Nova (Legendary) | F7/lote3:5 ataques y6s, pulso110% en70px hasta4. | Implementado; consume carga, no stun, rebote y penetracion conservados. |
| `black_bolt` | Black Bolt (Legendary) | F7/lote3:3 ataques misma presa y10s, prepara1s, grito250%/pen45% hasta5 en linea1.2x. | Implementado; silencio sin atacar, linea fija, perdida de presa/cobertura cancela, sin devolver recarga. |
| `magneto` | Magneto (Mythic) | F7/lote3:3 barreras rotas y6s, descarga120%/pen45% en85px hasta4. | Implementado; rupturas verificadas en impacto, descargas no crean fragmentos; conserva armorBreak. |
| `adam_warlock` | Adam Warlock (Mythic) | F7/lote3:2s fuera de accion y12s, capullo2s, siguientes3 ataques145%. | Implementado; no cura ni resucita ni modifica aliados; posicion nueva cancela reserva. |
| `ms_marvel` | Ms. Marvel (Rare) | F7/lote3: cada4s impacto real prepara remate105% tras0.22s a otro blanco en105px. | Implementado; sin rebote constante, identidad fotonica y arte conservados, cobertura/deteccion obligatorias. |
| `sentry` | Sentry (Mythic) | F7/lote3:6 ataques y10s, preparacion0.5s, onda130%/pen15% hasta5, agotamiento2s dano-35%. | Implementado; sin carga durante agotamiento; burn y The Void nivel100 con objeto conservados. |
| `beta_ray_bill` | Beta Ray Bill (Legendary) | F7/lote3:un rebote; cada4s retorno0.6s al primario por120%/pen25%. | Implementado; regreso requiere cobertura/deteccion, no stun adicional, firma Stormbreaker conservada. |
| `yondu` | Yondu (Common) | F7/lote3:una flecha, dos saltos distintos95px/60%,0.22s entre tramos y retorno. | Implementado; bloquea disparos durante vuelo/ruta, token evita retornos viejos, sin procs secundarios. |

## Lectura transversal

- Las fases 3-7 asignan un hogar de implementacion, no una restriccion de lore.
- Fase 8 revisa evoluciones y objetos de TODAS las filas, no solo las rarezas altas.
- Fase 9 muestra activacion real y limites sin llenar tarjetas del equipo.
- Fase 10 compara todas las familias en equipos y presupuesto equivalentes.
- Las propuestas de minas, clones, torretas y hostigadores requieren un limite
  tecnico comun: desaparecen con el dueno, no son heroes equipables y no
  heredan generadores de dinero ni disparan cadenas recursivas de signatures.
