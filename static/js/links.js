// ===== LINKS ACCORDION =====
document.addEventListener("DOMContentLoaded", () => {
  const buttons = document.querySelectorAll(".links-accordion");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const content = button.nextElementSibling;
      const arrow = button.querySelector(".links-arrow");
      const isOpen = content.style.maxHeight && content.style.maxHeight !== "0px";

      if (isOpen) {
        content.style.maxHeight = null;
        arrow.classList.remove("rotate-90");
      } else {
        content.style.maxHeight = content.scrollHeight + "px";
        arrow.classList.add("rotate-90");
      }
    });
  });
});

// ===== LINKS NEWSLETTER =====
const linksForm = document.getElementById("links-emailForm");
const linksEmailInput = document.getElementById("links-emailInput");
const linksErrorMsg = document.getElementById("links-errorMsg");
const linksSuccessMsg = document.getElementById("links-successMsg");

if (linksForm) {
  let turnstileToken = null;
  let turnstileWidgetId = null;
  let pendingSubmit = false;

  window.onloadLinksTurnstileCallback = function () {
    if (window.turnstile) {
      turnstileWidgetId = window.turnstile.render("#links-turnstile-container", {
        sitekey: "0x4AAAAAAB3rTpbU6V5I845R",
        callback: function (token) {
          turnstileToken = token;
          if (pendingSubmit) {
            pendingSubmit = false;
            submitLinksForm();
          }
        },
        "error-callback": function () {
          pendingSubmit = false;
          linksErrorMsg.textContent = "Weryfikacja nie powiodła się. Spróbuj ponownie.";
          linksErrorMsg.classList.remove("hidden");
          const submitButton = linksForm.querySelector('button[type="submit"]');
          submitButton.textContent = "Zapisz się";
          submitButton.disabled = false;
        },
        size: "invisible",
        appearance: "interaction-only",
      });
    }
  };

  async function submitLinksForm() {
    const submitButton = linksForm.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.textContent = "Zapisywanie...";
    submitButton.disabled = true;

    try {
      const formData = new FormData(linksForm);
      formData.append("cf-turnstile-response", turnstileToken);

      const response = await fetch("/api/newsletter", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        linksErrorMsg.classList.add("hidden");
        linksSuccessMsg.classList.remove("hidden");
        linksEmailInput.value = "";

        if (window.turnstile && turnstileWidgetId !== null) {
          window.turnstile.reset(turnstileWidgetId);
        }
        turnstileToken = null;

        setTimeout(() => {
          linksSuccessMsg.classList.add("hidden");
        }, 15000);
      } else {
        linksErrorMsg.textContent = data.error || "Wystąpił błąd. Spróbuj ponownie.";
        linksErrorMsg.classList.remove("hidden");
        linksSuccessMsg.classList.add("hidden");
        if (window.turnstile && turnstileWidgetId !== null) {
          window.turnstile.reset(turnstileWidgetId);
        }
        turnstileToken = null;
      }
    } catch (error) {
      linksErrorMsg.textContent = "Wystąpił błąd połączenia. Spróbuj ponownie.";
      linksErrorMsg.classList.remove("hidden");
      linksSuccessMsg.classList.add("hidden");
      if (window.turnstile && turnstileWidgetId !== null) {
        window.turnstile.reset(turnstileWidgetId);
      }
      turnstileToken = null;
    } finally {
      submitButton.textContent = originalText;
      submitButton.disabled = false;
    }
  }

  linksForm.addEventListener("submit", function (e) {
    e.preventDefault();

    const email = linksEmailInput.value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      linksErrorMsg.textContent = "Wprowadź poprawny adres e-mail.";
      linksErrorMsg.classList.remove("hidden");
      linksSuccessMsg.classList.add("hidden");
      return;
    }

    linksErrorMsg.classList.add("hidden");

    if (turnstileToken) {
      submitLinksForm();
    } else {
      const submitButton = linksForm.querySelector('button[type="submit"]');
      submitButton.textContent = "Weryfikacja...";
      submitButton.disabled = true;

      if (window.turnstile && turnstileWidgetId !== null) {
        pendingSubmit = true;
        window.turnstile.execute(turnstileWidgetId);
      } else {
        submitButton.disabled = false;
        linksErrorMsg.textContent = "Nie udało się załadować zabezpieczenia. Odśwież stronę i spróbuj ponownie.";
        linksErrorMsg.classList.remove("hidden");
        linksSuccessMsg.classList.add("hidden");
      }
    }
  });
}
