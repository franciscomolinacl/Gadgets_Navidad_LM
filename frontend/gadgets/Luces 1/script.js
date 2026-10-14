let frame = 0;
const totalFrames = 7;
const frameWidth = 1553; // ancho real de un frame

setInterval(() => {
    const offset = -(frame * frameWidth);
    document.getElementById("lights").style.backgroundPosition = `${offset}px 0`;
    frame = (frame + 1) % totalFrames;
}, 60);
