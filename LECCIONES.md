# Lecciones aprendidas — Gadgets Navideños (Tauri 2)

## Arrastre de gadgets (2026-10-17)

### Contexto
Los gadgets son ventanas Tauri sin decoración (`decorations(false)`), transparentes,
`skip_taskbar`, `resizable(false)`, situadas por coordenadas x/y desde el panel.
Se agregó la posibilidad de moverlos arrastrando con el clic izquierdo.

### Cómo funciona el arrastre en Tauri
- Tauri inyecta `drag.js` en cada webview. Solo arrastra `mousedown` con clic
  izquierdo sobre elementos con `data-tauri-drag-region` (`"deep"` = subárbol,
  `"false"` = bloquea). Los tags nativos (`A`, `BUTTON`, `INPUT`, `SELECT`,
  `TEXTAREA`, `LABEL`, `SUMMARY`) y roles interactivos bloquean el arrastre salvo
  que lleven el atributo.
- `data-tauri-drag-region` en un elemento hace que **doble clic maximice** la
  ventana (`internal_toggle_maximize`). En gadgets eso no se quiere.

### Implementación elegida (arrastre libre con umbral)
En `src-tauri/src/main.rs` se inyecta `GADGET_DRAG_INIT` con
`WebviewWindowBuilder::initialization_script`:
- `mousedown` izquierdo (bubble, en `document`) sobre zona no interactiva →
  arma el arrastre y guarda el punto inicial.
- `mousemove`: si el puntero supera **4 px**, invoca
  `window.__TAURI_INTERNALS__.invoke("plugin:window|start_dragging")`.
- No se usa `data-tauri-drag-region`, así `drag.js` queda inerte y **no maximiza**
  con doble clic. Se respeta `data-tauri-drag-region="false"` como opt-out manual.
- Un clic sin movimiento (< 4 px) NO arrastra → los `click` de los gadgets siguen
  funcionando (clave para Vela, Galletita, etc. que usan divs clickeables).
- El toggle "Arrastrable" del panel se aplica en caliente con el evento
  `gadget:drag` (Rust `win.emit`) escuchado por el script.

### LECCIÓN CLAVE: posición del evento `Moved` vs `set_position`
- En Linux/X11, el evento `WindowEvent::Moved(pos)` entrega la posición
  **exterior (marco del WM)**, no la del cliente. El WM (Muffin/Cinnamon) agrega
  un marco superior (`_NET_FRAME_EXTENTS = 0,0,32,0` en la VM).
- `set_position(x, y)` interpreta coordenadas de **cliente**.
- Si se persiste `pos` y luego se aplica con `set_position`, el gadget sube **32 px
  en cada reinicio** (drift acumulativo).
- **Solución**: persistir `win.inner_position()` (cliente), que coincide con lo que
  espera `set_position`. Verificado con round-trip drag → reinicio (misma posición).
- Nota: `win.scale_factor()` devolvió 1.0 en la VM (sin escalado).

### Verificación usada
- Prueba de arrastre real con `python3-xlib` + XTest (mover puntero, botón 1,
  desplazar, soltar) y lectura de geometría con `xwininfo -id <id>`.
- `wmctrl -lG` reportó coordenadas x2 respecto de `xwininfo` (no fiable aquí);
  en esta VM conviene usar `xwininfo` / Xlib directamente.

### Comandos útiles
- Listar ventanas: `wmctrl -lG`
- Geometría fiable: `xwininfo -id 0x... | grep -E "Absolute|Width|Height"`
- Frame del WM: `xprop -id 0x... _NET_FRAME_EXTENTS`

## Gadget a pantalla completa atrapando el escritorio (2026-10-17)

### Síntoma
Al activar Nieve (`fullscreen` + `_alwaysTop` + `ignoreMouse:false`), no se podía
seleccionar nada debajo ni volver a desactivarla: el panel de control quedaba
tapado y sin recibir clics.

### Por qué pasa
1. `ignoreMouse:false` en una ventana a pantalla completa hace que capture TODO
   el mouse → nada debajo recibe eventos. En gadgets decorativos (nieve, luces)
   esto siempre debe ser `true` (click-through).
2. `_alwaysTop` pone al gadget en la capa **ABOVE** del WM. El panel de control
   era una ventana normal → quedaba debajo. En Cinnamon ambas ventanas `ABOVE`
   comparten capa y gana **la última apilada** (no la creada primero).

### Solución aplicada
- Panel de control con `always_on_top(true)` → nunca puede quedar sepultado.
- El panel se crea **al final** en `setup` (después de los gadgets) para quedar
  por encima en el arranque (en `setup` ni `set_focus` ni `is_visible` surten
  efecto porque el event loop aún no corre).
- `raise_panel_if_visible()`: tras apilar un gadget `always_on_top` en caliente
  (crear, guardar config o togglear "Siempre encima"), se re-sube el panel.
  `set_focus` (gtk_window_present) sí sube en runtime — verificado.
- Item de bandeja **"Desactivar todos los gadgets"**: escape de emergencia que
  cierra todos y marca `_active:false`. Funciona aunque algo tape la pantalla,
  porque la bandeja de Cinnamon vive en capa superior.

### Verificación (X11)
- Apilamiento real del WM: `_NET_CLIENT_LIST_STACKING` (último = arriba), vía
  `xprop -root _NET_CLIENT_LIST_STACKING` o Xlib. NO usar el orden de
  `wmctrl -lG` (es orden de mapeo, no de apilamiento).
- Click-through real: `XQueryPointer` y descender por `.child` hasta la ventana
  hoja bajo el puntero. Si NO es el gadget, el gadget es click-through.
- `wmctrl -a "<ventana>"` (EWMH activate) sirve para probar que activar sube.

### Nota
Ventanas `always_on_top` del panel quedan sobre otras apps mientras estén
visibles; el usuario puede ocultar el panel desde la bandeja (clic izquierdo).

## Rediseño del panel (2026-10-17)

### Estilo
Tema oscuro elegante navideño: fondo verde pino (`#0a1a17`) / azul noche
(`#071019`) con acentos dorados (`#d4af37`), títulos en **Playfair Display** y
texto en **Inter**, ambos self-hosted como `woff2` en `frontend/fonts/`
(variable fonts, subset latin, ~48KB + 38KB). Se cargan por ruta relativa desde
`style.css` (`url('fonts/inter.woff2')`) y Tauri los embebe en el binario al
compilar.

### Funcionalidad
- Buscador de gadgets (filtra en vivo la lista lateral).
- Indicador verde por gadget activo (punto) y badge Activo/Inactivo en la cabecera.
- Interruptores tipo switch para los booleanos; inputs numéricos/texto estilizados.
- Copos de nieve sutiles dibujados en un `<canvas>` (densidad `w*h/12000`,
  respeta `prefers-reduced-motion`).

### Cambio de comportamiento
Antes, cada cambio recargaba toda la config (`loadConfig` tras 500ms). Ahora se
actualiza solo lo necesario en sitio (badge + punto de la lista) → sin parpadeo.
El guardado sigue igual: `save_gadget_config` (y `set_gadget_top` para
`_alwaysTop`) aplican en vivo desde Rust.

### Verificación sin poder ver imágenes
Este modelo no puede leer imágenes. Para validar el render se usó **PIL** sobre
una captura (`gnome-screenshot -f`) y un **mapa ASCII de luminancia**: promedio
RGB del panel `(21,32,32)` (oscuro = tema nuevo), barra superior oscura, lista a
la izquierda y filas de config a la derecha. No hay `node`/`jsc`/ImageMagick en
el equipo; sí `gnome-screenshot` y `python3` + `PIL`.

## Bug: interruptores (switch) que no respondían al clic (2026-10-17)

### Síntoma
Al hacer clic sobre un switch del panel no se activaba ni se movía nada.

### Causa
El `<input type="checkbox">` estaba oculto (`opacity:0; width:0; height:0`) y el
contenedor del switch era un `<span>`. Como un `<span>` **no** es etiqueta
asociada, el clic sobre el control visible no llegaba al input → no se toggliaba.
Solo funcionaba si se clickeaba el texto (que sí tenía `label for=`).

### Patrón fiable para switches
1. El contenedor debe ser un `<label class="switch">` que **envuelva** el input
   (asociación implícita), o bien:
2. El input debe **cubrir** todo el switch (`position:absolute; inset:0;
   width/height:100%` con `opacity:0`), de modo que reciba el clic y togglee
   nativamente.

Se aplicó ambas cosas (label + input cubriendo el área) para que sea robusto.

### Verificación funcional
Se localizó el knob gris del switch `#cfd6cf` en una captura con PIL (buscar
píxeles cercanos a ese color y agruparlos), se clickeó con XTest en su centro y
se comprobó que el `_active` del gadget pasó a `true` y apareció su ventana.

### Control final: segmentado OFF | ON
El usuario encontró el switch "anchos y raros", así que se reemplazó por un
**segmentado OFF | ON** en las filas booleanas. Dos `<span>` de 40 px (iguales)
más un `<input type="checkbox">` oculto que guarda el estado: los segmentos
llaman a `paint()` y emiten `new Event("change")` para que corra el listener que
guarda. El `label for=` de la fila también sigue toggleando el mismo input.
Para localizarlo en pantalla se busca el segmento activo por color dorado
(`#d4af37`→`#b8963a`) con agrupación de componentes conexos.

## Bug: "Arrancar al inicio" no respondía al clic (2026-10-17)

### Síntoma
El segmentado OFF|ON de la fila "Arrancar al inicio" no se movía al hacer clic
y el arranque automático nunca se activaba (no se creaba el `.desktop`).

### Causa
`initAutostart()` (`frontend/control.js`) hacía:
```js
const seg = buildSeg(await invoke("autostart_get"));
autostartSeg.className = seg.wrap.className;
autostartSeg.innerHTML = seg.wrap.innerHTML;   // copia, pierde listeners
```
`buildSeg()` engancha los listeners de clic a los nodos originales, que **nunca
se insertaron en el DOM**. Copiar `innerHTML` crea nodos nuevos *sin* listeners:
ni `paint()` ni `invoke("autostart_set")` se ejecutaban. Los segmentados de las
filas de gadget funcionaban porque ahí se inserta `seg.wrap` completo.

### Solución
Mover los nodos en vez de copiarlos (mover conserva los listeners):
```js
autostartSeg.replaceChildren(...seg.wrap.childNodes);
```
Regla: `buildSeg()` siempre debe insertarse tal cual (`control.js`, renderConfig)
o repartiéndose con `replaceChildren`/`appendChild` sobre sus nodos.

### Hardening del backend (`src-tauri/src/config.rs`, `autostart_set`)
- `Exec="ruta"` entrecomillado (rutas con espacios, p. ej. binario de un
  AppImage montado en `/tmp/.mount_...`) y `%` escapado como `%%`.
- `fs::remove_file` con `let _ =` (si no existe, desactivado ya es el estado).
- `chmod 0755` al `.desktop` tras escribirlo.

### Verificación
XTest sobre el segmentado: clic en ON → el blob dorado salta de x≈148 a x≈188
(mitad ON) y aparece `~/.config/autostart/gadgets-navidenos.desktop` con
permisos 755; clic en OFF → el blob vuelve y el archivo se elimina. Los
segmentados de gadgets (fila booleana) siguen respondiendo igual.

## Pruebas de UI: `warp_pointer` no mueve el puntero (VM) (2026-10-17)

### Síntoma
Toda la automatización con Xlib quedaba "muda": clics que no hacían nada,
ventanas que no se movían, blobs dorados sin cambiar.

### Causa
En la VM (VirtualBox con integración de ratón) el puntero lo gobierna el host:
`Display.warp_pointer(x, y)` se ignora y el cursor queda clavado en la esquina
(1919,965). Todos los `ButtonPress` synthetic caían ahí, no sobre la ventana.

### Solución
Movimiento **absoluto vía XTest** (funciona):
```python
xtest.fake_input(d, X.MotionNotify, 0, root=root, x=rx, y=ry)
d.sync(); time.sleep(0.2)
xtest.fake_input(d, X.ButtonPress, 1); d.sync()
xtest.fake_input(d, X.ButtonRelease, 1); d.sync()
```
`detail=0` = absoluto (con `root`/`x`/`y`); `detail=1` = relativo. Confirmar con
`root.query_pointer()` que el hijo bajo el cursor es la ventana esperada antes
de pulsar.


## El Tiempo: búsqueda de ciudad (geocoding)

### Implementación
- API geocoding de Open-Meteo (gratuita, sin key):
  `https://geocoding-api.open-meteo.com/v1/search?name={q}&count=8&language=es&format=json`
- Clic en el nombre de la ciudad abre un overlay con input + resultados.
- Al seleccionar: guarda `city/lat/lon` en config y recarga el clima.
- Debounce de 250 ms antes de buscar.

### Bugs encontrados y corregidos
1. **`ignoreMouse: true` bloqueaba los clics**: El config del gadget hacía que
   los clics pasaran a través de la ventana. Se cambió a `false` (el gadget
   ahora es interactivo).
2. **`hidden` no oculta con `display: flex`**: `.search-overlay` tenía
   `display:flex`, que tiene más especificidad que el `display:none` implícito
   del atributo `hidden`. El overlay nunca se cerraba. Fix:
   `.search-overlay[hidden] { display: none; }`.
3. **Overlay `100vw/100vh` se salía de la ventana**: La ventana del gadget es
   300x212, pero `100vw` es el ancho del monitor. Se cambió a `100%`.

### Lecciones de entorno
- **Lanzar la app Tauri en background**: `nohup ... &` y `setsid ... &` fallan
  de forma intermitente porque el shell tool mata el grupo de procesos al
  terminar. Lo fiable: `start-stop-daemon --start --background --make-pidfile
  --pidfile /tmp/gn.pid --startas /bin/bash -- -c "exec ./app >log 2>&1"`.
- **Verificar invoke desde la webview**: Agregar un `invoke` temporal en `init`
  que escriba un flag al config; si aparece, el canal funciona. Los debugs por
  `document.title` no sirven (Tauri con `decorations:false` no propaga el título).
- **Clics XTest en gadgets transparentes**: Difícil localizar elementos cuando
  el fondo es transparente y se ve el escritorio detrás. Estrategia: barrido de
  posiciones detectando el borde dorado del overlay (`r>140, g>100, b<140,
  r>b+40`).
- **Firefox con stub sirve para validar la lógica** (`window.__TAURI__` simulado
  + `document.title` como logger), pero no valida el render en la webview real.

## Reproductor: playlist visible

### Implementación
- Contenedor `#playlist` (max-height 148px, scroll) debajo de los controles.
- `renderPlaylist()` crea un `<button class="pl-item">` por canción con número
  + título (`text-overflow: ellipsis`).
- `updatePlaylistHighlight()` marca `.current` y hace `scrollIntoView` para
  seguir la canción sonando.
- Clic en un item: fija `currentIndex`, `loadSong(i)` + `audio.play()`.
- Para que quepa la playlist en la ventana 410x520 se compactó: cover
  180→120 px, márgenes de visualizer/progress/controls reducidos.

### Lección de verificación visual (sin ver imágenes)
Para comprobar un cambio de estado que solo altera estilos (p. ej. cuál fila
está resaltada) sin poder ver la captura:
- Capturar antes y después con `gnome-screenshot`.
- `ImageChops.difference(a, b).getbbox()` y contar píxeles cambiados por fila.
- El bloque de filas que cambia delimita el elemento que se actualizó.
- Detectar el texto dorado por color (`r>140,g>100,b<140,r>b+40`) ayuda a
  localizar el item `.current` (color `#d4af37`), pero el **fondo** dorado es
  tenue (`rgba(212,175,55,0.18)`) y no se detecta: hay que comparar capturas.

## Reproductor: no reproducia (WebKitGTK + tauri://)

### Sintoma
El `<audio>` daba `MediaError.code = 4` (MEDIA_ERR_SRC_NOT_SUPPORTED) y no
sonaba, aunque:
- `fetch(encodeURI(file))` devolvia 200 con `content-type: audio/mpeg`.
- El mp3 estaba embebido en el binario (assets de `frontendDist`).
- `gst-discoverer-1.0` decodificaba el mp3 sin problema (MPEG-1 Layer 3).
- El plugin `libgstmpg123.so` estaba instalado.

### Causa
El backend multimedia de **WebKitGTK usa GStreamer** para `<audio>`/`<video>`,
y su elemento `source` no entiende el esquema custom `tauri://localhost/...`
(usado para los assets embebidos). El `fetch` si funciona porque va por el
proceso de red de WebKit, no por el pipeline de GStreamer.

### Solucion
Resolver el archivo a un **blob URL** y asignarlo al `<audio>`:

```js
async function resolveSrc(file) {
    const url = encodeURI(file);
    try {
        const res = await fetch(url);
        const blob = await res.blob();
        return URL.createObjectURL(blob);
    } catch (e) {
        return url;
    }
}
```

Con eso el `<audio>` carga (`canplay`) y reproduce (confirmado por un
`sink-input` de PulseAudio con el `media.name` de la cancion).

### Leccion de diagnostico (sin poder oir)
- Verificar el stream real de audio con
  `pactl list sink-inputs | grep media.name`: si aparece el nombre de la
  cancion, WebKit esta emitiendo audio al servidor de sonido.
- Descartar causas comparando capas: `fetch` (red) OK + `gst-discoverer`
  (codec) OK + `<audio>.error.code` = 4 (pipeline) aisla el problema en el
  media player, no en el asset ni en el codec.

## CRÍTICO: refresh del frontend embebido en builds debug (2026-10-17)

### Síntoma
Editar un gadget (`index.html`/`script.js`/`style.css`) y reconstruir con
`touch build.rs && cargo build` o `touch src/main.rs && cargo build` **no**
reflejaba los cambios: la ventana seguía mostrando la versión anterior.

### Causa
- Los assets de `frontendDist` (`../frontend`) se **embeber en el binario** en
  tiempo de compilación (`tauri::generate_context!` + lo que genera
  `tauri_build::build()` en `OUT_DIR`).
- `build.rs` (propio) solo declara `rerun-if-changed` para el **directorio**
  `../frontend/gadgets`, `config.json` e `index.html`; **no** para `script.js`
  ni `style.css`.
- `tauri-build` guarda los assets en `OUT_DIR`; si no se re-ejecuta, tocar
  `main.rs` recompila pero vuelve a incluir el asset **viejo**.

### Solución fiable (forzar la regeneración de assets)
```
cd src-tauri
rm -rf target/debug/build/gadgets-navidenos-tauri-*
cargo build
```
Esto obliga a re-ejecutar `build.rs`/`tauri-build` y re-embebe el frontend.
Tocar `tauri.conf.json` también dispara `tauri-build`, pero no resultó
suficiente de forma consistente; el `rm -rf` del dir de build sí es fiable.

### Verificación de embedding
Insertar una **caja visible inline** en el `index.html`
(`<div style="position:fixed;top:0;right:0;width:40px;height:40px;background:#00ff00">`)
y buscarla con PIL por color puro. Sirve para confirmar que el binario embebe
realmente el HTML nuevo (independiente del CSS/JS).

## CRÍTICO: los gadgets `always_on_bottom` quedan TAPADOS (2026-10-17)

### Síntoma
Las capturas mostraban texto/ventanas que no eran el gadget: parecía que el
gadget no renderizaba, su altura era rara, no aparecían los colores, etc.

### Causa
Originalmente los gadgets se creaban con `_alwaysTop:false` → `always_on_bottom(true)`,
lo que dejaba la ventana en la capa **BELOW** (detrás de ventanas normales
maximizadas como el terminal).

### Solución aplicada (2026-10-18)
- Los gadgets con `_alwaysTop:false` ahora son **ventanas normales** (sin `keep_below`).
- En `create_gadget` se inyecta `GADGET_RAISE` (DOM loaded, con reintentos a
  0/400/1200/2500ms) → llama `raise_gadget` para subirlos al tope de su capa.
- `selectGadget()` del panel también invoca `raise_gadget` si el gadget está abierto.
- Al cambiar `_alwaysTop` se limpia `keep_below`.
- Resultado: gadgets visibles sobre ventanas abiertas; el panel (ABOVE) sigue sobre ellos.

### Diferencia debug vs AppImage (2026-10-18) — causa raíz del bug "funciona en
### debug pero no en el AppImage"
- En debug el binario + frontend van sin optimizar y el DOM tarda más en cargar,
  por lo que el `set_focus` del `DOMContentLoaded` llega **después** de que X mapee
  la ventana → Muffin lo aplica.
- En el AppImage los assets van embebidos: el DOM carga muy rápido, el `set_focus`
  llega **antes** de que la ventana esté viewable → **Muffin lo ignora
  silenciosamente** (`set_focus` devuelve `Ok` igual, pero `is_focused()` sigue
  en `false` y la ventana queda debajo de la maximizada). Reproductor, Vela y
  Villancico (los que se auto-activan al arrancar) eran los visibles.
- **Solución**: `raise_gadget` reintenta `set_focus` (5 × 150ms) y si aún no hay
  foco ejecuta `wmctrl -a <título>` — el mismo `_NET_ACTIVE_WINDOW` que enviaría un
  pager, que Muffin acepta aunque la app no tenga interacción previa
  (focus-prevention). Además `GADGET_RAISE` reintenta el invoke en
  0/400/1200/2500ms por si el IPC no está listo en el primer intento.

### Lección
Antes de diagnosticar un gadget "que no renderiza", confirmar con
`xwininfo -root -tree`/`xprop _NET_CLIENT_LIST_STACKING` qué ventana cubre su
posición. Si funciona en debug pero no en release/AppImage, sospechar de
**timing** (carga de assets embebidos vs disco) y verificar con logs de
`is_focused()` si el WM está aceptando la activación. `wmctrl -a` es un buen
fallback para forzar `_NET_ACTIVE_WINDOW` sin depender de focus-prevention.
Cuidado con `pkill -x gadgets-navidenos-tauri`: no matchea (nombres >15 chars
se truncan a `gadgets-naviden`); usar `pkill -x gadgets-naviden` o `pkill -f`.

## Crash/bug: `resizable(false)` fuerza mínimo 200px en Linux (2026-10-17)

### Síntoma
Ajustar `CPU - RAM` a 220x96 daba una ventana de 220x**200** (cliente 168):
el alto pedido se ignoraba; el ancho sí se respetaba. Config de 100/130/150/168
→ todas quedaban en 168 de cliente; 180 sí se respetaba.

### Causa
Bug conocido de `tao`/`tauri` en Linux: con `resizable:false` el WM fuerza un
**mínimo de ~200px** (cliente ~168) — ver tauri-apps/tao#561 y
tauri-apps/tauri#6125. `min_inner_size(80,30)` NO lo evita.

### Solución aplicada
Cambiar `WebviewWindowBuilder::resizable(false)` → `resizable(true)` en
`create_gadget`. Sin decoraciones el usuario no ve asas de redimensión, así que
la UX no cambia. Verificado: config 96 → cliente 96 (outer 128).

### Nota
El usuario puede redimensionar con atajos del WM (p. ej. Alt+F8) aunque no haya
bordes. Alternativa (no aplicada): fijar tamaño con
`webkit2gtk`/`gtk::prelude::WidgetExt::set_size_request` vía `with_webview`.

## CPU-RAM: sparkline compacto (2026-10-17)

### Diseño
- Ventana 220x96. Dos filas (CPU/RAM): etiqueta (rojo `#e74c3c` / verde
  `#2ecc71`), `<canvas class="spark">` y valor dorado.
- Historial `MAX_SAMPLES=60` (últimos 60 s, el evento `cpu-ram` llega cada 1 s).
- `drawSpark()`: área con gradiente (alfa 0.35→0), línea de 3px, **alineado a la
  derecha** y avanza hacia la izquierda; al inicio ocupa pocos px (se llena en
  ~60 s).
- `fitCanvas()` ajusta el buffer del canvas al tamaño CSS × `devicePixelRatio`.

### Verificación (visual, sin ver imágenes)
- Colores por conteo PIL en la región de la ventana: CPU rojo ≈400px, RAM verde
  ≈400px, valores dorado ≈180px; la línea ocupa casi todo el ancho tras 60 s.
- Recordar: el gadget debe estar visible (`_alwaysTop:true`) para capturarlo.

## Grupo C: 5 gadgets nuevos (2026-10-17)

### Gadgets creados
- **Calendario de Adviento** (320x300): grid 6x4 de 24 puertas. En diciembre se
  abren las puertas hasta el dia actual; el resto quedan bloqueadas. Persiste
  `opened:[]` en config (`save_gadget_config`). Puerta abierta: estrella dorada
  + palabra. En octubre se ve todo bloqueado (correcto).
- **Globo de Nieve** (260x300): todo en `<canvas>`; esfera con arbol, muneco de
  nieve, luna y nieve. Clic = `shake()` (impulso a las particulas).
- **Termometro** (150x300): mercurio que sube segun los dias restantes para el
  25 dic (`TOTAL_DAYS=90`); completo ese dia. Tubo visible + marcas doradas.
- **Tarjeta** (320x220): postal con mensaje y firma **editables**
  (`contenteditable`), persistidos en config (debounce 600 ms).
- **Bailarin** (240x300): SVG animado con SMIL, sin JS.

### Tecnicas
- Animacion SVG sin JS: `<animateTransform>` / `<animate>` (SMIL), fiable en
  WebKitGTK; con `transform-box` + CSS es mas fragil.
- `contenteditable` con placeholder:
  `[contenteditable][data-placeholder]:empty::before { content: attr(data-placeholder) }`.
  El elemento debe quedar realmente vacio (`textContent=""`) para que `:empty`
  coincida.
- Iconos del panel: `gadgets/<Nombre>/icon.png` (128x128); si falta, el panel usa
  `icon.png` raiz. Generados con PIL (fondo redondeado + glifo dorado).

### Verificacion (leccion importante)
- **Recortar `gnome-screenshot` por coordenadas y clasificar por umbrales falla**:
  el verde de las puertas bloqueadas (`#256b45`) no superaba `g>140`, y el
  mercurio se mezclaba con la bombilla. Mejor: **capturar la ventana con Xlib**
  (`win.get_image`) y **muestrear pixeles concretos** (columna/fila) para leer
  RGBA exactos. Asi se confirmo el mercurio rojo/naranja del Termometro que el
  mapa ASCII mostraba "vacio".
- Para activar gadgets nuevos sin el panel: escribir
  `~/.config/gadgets-navidenos/<Nombre>/config.json` con `_active:true` antes de
  iniciar la app (`ensure_user_gadget_configs` no pisa los existentes).
- **No usar `pkill -f gadgets-navidenos-tauri`**: coincide con la propia linea de
  comandos del shell y se autodestruye. Usar `systemctl --user stop gn-daemon`
  (si se lanzo con `systemd-run --unit=gn-daemon`) o la trampa de corchetes
  `pkill -f 'gadgets-navidenos-taur[i]'`.

### Empaquetado (build de release)
- `cargo tauri build` (desde `src-tauri/`) genera `.deb` y `.AppImage` en
  `target/release/bundle/{deb,appimage}/`. El tooling de AppImage queda cacheado
  en `~/.cache/tauri` (~35 MB), asi que builds posteriores no lo descargan.
- **ICE de rustc al empaquetar** (rustc 1.99.0): `[profile.release]` con
  `lto = true` + `codegen-units = 1` + `opt-level = 3` revienta compilando `gtk`
  (`attrs_for_def` / `list_model::ListModelExtManual`) = rust-lang/rust#148191.
  Workaround confirmado: `lto = false` en `[profile.release]`. Con eso el `.deb`
  (~20 MB) y el `.AppImage` (~98 MB) se generan sin problema.
- Antes de empaquetar conviene borrar `src-tauri/target/` (ocupaba ~5.2 GB entre
  debug+release+bundles); libera espacio y el release se reconstruye limpio.

### Borde del panel de control
- El panel (600x600, `decorations(false)`, fondo oscuro) se confundia con el
  escritorio al intentar moverlo. Se agrego en `frontend/style.css` un
  `body::after` fijo con `inset: 0`, `border: 1px solid rgba(236,231,219,0.45)`,
  `pointer-events: none` y `z-index: 9999` (queda sobre `#snow` y `#titlebar` sin
  bloquear clics).
- Verificado por muestreo Xlib: los cuatro bordes dan ~(112-117,116-122,112-120)
  claro vs interior ~(9-19,22-31,24-34) oscuro.

### Gadget activo por defecto
- Para que el paquete muestre que funciona sin abrir el panel, se deja
  `_active: true` en el `config.json` de **Globo de Nieve** (autocontenido y
  animado); el resto de gadgets quedan `_active: false`.

### Visibilidad persistida del panel (2026-10-17)
- Sintoma: al reiniciar (arranque automatico o manual) se abria el panel de
  control aunque el usuario lo hubiera cerrado antes de salir.
- Causa: `create_control_panel` siempre construia la ventana visible; la
  ocultacion (`×`, bandeja, `CloseRequested`) solo llamaba a `hide()` sin
  guardar el estado en ningun lado.
- Solucion: `panel_visible` vive en `~/.config/gadgets-navidenos/app.json`
  (`config::panel_visible` / `config::set_panel_visible`) y TODA la
  visibilidad pasa por `set_panel_visible(app, bool)` en `main.rs`, que
  persiste y luego muestra/oculta. El builder usa `.visible(saved)` /
  `.focused(saved)`.
- Leccion: centralizar mostrar/ocultar en una sola funcion que ademas
  persiste evita olvidar rutas (× del panel, `window_close`, clic izquierdo
  de la bandeja y `CloseRequested` escriben el estado; `show_panel` pone true).
- Verificacion: `xwininfo -root -tree` tras relanzar con `panel_visible:false`
  no muestra "Panel de Control" pero si el gadget activo (Globo de Nieve).

## Carpetas externas, select nativo y detalles de UI (2026-10-18)

### Rutas multimedia externas (fuera del bundle)
- Los gadgets traian solo medios embebidos (`config::gadget_media`). Se permitio
  elegir una **carpeta externa** (ruta absoluta) desde el panel.
- `gadget_media_files` ahora detecta `subfolder.starts_with('/')` y usa
  `list_external_media` (recursivo, profundidad <= 6, tope 1000 archivos) en vez
  del listado embebido. `is_media_name` filtra mp3/jpg/jpeg/png/gif/webp.
- **Servir el archivo al webview**: el asset protocol y los esquemas custom
  fallan con WebKitGTK/GStreamer. Solucion: comando `media_file_data_uri` que lee
  el archivo y devuelve `data:<mime>;base64,...` (crate `base64`, API
  `general_purpose::STANDARD`). El gadget convierte ese data URI a `Blob` y de ahi
  a `URL.createObjectURL` (audio) o lo usa directo en `img.src` (imagenes).
- `pick_folder` es `async` + `tauri::async_runtime::spawn_blocking` ejecutando
  `zenity --file-selection --directory` (sin dependencias Cargo nuevas; cancelar
  = exit != 0 -> `Ok(None)`).

### Recarga en caliente sin re-render del panel
- El drag de un gadget ya emite `gadget:config-changed` con debounce, y el panel
  escucha ese evento para re-renderizar el formulario (`control.js`). Si
  `save_gadget_config` emitiera lo mismo, cada guardado re-armaria el form y
  perderia el foco/scroll.
- Solucion: `save_gadget_config` emite un evento **distinto**
  `gadget:config-saved` con `{name, config}`. Los gadgets lo escuchan y recargan
  solo si cambio un campo relevante (comparando con su cfg actual), asi no
  recargan imagenes/canciones al mover la ventana.

### Select nativo en WebKitGTK
- El `<select>` con estilo propio mostraba el **valor seleccionado en blanco
  sobre fondo claro** (el texto solo se veia al abrirlo). Causa: el control
  nativo ignora `color`/`background` en estado cerrado.
- Solucion: `appearance: none; -webkit-appearance: none;` + fondo propio +
  flecha como `background-image` con un SVG inline en data URI (ojo: en la URL
  codificar `#` como `%23`).

### Detalles de UI del panel
- Boton "Examinar…" con texto desbordaba el borde de la fila. Reemplazado por un
  **icono de lupa** (SVG inline 16x16) en boton cuadrado 36x36 con
  `display:inline-flex; align-items:center; justify-content:center`.
- El badge de estado del titulo ("Activo"/"Inactivo") se salia del borde con
  nombres largos. Reemplazado por un **circulo** de 13px verde/rojo
  (`title`/`aria-label` conservan el texto para accesibilidad).

### Verificacion (dos tecnicas utiles)
- **Comprobar que el frontend quedo embebido** tras `cargo build`: los assets
  viven en `target/debug/build/gadgets-navidenos-tauri-*/out/tauri-codegen-assets/`
  y estan comprimidos con **brotli** (NO buscar magic "BR": el stream brotli no
  tiene cabecera; descomprimir directo con `brotli.decompress`). Buscar ahi las
  cadenas CSS/JS confirma el re-embed.
- **Validar sintaxis JS sin node** (no hay node en el equipo): usar PyGObject
  `JavaScriptCore` 4.1 -> `ctx.check_syntax(src, -1, CheckSyntaxMode.SCRIPT, uri, 1)`.
- Verificacion visual real: capturar la ventana con Xlib `win.get_image` +
  PIL y **abrir el PNG** (permite revisar el render sin adivinar por pixeles).

## PENDIENTE: el audio no suena dentro de la app (2026-10-18)

**RESUELTO el 2026-10-19. Ver "Audio: causa raíz y fix definitivo" al final
del archivo.** El diagnóstico de abajo quedó superado; se conserva como
historial. Resumen: eran DOS problemas distintos (mudo por Web Audio, y el
salto a ~50% por no soportar Range).

### Sintoma
Ningun gadget reproduce audio en la app (Reproductor y Villancico). Falla tanto
el binario de release (`src-tauri/target/release/gadgets-navidenos-tauri`) como
el AppImage. En modo plan solo se diagnostico (lectura).

### Descartado (comprobado)
- **Audio del sistema OK**: sink PipeWire `alsa_output.pci-0000_00_05.0.analog-stereo`
  activo, sin mute, volumen 40%. Tarjeta ALSA `Intel 82801AA-ICH`.
- **El MP3 esta bien**: el villancico suena al reproducirlo por fuera (y YouTube
  suena en Firefox) -> no es el archivo ni la VM/host.
- **GStreamer OK**: decoder `mpg123` presente y sinks `autoaudiosink`/`pulsesink`/
  `pipewiresink`/`alsasink` disponibles; el registry de WebKit se actualiza al
  correr la app (si carga plugins).
- **No es autoplay por diseno**: wry 0.57 trae `autoplay: true` por defecto y en
  WebKitGTK hace `AutoplayPolicy::Allow`
  (`~/.cargo/registry/.../wry-0.57.0/src/webkitgtk/mod.rs:403`).
- **El clic si se ejecuta**: al pulsar Play en Villancico aparecen las notas
  flotando (el handler corre) pero no se oye nada.
- **No es rutas/empaquetado**: release y AppImage fallan igual (AppImage ya trae
  GStreamer con `bundleMediaFramework: true`).

### Bug confirmado (aparte, seguro)
- Villancico usa `audio.src = encodeURI(mp3)` (`frontend/gadgets/Villancico/script.js:16`)
  con la ruta relativa -> URL del **esquema interno de Tauri** que GStreamer no
  reproduce. Hay que pasarlo a `fetch -> blob -> objectURL` como el Reproductor
  (o `media_file_data_uri`). Esto es independiente del resto.

### Traga-errores que oculta la causa
- Reproductor: `setupVisualizer()` crea `AudioContext` + `createMediaElementSource`
  y `audio.play().catch(()=>{})` (`script.js:76-95` y `141-153`); cualquier
  rechazo (o un `AudioContext` en `suspended`) queda invisible.
- Villancico: mismo patron de `catch` silencioso.

### Hipotesis vivas (con su prueba discriminante)
1. **Sandbox de WebKitGTK** (existe `/usr/bin/bwrap`): el proceso de media no
   accede al socket de PipeWire -> silencio sin error.
   Prueba: lanzar con `WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1`.
2. **Activacion/foco**: las ventanas se crean con `.focused(false)`
   (`src/main.rs:347`) y hubo lios de foco -> WebKit podria no contar el clic
   como activacion. Prueba: capturar el error real de `play()`.
3. **Pipeline de media de WebKitGTK roto en esta VM** (VMware sin 3D, ventana
   `transparent(true)`). Prueba: aislar con WebKitGTK puro.

### Plan de diagnostico (retomar manana, en Build)
1. Exponer el error real (temporal, sin commitear): loguear `await audio.play()`
   (exito/rechazo y nombre), `audio.error`, `audioCtx?.state`, `document.hasFocus()`.
   - `NotAllowedError` -> hipotesis 2. Mudo sin error -> 1 o 3.
     `NotSupportedError` -> esquema (bug de Villancico).
2. Lanzar con `WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1` y probar. Si suena -> 1.
3. Lanzar con `GST_DEBUG=4 WEBKIT_DEBUG=Media=all` y buscar errores de sink/decoder.
4. Aislar WebKitGTK del codigo: script Python (`gi` webkit2) que cargue un HTML
   local con `<audio controls autoplay>` apuntando al MP3. Si tampoco suena, el
   problema es WebKitGTK/entorno, no la app.
5. Arreglar Villancico (`fetch -> blob`) aparte.
6. Decidir arreglo segun resultado (env de sandbox / foco / cambiar enfoque de audio).

### Entorno util
- WebKitGTK 2.52.6. `~/.cache/gstreamer-1.0/registry.x86_64.bin` se regenera al correr.
- Material de audio: `frontend/gadgets/Villancico/Jingle Bells Rock.mp3`.

### Fixes ya aplicados y verificados (mismo dia, aparte del audio)
- 4 mejoras del panel: select Efecto legible, boton lupa 36x36, badge circular
  verde/rojo, labels Mensaje/Firma y canal `opened` oculto.
- AppImage empaquetado **con** GStreamer (`bundleMediaFramework: true`) e
  `patchelf` estatico en `~/.local/bin/patchelf` (prefixar PATH al empaquetar).

## Audio: causa raíz y fix definitivo (2026-10-19)

### Resultado
Los tres audios suenan correctos desde el inicio y sin saltos:
Reproductor canción 1, canción 2 y Villancico. Verificado midiendo el audio
real (no `currentTime`).

### Método de verificación (clave: NO confiar en `currentTime`)
`currentTime` del elemento va suave y correcto AUNQUE el audio audible esté
mal (salta a otra parte). Hay que medir la señal de salida:
1. Grabar el monitor de PipeWire:
   `parec -d alsa_output.pci-0000_00_05.0.analog-stereo.monitor
   --format=s16le --rate=8000 --channels=1 > /tmp/rec.raw`
2. Decodificar el MP3 de referencia a PCM 8 kHz mono con
   `gst-launch-1.0 filesrc location=X ! decodebin ! audioconvert !
   audioresample ! audio/x-raw,format=S16LE,channels=1,rate=8000 ! filesink`.
3. Envolvente RMS (bloques de 20 ms) + correlación de Pearson para ubicar la
   posición audible en el tiempo. Scripts de trabajo: `/tmp/analyze*.py`.
4. Alinear por bloques GLOBALES (búsqueda en todo el archivo) y NO encadenar:
   el encadenado con ventana local ±2 s se "despista" en canciones repetitivas
   (daba conf 0.4-0.6 y posiciones falsas; global da conf ~1.0 y la posición
   real). Un bloque de 3 s con corr 1.000 es prueba suficiente.

### Causa raíz 1: WebKitGTK no reproduce audio de protocolos custom → blob
- `tauri://localhost/...` (esquema interno) da `NotSupportedError` (`error.code=4`)
  en `<audio>`. Confirmado en el upstream: WebKitGTK no acepta esquemas
  desconocidos para media (tauri#8654).
- Workaround aplicado antes: `fetch -> Blob -> URL.createObjectURL`. Hace que
  suene, pero **rompe la reproducción**.

### Causa raíz 2: sin soporte HTTP `Range`, el audio salta a ~50%
- Síntoma exacto medido: la canción arranca bien (~1-2 s) y a los ~5 s salta a
  la MITAD del archivo (canción de 272 s → 136 s) y sigue desde ahí. `currentTime`
  sigue marcando 0,2,4,... Engaña por completo.
- Es el "duration probe" de WebKit: cuando la fuente no soporta `Range`, busca
  el 50% para estimar duración y se queda ahí.
- El blob (todo en memoria) tampoco soporta Range → mismo salto. Reportes
  upstream lo confirman (tauri#15472, WebKitGTK 2.52.x): asset:// y blob fallan
  en Linux; **un HTTP local sí funciona**.
- Efecto secundario observado: a veces el elemento se queda en `waiting` y no
  llega a `playing` (silencio total, "la 1 no se escuchaba") → reintentar cargar
  lo arregla. Mismo origen.

### Fix definitivo: servidor HTTP local con `Range`
- Nuevo módulo `src-tauri/src/media.rs`: servidor HTTP mínimo con `std`
  (TcpListener, sin dependencias). Escucha en `127.0.0.1:0` (puerto
  efímero) con token aleatorio de 16 bytes en la ruta (`/dev/urandom`).
- Rutas: `/{{token}}/a/<gadget>/<relpath>` (audio embebido) y
  `/{{token}}/f/<ruta-absoluta-urlencoded>` (carpeta externa del usuario).
- Responde `206 Partial Content` + `Content-Range` + `Accept-Ranges: bytes`;
  parsea `bytes=a-b`, `bytes=a-` y sufijo `bytes=-n`. `Connection: close`.
- El audio embebido se incluye en el binario con `include_bytes!` generado por
  `build.rs` (`GADGET_AUDIO: &[(&str,&str,&[u8])]`); solo audio/vídeo,
  no las imágenes (esas van bien por el esquema custom).
- Frontend: `mediaServerBase()` (comando `media_server_base`) y
  `resolveSrc()` arma `http://127.0.0.1:<puerto>/<token>/a/<gadget>/<archivo>`.
  Se eliminó el blob (`dataUriToBlob`, `URL.revokeObjectURL`, `audio.__blobUrl`).

### Código de audio (estado final)
- `src-tauri/src/media.rs` (nuevo): servidor + parseo de Range.
- `src-tauri/build.rs`: `is_audio_file`, `collect_audio`, `GADGET_AUDIO`.
- `src-tauri/src/main.rs`: `mod media;`, `media::start()` en `setup`,
  comando `media_server_base`.
- `frontend/gadgets/Reproductor/script.js` y
  `frontend/gadgets/Villancico/script.js`: `resolveSrc()` por HTTP local.

### Otras lecciones
- `createMediaElementSource` (Web Audio) en WebKitGTK deja el `<audio>` mudo
  (reproduce sin error, sin salida). Visualizador decorativo (sin Web Audio).
- Al medir por `Range`, un `<audio>` sin `crossorigin` no requiere CORS, pero se
  envía `Access-Control-Allow-Origin: *` igual (inofensivo, puerto+token local).
- Empaquetar AppImage: `PATH="$HOME/.local/bin:$PATH" cargo tauri build
  --bundles appimage`.

---

## Publicación en GitHub (2026-10-19)

- Repo: https://github.com/franciscomolinacl/Gadgets_Navidad_LM (rama `main`).
- Remoto SSH: `git@github.com:franciscomolinacl/Gadgets_Navidad_LM.git`
  (clave `~/.ssh/id_ed25519`, sin passphrase).
- Release `v2.0.0` publicada con AppImage (188,6 MiB) y `.deb` (30,4 MiB).
- `gh` 2.102.0 en `~/.local/bin` (no está en PATH).
- Con un PAT classic, `gh auth login --with-token` falla con
  `missing required scope 'read:org'`; usar `GH_TOKEN=$(cat archivo)` y
  ejecutar `gh` directamente (funciona con scope `repo`).
- Subir el tag `v2.0.0` ANTES del workflow para que no dispare CI.
- Workflow `.github/workflows/build.yml`: ubuntu-22.04, Rust stable,
  `cargo install tauri-cli`, `cargo tauri build --bundles appimage,deb`,
  `softprops/action-gh-release` (draft) en tags `v*`.
- Screenshots para el README no capturados: mover ventanas en la VM (escala 2)
  cuelga la app ("no responde"). Pendiente hacerlas fuera de la VM o manualmente.
