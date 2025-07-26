const toggleButton = document.getElementById("toggleButton");
const hiddenCards = document.querySelectorAll("#card-container .card:nth-child(n+4)");
let isExpanded = false;

toggleButton.addEventListener("click", () => {
    hiddenCards.forEach(card => {
        card.classList.toggle("hidden");
    });

    isExpanded = !isExpanded;
    toggleButton.textContent = isExpanded ? "Ukryj" : "Zobacz wszystkie szkolenia";
});


const trainingFAQButtons = document.querySelectorAll('.faq-button');

trainingFAQButtons.forEach(button => {
    button.addEventListener('click', () => {
        const content = button.nextElementSibling;

        const isOpen = content.style.maxHeight && content.style.maxHeight !== '0px';

        document.querySelectorAll('.faq-content').forEach(c => {
            c.style.maxHeight = null;
        });

        if (!isOpen) {
            content.style.maxHeight = content.scrollHeight + 'px';
        }
    });
});

const testimonials = [
    {
        text: "Było wszystko co najbardziej sobie cenię:<br> konkretnie, <br> kompletnie,<br> profesjonanie.",
        name: "Sebastian Romańczukiewicz",
        role: "Backend developer · symlink.studio",
        initials: "SR"
    },
    {
        text: "Szkolenie poprowadzone bardzo ciekawie, ze szczególnym uwzględnieniem rozwiązywania problemów, które pojawiały się przy okazji praktycznych zadań. Trener bardzo przyjazny, posiadający wiedzę i praktyczne doświadczenie z zakresu szkolenia.",
        name: "Jacek Bała",
        initials: "JB"
    },
    {
        text: "Chyba największą zaletą tego szkolenia, oprócz prowadzącego oczywiście, byli ludzie. W grupie były osoby z rożnym doświadczeniem w zakresie architektury. Od niskiego poziomu do wysokiego. Każdy miał też inny zakres wiedzy technologicznej. Praca w zespołach była ciekawym wyzwaniem. Po każdej porcji wiedzy teoretycznej podanej w bardzo przystępny sposób przez Łukasza, następował etap pracy w zespołach. Warsztaty gdzie rozwiązywaliśmy konkretne zadania technologiczne były bardzo ciekawym doświadczeniem. Bardzo dobrze zainwestowany czas oraz pieniądze.",
        name: "Tomek",
        initials: "T"
    },
    {
        text: "Było wszystko co najbardziej sobie cenię:<br> konkretnie, <br> kompletnie,<br> profesjonanie.",
        name: "Sebastian Romańczukiewicz",
        role: "Backend developer · symlink.studio",
        initials: "SR"
    },
    {
        text: "Szkolenie poprowadzone bardzo ciekawie, ze szczególnym uwzględnieniem rozwiązywania problemów, które pojawiały się przy okazji praktycznych zadań. Trener bardzo przyjazny, posiadający wiedzę i praktyczne doświadczenie z zakresu szkolenia.",
        name: "Jacek Bała",
        initials: "JB"
    },
    {
        text: "Chyba największą zaletą tego szkolenia, oprócz prowadzącego oczywiście, byli ludzie. W grupie były osoby z rożnym doświadczeniem w zakresie architektury. Od niskiego poziomu do wysokiego. Każdy miał też inny zakres wiedzy technologicznej. Praca w zespołach była ciekawym wyzwaniem. Po każdej porcji wiedzy teoretycznej podanej w bardzo przystępny sposób przez Łukasza, następował etap pracy w zespołach. Warsztaty gdzie rozwiązywaliśmy konkretne zadania technologiczne były bardzo ciekawym doświadczeniem. Bardzo dobrze zainwestowany czas oraz pieniądze.",
        name: "Tomek",
        initials: "T"
    }
];

const swiperWrapper = document.querySelector(".swiper-wrapper");
const popup = document.getElementById("testimonial-popup");
const popupText = document.getElementById("popup-text");
const popupName = document.getElementById("popup-name");
const popupRole = document.getElementById("popup-role");
const popupInitials = document.getElementById("popup-initials");
const popupCard = document.getElementById("popup-card");
const maxChars = window.innerWidth < 768 ? 200 : 257;

testimonials.forEach(obj => {
    const fullText = obj.text;
    const needsMore = fullText.length > maxChars;
    const displayText = needsMore
        ? fullText.slice(0, maxChars) + ` <span class="text-yellowdark font-semibold cursor-pointer" data-full='${fullText.replaceAll(`'`, `&apos;`)}' data-name='${obj.name}' data-role='${obj.role || ""}' data-initials='${obj.initials}'>...czytaj więcej</span>`
        : fullText;

    const slide = document.createElement("div");
    slide.className = "swiper-slide max-h-[420px] xl:min-w-[383px] h-full max-md:max-w-[272px] max-md:mx-auto md:min-h-[380px] bg-white border-[3px] border-yellowdark rounded-[21px] md:rounded-[30px] p-[14px_17px_12px_17px] md:p-[20px_30px_18px_25px] flex flex-col justify-between";
    slide.innerHTML = `
            <div class="flex flex-col">
           <img class="md:w-[144px] w-[102px] h-[14px] md:h-5 mb-4 md:mb-[25px] mx-auto" src="assets/images/svg/stars-img.svg" alt="testimonial-icon">
           <p class="xl:text-xl max-md:text-[14.14px] max-md:!leading-[115%] leading-125 lg:leading-110 xl:!leading-125 text-dark-black">${displayText}</p>
         </div>
         <div class="flex gap-[14px] mt-5">
           <div class="md:size-[52px] size-9 rounded-full border text-yellowdark border-yellowdark text-white font-medium md:text-xl flex items-center justify-center">${obj.initials}</div>
           <div>
             <div class="text-dark-black max-md:text-[11px] pt-[5px]">${obj.name}</div>
             ${obj.role ? `<div class="text-xs text-yellowdark max-md:text-[10px]">${obj.role}</div>` : ""}
           </div>
         </div>
         `;
    swiperWrapper.appendChild(slide);
});

// Popup logic
swiperWrapper.addEventListener("click", e => {
    const target = e.target;
    if (target.matches("[data-full]")) {
        popupText.innerHTML = target.getAttribute("data-full").replaceAll(`&apos;`, `'`);
        popupName.textContent = target.getAttribute("data-name");
        popupRole.textContent = target.getAttribute("data-role");
        popupInitials.textContent = target.getAttribute("data-initials");
        popup.classList.remove("hidden");
        document.body.classList.add("overflow-hidden"); // ✅ lock scroll
    }
});

popup.addEventListener("click", e => {
    if (!popupCard.contains(e.target)) {
        popup.classList.add("hidden");
        document.body.classList.remove("overflow-hidden"); // ✅ unlock scroll
    }
});

let currentDirection = getDirection();

const swiperInstance = new Swiper(".swiper", {
  allowTouchMove: false,
  loop: true,
  centeredSlides: false,
  spaceBetween: 24,
  direction: currentDirection,
  navigation: {
    nextEl: ".swiper-button-next",
    prevEl: ".swiper-button-prev",
  },
  breakpoints: {
    0: {
      slidesPerView: 2,
    },
    768: {
      slidesPerView: 2,
    },
    1140: {
      slidesPerView: 3.001,
    },
  },
});

function getDirection() {
    return window.innerWidth < 768 ? "vertical" : "horizontal";
}

// Watch for resize and change direction if needed
window.addEventListener("resize", () => {
    const newDirection = getDirection();
    if (newDirection !== currentDirection) {
        swiperInstance.changeDirection(newDirection);
        currentDirection = newDirection;
    }
});
