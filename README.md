# Gadgets Navideños

Gadgets navideños para el escritorio de Linux, escritos en **Tauri 2** (Rust) con
frontend en **HTML/CSS/JS** plano. Es la reescritura de la app Electron
*DWALM Gadgets Xmas*, con el mismo look pero un consumo de RAM muchísimo menor.

Incluye **36 gadgets** (árboles, luces, nieve, cuenta atrás, relojes, clima,
reproductor de música, marco de fotos, notas, etc.) que se colocan libremente
sobre el escritorio, más un **panel de control** con bandeja del sistema.

## Características

- 36 gadgets independientes, cada uno en su propia ventana sin bordes y
  arrastrable.
- Panel de control con búsqueda, perfiles, favoritos y opciones por gadget.
- Icono en la bandeja del sistema para mostrar/ocultar gadgets y el panel.
- Posición, tamaño y configuración de cada gadget se guardan en
  `~/.config/gadgets-navidenos/`.
- Arranque automático al iniciar sesión (opcional).
- Audio (reproductor y villancico) servido por un HTTP local con soporte de
  `Range`, porque WebKitGTK no reproduce audio desde esquemas custom.

## Descarga e instalación

Desde la sección [**Releases**](../../releases) descarga el paquete según tu
distro:

### AppImage (portable, cualquier distro)

```bash
chmod +x "Gadgets Navideños_2.0.0_amd64.AppImage"
./"Gadgets Navideños_2.0.0_amd64.AppImage"
```

Trae GStreamer y las librerías multimedia incluidas, así que funciona sin
instalar nada.

### Debian / Ubuntu (.deb)

```bash
sudo apt install ./"Gadgets Navideños_2.0.0_amd64.deb"
```

Instala el binario y un lanzador en el menú. Requiere las dependencias del
sistema (WebKitGTK 4.1, GStreamer), que `apt` resuelve solo.

## Uso

- Haz clic en el icono de la bandeja para abrir el **panel de control**.
- En el panel puedes activar/desactivar cada gadget, elegir carpeta de música o
  imágenes, ajustar tamaño, efecto, etc.
- Arrastra cualquier gadget por su cuerpo para moverlo (los botones y campos
  siguen funcionando normalmente).
- La configuración se guarda automáticamente.

## Compilar desde el código

Requisitos (Linux):

- Rust estable y `cargo`
- Tauri CLI: `cargo install tauri-cli`
- Dependencias del sistema (Ubuntu/Debian):

```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev \
  patchelf libgstreamer1.0-dev libgstreamer-plugins-base1.0-dev
```

Compilar y ejecutar en desarrollo:

```bash
cd src-tauri
cargo tauri dev
```

Generar los paquetes:

```bash
cd src-tauri
cargo tauri build               # AppImage + deb
cargo tauri build --bundles appimage
cargo tauri build --bundles deb
```

> El AppImage se empaqueta con `bundleMediaFramework: true`, por lo que incluye
> las librerías de GStreamer (~190 MB). El `.deb` las declara como dependencias
> del sistema (~30 MB).

## Estructura

```
frontend/                 # HTML/CSS/JS, un directorio por gadget
  gadgets/<Nombre>/       # index.html, script.js, style.css, assets
src-tauri/
  src/main.rs             # ventanas, panel, bandeja, comandos
  src/config.rs           # persistencia en ~/.config/gadgets-navidenos
  src/media.rs            # servidor HTTP local para audio (Range)
  src/monitor.rs          # datos de CPU/RAM
  build.rs                # genera el inventario de gadgets y audio
  tauri.conf.json
LECCIONES.md              # notas de desarrollo (hallazgos y soluciones)
```

## Notas técnicas

- **Audio y WebKitGTK**: WebKitGTK no reproduce audio desde esquemas custom
  (`tauri://`) ni desde blob URLs (salta a ~50% del archivo al estimar
  duración). Por eso se sirve por un servidor HTTP en `127.0.0.1` con soporte
  de `Range`. Ver `LECCIONES.md`.
- **Visualizador** del reproductor: es decorativo. `createMediaElementSource`
  de Web Audio deja el elemento mudo en WebKitGTK.

## Licencia

[MIT](LICENSE) © 2026 Francisco Molina
