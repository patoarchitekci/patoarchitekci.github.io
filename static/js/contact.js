// FORM SCRIPT
const form = document.querySelector("form");

const fields = [
  {
    id: "phone",
    errorId: "error-phone",
    validate: (val) => val.trim().length >= 10,
  },
  {
    id: "email",
    errorId: "error-email",
    validate: (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
  },
  {
    id: "name",
    errorId: "error-name",
    validate: (val) => val.trim().length > 0,
  },
  {
    id: "message",
    errorId: "error-message",
    validate: (val) => val.trim().length > 0,
  },
];

let isConsentChecked = false;

const consentBtn = document.getElementById("consent-toggle");
const errorConsent = document.getElementById("error-consent");
const consentLabel = document.getElementById("consent-label");
const successMsg = document.getElementById("successMsg");

consentBtn.addEventListener("click", () => {
  isConsentChecked = !isConsentChecked;

  consentBtn.classList.toggle("text-orange", isConsentChecked);
  consentBtn.classList.toggle("text-white", !isConsentChecked);

  if (isConsentChecked) {
    errorConsent.classList.add("hidden");
  }
});

fields.forEach(({ id, errorId, validate }) => {
  const input = document.getElementById(id);
  const error = document.getElementById(errorId);

  input.addEventListener("input", () => {
    if (validate(input.value)) {
      error.classList.add("hidden");
    } else {
      error.classList.remove("hidden");
    }
  });
});

form.addEventListener("submit", (e) => {
  e.preventDefault();

  let isValid = true;

  const formData = {
    phone: document.getElementById("phone").value,
    email: document.getElementById("email").value,
    name: document.getElementById("name").value,
    message: document.getElementById("message").value,
    consent: isConsentChecked,
  };

  console.log("Form values before validation:", formData);

  fields.forEach(({ id, errorId, validate }) => {
    const input = document.getElementById(id);
    const error = document.getElementById(errorId);

    if (!validate(input.value)) {
      error.classList.remove("hidden");
      isValid = false;
    } else {
      error.classList.add("hidden");
    }
  });

  if (!isConsentChecked) {
    errorConsent.classList.remove("hidden");
    isValid = false;
  } else {
    errorConsent.classList.add("hidden");
  }

  if (isValid) {
    successMsg.classList.remove("hidden");
    formwrapper.classList.add("hidden");

    setTimeout(() => {
      successMsg.classList.add("hidden");
      formwrapper.classList.remove("hidden");
    }, 4000);

    form.reset();
    isConsentChecked = false;

    consentBtn.classList.remove("text-orange");
    consentBtn.classList.add("text-white");
    errorConsent.classList.add("hidden");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }
});

// NAV TOGGLE SCRIPT
document.addEventListener("DOMContentLoaded", () => {
  const menuButton = document.getElementById("menu-button");
  const menuList = document.getElementById("menu-list");
  const iconHamburger = document.getElementById("icon-hamburger");
  const iconClose = document.getElementById("icon-close");

  const closeMenu = () => {
    menuList.classList.add("translate-x-full");
    iconHamburger.classList.remove("opacity-0", "pointer-events-none");
    iconClose.classList.add("opacity-0", "pointer-events-none");
    document.body.classList.remove("overflow-hidden");
  };

  menuButton.addEventListener("click", () => {
    const isOpen = !menuList.classList.contains("translate-x-full");
    if (isOpen) {
      closeMenu();
    } else {
      menuList.classList.remove("translate-x-full");
      iconHamburger.classList.add("opacity-0", "pointer-events-none");
      iconClose.classList.remove("opacity-0", "pointer-events-none");
      document.body.classList.add("overflow-hidden");
    }
  });

  const navLinks = menuList.querySelectorAll("a");
  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      if (window.innerWidth < 1024) {
        closeMenu();
      }
    });
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth >= 1024) {
      document.body.classList.remove("overflow-hidden");
      menuList.classList.add("translate-x-full");
      iconHamburger.classList.remove("opacity-0", "pointer-events-none");
      iconClose.classList.add("opacity-0", "pointer-events-none");
    }
  });
});

// BACK TO TOP
const backToTopBtn = document.getElementById("backToTopBtn");
window.addEventListener("scroll", () => {
  if (window.scrollY > 200) {
    backToTopBtn.classList.remove("hidden");
  } else {
    backToTopBtn.classList.add("hidden");
  }
});
backToTopBtn.addEventListener("click", () => {
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
});
