// CONTACT FORM SCRIPT
document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector("form");
    const formwrapper = document.getElementById("formwrapper");
    const successMsg = document.getElementById("successMsg");

    // Turnstile
    let contactTurnstileToken = null;
    let contactTurnstileWidgetId = null;
    let pendingSubmit = false;

    // Initialize Turnstile when script loads
    window.onloadContactTurnstileCallback = function() {
        console.log('[CONTACT TURNSTILE] Inicjalizacja widgetu...');
        if (window.turnstile) {
            contactTurnstileWidgetId = window.turnstile.render('#contact-turnstile-container', {
                sitekey: '0x4AAAAAAAz0vPdHzF5s7fgU',
                callback: function(token) {
                    console.log('[CONTACT TURNSTILE] ✅ Token otrzymany');
                    contactTurnstileToken = token;

                    // If form was submitted while waiting for token
                    if (pendingSubmit) {
                        console.log('[CONTACT TURNSTILE] Formularz czekał na token, wysyłanie...');
                        submitForm();
                        pendingSubmit = false;
                    }
                },
                'error-callback': function() {
                    console.error('[CONTACT TURNSTILE] ❌ Błąd weryfikacji');
                },
                theme: 'light',
                size: 'invisible'
            });
            console.log('[CONTACT TURNSTILE] Widget zainicjowany, ID:', contactTurnstileWidgetId);
        } else {
            console.error('[CONTACT TURNSTILE] ❌ Biblioteka nie załadowana');
        }
    };

    // Call callback if Turnstile already loaded
    if (window.turnstile) {
        window.onloadContactTurnstileCallback();
    }

    // Validation fields
    const fields = [
        {
            id: "name",
            errorId: "error-name",
            validate: (val) => val.trim().length > 0,
        },
        {
            id: "email",
            errorId: "error-email",
            validate: (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
        },
        {
            id: "phone",
            errorId: "error-phone",
            validate: (val) => val.trim().length === 0 || val.trim().length >= 9,
            optional: true
        },
        {
            id: "message",
            errorId: "error-message",
            validate: (val) => val.trim().length >= 10,
        },
    ];

    const consentCheckbox = document.getElementById("consent-toggle");
    const errorConsent = document.getElementById("error-consent");

    // Real-time validation
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

    consentCheckbox.addEventListener("change", () => {
        if (consentCheckbox.checked) {
            errorConsent.classList.add("hidden");
        }
    });

    // Submit function
    async function submitForm() {
        console.log('[CONTACT FORM] Wysyłanie formularza...');

        const formData = new FormData();
        formData.append('name', document.getElementById('name').value);
        formData.append('email', document.getElementById('email').value);
        formData.append('phone', document.getElementById('phone').value);
        formData.append('message', document.getElementById('message').value);
        formData.append('consent', consentCheckbox.checked ? 'true' : 'false');
        formData.append('cf-turnstile-response', contactTurnstileToken);

        console.log('[CONTACT FORM] Token Turnstile:', contactTurnstileToken ? 'obecny' : 'brak');

        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            console.log('[CONTACT FORM] Odpowiedź:', data);

            if (response.ok && data.success) {
                // Success - show modal
                console.log('[CONTACT FORM] ✅ Sukces!');
                successMsg.classList.remove("hidden");
                formwrapper.classList.add("hidden");

                // Reset form
                form.reset();

                // Reset Turnstile
                if (window.turnstile && contactTurnstileWidgetId !== null) {
                    window.turnstile.reset(contactTurnstileWidgetId);
                }
                contactTurnstileToken = null;

                // Scroll to top
                window.scrollTo({ top: 0, behavior: "smooth" });

                // Hide modal after 5 seconds
                setTimeout(() => {
                    successMsg.classList.add("hidden");
                    formwrapper.classList.remove("hidden");
                }, 5000);

            } else {
                // Error from API
                console.error('[CONTACT FORM] ❌ Błąd:', data.error);
                alert(data.error || 'Wystąpił błąd podczas wysyłania wiadomości');

                // Reset Turnstile
                if (window.turnstile && contactTurnstileWidgetId !== null) {
                    window.turnstile.reset(contactTurnstileWidgetId);
                }
                contactTurnstileToken = null;
            }

        } catch (error) {
            console.error('[CONTACT FORM] ❌ Błąd sieci:', error);
            alert('Wystąpił błąd podczas wysyłania wiadomości. Spróbuj ponownie.');

            // Reset Turnstile
            if (window.turnstile && contactTurnstileWidgetId !== null) {
                window.turnstile.reset(contactTurnstileWidgetId);
            }
            contactTurnstileToken = null;
        }
    }

    // Form submit handler
    form.addEventListener("submit", (e) => {
        e.preventDefault();

        console.log('[CONTACT FORM] Submit triggered');

        let isValid = true;

        // Validate all fields
        fields.forEach(({ id, errorId, validate, optional }) => {
            const input = document.getElementById(id);
            const error = document.getElementById(errorId);

            if (!optional && !validate(input.value)) {
                error.classList.remove("hidden");
                isValid = false;
            } else if (optional && input.value.trim().length > 0 && !validate(input.value)) {
                error.classList.remove("hidden");
                isValid = false;
            } else {
                error.classList.add("hidden");
            }
        });

        // Validate consent
        if (!consentCheckbox.checked) {
            errorConsent.classList.remove("hidden");
            isValid = false;
        } else {
            errorConsent.classList.add("hidden");
        }

        if (!isValid) {
            console.log('[CONTACT FORM] ❌ Walidacja nie przeszła');
            return;
        }

        // Check if Turnstile token is ready
        if (contactTurnstileToken) {
            console.log('[CONTACT FORM] Token gotowy, wysyłanie...');
            submitForm();
        } else {
            // Execute Turnstile challenge
            console.log('[CONTACT FORM] Brak tokena, uruchamiam Turnstile...');
            pendingSubmit = true;

            if (window.turnstile && contactTurnstileWidgetId !== null) {
                console.log('[CONTACT TURNSTILE] Wykonywanie challenge...');
                window.turnstile.execute(contactTurnstileWidgetId);
            } else {
                console.error('[CONTACT TURNSTILE] ❌ Widget nie zainicjowany!');
                alert('Weryfikacja antyspamowa nie jest gotowa. Odśwież stronę i spróbuj ponownie.');
            }
        }
    });
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
