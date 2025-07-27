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

// Popup logic dla testimonials
const swiperWrapper = document.querySelector(".swiper-wrapper");
const popup = document.getElementById("testimonial-popup");
const popupText = document.getElementById("popup-text");
const popupName = document.getElementById("popup-name");
const popupRole = document.getElementById("popup-role");
const popupInitials = document.getElementById("popup-initials");
const popupCard = document.getElementById("popup-card");

swiperWrapper.addEventListener("click", e => {
    const target = e.target;
    if (target.matches("[data-full]")) {
        popupText.innerHTML = target.getAttribute("data-full");
        popupName.textContent = target.getAttribute("data-name");
        popupRole.textContent = target.getAttribute("data-role");
        popupInitials.textContent = target.getAttribute("data-initials");
        popup.classList.remove("hidden");
        document.body.classList.add("overflow-hidden");
    }
});

popup.addEventListener("click", e => {
    if (!popupCard.contains(e.target)) {
        popup.classList.add("hidden");
        document.body.classList.remove("overflow-hidden");
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
