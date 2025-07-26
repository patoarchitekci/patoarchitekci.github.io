//  SKILL SCRIPT
const skills = [
    "UMIEJĘTNOŚĆ",
    "UMIEJĘTNOŚĆ",
    "UMIEJĘTNOŚĆ",
    "UMIEJĘTNOŚĆ",
    "UMIEJĘTNOŚĆ",
    "UMIEJĘTNOŚĆ",
];

const skillsList = document.getElementById("skills-list");

function renderSkills(isMobile) {
    skillsList.innerHTML = "";

    const visibleSkills = isMobile ? skills.slice(0, -1) : skills;

    visibleSkills.forEach((skill) => {
        const wrapper = document.createElement("div");
        wrapper.className = "flex items-center gap-2.5 sm:gap-7 md:gap-12 !ml-0";

        const img = document.createElement("img");
        img.src = "/assets/images/svg/red-check-icon.svg";
        img.alt = "red-check-icon";
        img.className = "size-5 sm:size-7 lg:size-[35px]";

        const p = document.createElement("p");
        p.textContent = skill.toLowerCase();
        p.className =
            "text-base md:text-lg lg:text-2xl text-dark-black !leading-none font-medium uppercase";

        wrapper.appendChild(img);
        wrapper.appendChild(p);
        skillsList.appendChild(wrapper);
    });
}
renderSkills(window.innerWidth < 768);
window.addEventListener("resize", () => {
    const isMobile = window.innerWidth < 768;
    renderSkills(isMobile);
});

// FAQ SCRIPT
const faqData = [{
        question: "Pytanie numer 1: Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore?",
        answer: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    },
    {
        question: "Pytanie numer 1: Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore?",
        answer: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    },
    {
        question: "Pytanie numer 1: Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore?",
        answer: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    },
    {
        question: "Pytanie numer 1: Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore?",
        answer: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    },
];
const faqContainer = document.getElementById("faq-container");

faqData.forEach((item) => {
    const faqItem = document.createElement("div");
    faqItem.className = "flex flex-col space-y-[5px] md:space-y-4 group";

    faqItem.innerHTML = `
    <div class="flex items-start md:gap-[37px] gap-5 cursor-pointer faq-toggle">
      <div class="md:size-[45px] size-[35px] min-w-[35px] md:min-w-[45px] bg-red text-white rounded-md flex items-center justify-center text-2xl font-bold transition-all overflow-hidden">
        <div class="icon transition-transform duration-500 relative h-5 w-5 md:h-[25px] md:w-[25px]">
          <span class="bg-white absolute top-0 left-[50%] translate-x-[-50%] h-5 w-[3px] md:h-[25px] md:w-[5px]"></span>
          <span class="bg-white absolute left-0 top-[50%] translate-y-[-50%] w-5 h-[3px] md:w-[25px] md:h-[5px]"></span>
        </div>
      </div>
      <p class="font-bold text-xs md:text-lg lg:text-xl text-dark-black leading-110 md:leading-100 transition-all duration-300 question uppercase">${item.question}</p>
    </div>
    <div class="faq-answer md:pl-[82px] pl-[55px] max-w-[799px] leading-100 text-xs md:text-lg lg:text-xl font-medium text-dark-black overflow-hidden transition-all duration-500 ease-in-out" style="height: 0;">
      <div class="content py-2">${item.answer}</div>
    </div>
  `;

    faqContainer.appendChild(faqItem);
});
const toggles = document.querySelectorAll(".faq-toggle");
toggles.forEach((toggle) => {
    toggle.addEventListener("click", () => {
        const currentAnswer = toggle.nextElementSibling;
        const content = currentAnswer.querySelector(".content");
        const currentIcon = toggle.querySelector(".icon");
        const currentText = toggle.querySelector(".question");

        document.querySelectorAll(".faq-answer").forEach((answer) => {
            if (answer !== currentAnswer) {
                answer.style.height = "0px";
                const icon = answer.previousElementSibling.querySelector(".icon");
                const text = answer.previousElementSibling.querySelector(".question");
                icon.classList.remove("rotate-[134deg]");
                text.classList.remove("text-red");
            }
        });

        const isOpen =
            currentAnswer.style.height !== "0px" && currentAnswer.style.height !== "";

        if (isOpen) {
            currentAnswer.style.height = "0px";
            currentIcon.classList.remove("rotate-[134deg]");
            currentText.classList.remove("text-red");
        } else {
            const contentHeight = content.offsetHeight;
            currentAnswer.style.height = contentHeight + "px";
            currentIcon.classList.add("rotate-[134deg]");
            currentText.classList.add("text-red");
        }
    });
});

// <!-- ===== MODULES SCRIPT ===== -->
const modules = Array.from({
    length: 6
}, (_, i) => i + 1);
const moduleClass =
    "flex flex-col min-[840px]:flex-row max-lg:py-2.5 gap-[15px] min-[840px]:gap-2 !mt-2.5 lg:!mt-10";
const container = document.getElementById("module-container");

const moduleHTML = modules
    .map(
        (num) => `
      <div class="${moduleClass}">
        <p class="text-orange font-extrabold text-xl md:text-2xl leading-100 w-[136px] uppercase">Moduł ${num}</p>
        <p class="text-dark-black text-sm sm:text-base md:text-xl font-medium  max-lg:!leading-100 lg:!leading-none max-w-[648px]">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
        </p>
      </div>
    `
    )
    .join("");

container.innerHTML = moduleHTML;


// <!-- ===== DLACZEGO SCRIPT ===== -->
const dlaczegoData = [{
        description: "<span class='uppercase'>Lorem ipsum.</span> Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ",
    },
    {
        description: "<span class='uppercase'>Lorem ipsum.</span> Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ",
    },
    {
        description: "<span class='uppercase'>Lorem ipsum.</span> Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ",
    },
    {
        description: "<span class='uppercase'>Lorem ipsum.</span> Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ",
    },
];

const dlaczegoContainer = document.getElementById("dlaczego-container");

dlaczegoData.forEach((data, index) => {
    const card = document.createElement("div");
    card.className =
        "flex items-start lg:items-center lg:gap-[41px] md:gap-5 gap-[15px]";
    card.innerHTML = `
            <button>
                <img src="/assets/images/svg/right-arrow-red.svg" alt="Thumbnail" class="lg:size-[50px] max-lg:min-w-[35px] size-[35px]">
            </button>
            <p class="font-medium max-md:text-sm !leading-110 md:!leading-125 max-w-[701px] text-white">${data.description}</p>
        `;
    dlaczegoContainer.appendChild(card);
});