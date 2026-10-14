const { ipcRenderer } = require("electron");
const textArea = document.getElementById("note");
const MAX_HEIGHT = 350;

async function loadNote() {
    const text = await ipcRenderer.invoke("sticky-load");
    textArea.value = text || "";
    autoResize();
}

function saveNote() {
    ipcRenderer.send("sticky-save", textArea.value);
}

function autoResize() {
    textArea.style.height = "auto";
    const newHeight = textArea.scrollHeight;

    if (newHeight <= MAX_HEIGHT) {
        textArea.style.height = newHeight + "px";
        textArea.style.overflowY = "hidden";
    } else {
        textArea.style.height = MAX_HEIGHT + "px";
        textArea.style.overflowY = "auto";
    }
}

textArea.addEventListener("input", () => {
    autoResize();
    saveNote();
});

loadNote();
