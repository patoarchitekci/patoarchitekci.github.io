// ===== LINKTREE ACCORDION =====
document.addEventListener("DOMContentLoaded", () => {
  const buttons = document.querySelectorAll(".linktree-accordion");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const content = button.nextElementSibling;
      const arrow = button.querySelector(".linktree-arrow");
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

// ===== LINKTREE NEWSLETTER =====
const linktreeForm = document.getElementById("linktree-emailForm");
const linktreeEmailInput = document.getElementById("linktree-emailInput");
const linktreeErrorMsg = document.getElementById("linktree-errorMsg");
const linktreeSuccessMsg = document.getElementById("linktree-successMsg");

if (linktreeForm) {
  let turnstileToken = null;
  let turnstileWidgetId = null;
  let pendingSubmit = false;

  window.onloadLinktreeTurnstileCallback = function () {
    if (window.turnstile) {
      turnstileWidgetId = window.turnstile.render("#linktree-turnstile-container", {
        sitekey: "0x4AAAAAAB3rTpbU6V5I845R",
        callback: function (token) {
          turnstileToken = token;
          if (pendingSubmit) {
            pendingSubmit = false;
            submitLinktreeForm();
          }
        },
        "error-callback": function () {
          pendingSubmit = false;
          linktreeErrorMsg.textContent = "Weryfikacja nie powiodła się. Spróbuj ponownie.";
          linktreeErrorMsg.classList.remove("hidden");
          const submitButton = linktreeForm.querySelector('button[type="submit"]');
          submitButton.textContent = "Zapisz się";
          submitButton.disabled = false;
        },
        size: "invisible",
        appearance: "interaction-only",
      });
    }
  };

  async function submitLinktreeForm() {
    const submitButton = linktreeForm.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.textContent = "Zapisywanie...";
    submitButton.disabled = true;

    try {
      const formData = new FormData(linktreeForm);
      formData.append("cf-turnstile-response", turnstileToken);

      const response = await fetch("/api/newsletter", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        linktreeErrorMsg.classList.add("hidden");
        linktreeSuccessMsg.classList.remove("hidden");
        linktreeEmailInput.value = "";

        if (window.turnstile && turnstileWidgetId !== null) {
          window.turnstile.reset(turnstileWidgetId);
        }
        turnstileToken = null;

        setTimeout(() => {
          linktreeSuccessMsg.classList.add("hidden");
        }, 15000);
      } else {
        linktreeErrorMsg.textContent = data.error || "Wystąpił błąd. Spróbuj ponownie.";
        linktreeErrorMsg.classList.remove("hidden");
        linktreeSuccessMsg.classList.add("hidden");
        if (window.turnstile && turnstileWidgetId !== null) {
          window.turnstile.reset(turnstileWidgetId);
        }
        turnstileToken = null;
      }
    } catch (error) {
      linktreeErrorMsg.textContent = "Wystąpił błąd połączenia. Spróbuj ponownie.";
      linktreeErrorMsg.classList.remove("hidden");
      linktreeSuccessMsg.classList.add("hidden");
    } finally {
      submitButton.textContent = originalText;
      submitButton.disabled = false;
    }
  }

  linktreeForm.addEventListener("submit", function (e) {
    e.preventDefault();

    const email = linktreeEmailInput.value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      linktreeErrorMsg.textContent = "Wprowadź poprawny adres e-mail.";
      linktreeErrorMsg.classList.remove("hidden");
      linktreeSuccessMsg.classList.add("hidden");
      return;
    }

    linktreeErrorMsg.classList.add("hidden");

    if (turnstileToken) {
      submitLinktreeForm();
    } else {
      const submitButton = linktreeForm.querySelector('button[type="submit"]');
      submitButton.textContent = "Weryfikacja...";
      submitButton.disabled = true;

      if (window.turnstile && turnstileWidgetId !== null) {
        pendingSubmit = true;
        window.turnstile.execute(turnstileWidgetId);
      } else {
        submitButton.textContent = "Zapisz się";
        submitButton.disabled = false;
      }
    }
  });
}
