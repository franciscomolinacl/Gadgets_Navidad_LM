const frames = ["frames/frame1.png", "frames/frame2.png"];
let index = 0;

setInterval(() => {
	index = (index + 1) % frames.length;
	document.getElementById("santa").src = frames[index];
}, 300);
