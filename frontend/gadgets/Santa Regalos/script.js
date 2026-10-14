function dropGift() {
	const gift = document.createElement("div");
	gift.classList.add("gift");
	const santa = document.querySelector(".santa-container").getBoundingClientRect();
	gift.style.left = santa.left + 70 + "px";
	gift.style.top = santa.top + 60 + "px";
	document.body.appendChild(gift);
	setTimeout(() => gift.remove(), 1500);
}

setInterval(dropGift, 1000);

document.querySelector(".santa-container").addEventListener("click", () => {
	const santa = document.querySelector(".santa-container");
	santa.style.animation = "none";
	void santa.offsetWidth;
	santa.style.animation = "";
});
