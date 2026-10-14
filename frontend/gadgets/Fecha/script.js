function actualizarFecha() {
    const fechaElem = document.getElementById("fecha");

    const ahora = new Date();

    const opciones = {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    };

    let fechaTexto = ahora.toLocaleDateString("es-ES", opciones);
    fechaTexto = fechaTexto.charAt(0).toUpperCase() + fechaTexto.slice(1);

    fechaElem.textContent = fechaTexto;
}

actualizarFecha();

setInterval(actualizarFecha, 60000);
