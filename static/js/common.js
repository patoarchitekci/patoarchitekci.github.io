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

// <!-- ===== FORM SCRIPT ===== -->
const form = document.getElementById("emailForm");
const emailInput = document.getElementById("emailInput");
const errorMsg = document.getElementById("errorMsg");
const successMsg = document.getElementById("successMsg");

if (form) {
    form.addEventListener("submit", async function (e) {
        e.preventDefault();

        const email = emailInput.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {
            errorMsg.textContent = "Wprowadź poprawny adres e-mail.";
            errorMsg.classList.remove("hidden");
            successMsg.classList.add("hidden");
            emailInput.classList.add("border-red-500");
            return;
        }

        const submitButton = form.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;
        submitButton.textContent = "Zapisywanie...";
        submitButton.disabled = true;

        try {
            const formData = new FormData(form);
            const response = await fetch('/api/newsletter', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                errorMsg.classList.add("hidden");
                successMsg.classList.remove("hidden");
                emailInput.classList.remove("border-red-500");
                emailInput.value = "";

                if (window.turnstile) {
                    window.turnstile.reset();
                }

                setTimeout(() => {
                    successMsg.classList.add("hidden");
                }, 5000);
            } else {
                errorMsg.textContent = data.error || "Wystąpił błąd. Spróbuj ponownie.";
                errorMsg.classList.remove("hidden");
                successMsg.classList.add("hidden");
            }
        } catch (error) {
            console.error("Error:", error);
            errorMsg.textContent = "Wystąpił błąd połączenia. Spróbuj ponownie.";
            errorMsg.classList.remove("hidden");
            successMsg.classList.add("hidden");
        } finally {
            submitButton.textContent = originalText;
            submitButton.disabled = false;
        }
    });
}

