
// FAQ toggle functionality
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



