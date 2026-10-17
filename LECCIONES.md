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

