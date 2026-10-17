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
