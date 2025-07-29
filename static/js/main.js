
// <!-- ===== FAQ SCRIPT ===== -->
const faqButtons = document.querySelectorAll(".faq-button");
faqButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const content = button.nextElementSibling;
    let faqBottom = content.querySelector(".faq-bottom");

    if (!faqBottom) {
      content.classList.add("faq-bottom");
      faqBottom = content;
    }

    const isOpen = content.style.maxHeight && content.style.maxHeight !== "0px";

    document.querySelectorAll(".faq-content").forEach((c) => {
      c.style.maxHeight = null;
      if (c.classList.contains("faq-bottom")) {
        c.style.marginBottom = "0px";
      }
      const bottomElement = c.querySelector(".faq-bottom");
      if (bottomElement) {
        bottomElement.style.marginBottom = "0px";
      }
    });

    if (!isOpen) {
      content.style.maxHeight = content.scrollHeight + "px";

      const allFaqContainers = document.querySelectorAll(
        ".faq-container > div"
      );
      const currentFaqContainer = button.closest(".faq-container > div");
      const isLastFaq =
        currentFaqContainer === allFaqContainers[allFaqContainers.length - 1];

      if (faqBottom && !isLastFaq) {
        faqBottom.style.marginBottom = "45px";
      } else if (faqBottom && isLastFaq) {
        faqBottom.style.marginBottom = "0px";
      }
    }
  });
});

const style = document.createElement("style");
style.textContent = `.faq-container > div:last-child { margin-bottom: 0 !important;}`;
document.head.appendChild(style);
