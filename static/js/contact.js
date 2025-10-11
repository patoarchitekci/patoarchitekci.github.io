// CONTACT FORM SCRIPT

// Turnstile initialization - MUST BE OUTSIDE DOMContentLoaded!
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
                    submitContactForm();
                    pendingSubmit = false;
                }
            },
            'error-callback': function() {
                console.error('[CONTACT TURNSTILE] ❌ Błąd weryfikacji');
                pendingSubmit = false;
            },
            size: 'invisible',
            appearance: 'interaction-only'
        });
        console.log('[CONTACT TURNSTILE] Widget zainicjowany, ID:', contactTurnstileWidgetId);
    } else {
        console.error('[CONTACT TURNSTILE] ❌ Biblioteka nie załadowana');
    }
};

// Turnstile will call onloadContactTurnstileCallback when loaded (via ?onload= parameter)

// Form handling - INSIDE DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector("form");
    const formwrapper = document.getElementById("formwrapper");
    const successMsg = document.getElementById("successMsg");
    const consentCheckbox = document.getElementById("consent-toggle");
    const errorConsent = document.getElementById("error-consent");

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

    // Form submit handler
    form.addEventListener("submit", (e) => {
        e.preventDefault();

        console.log('[CONTACT FORM] Submit triggered');
        console.log('[CONTACT FORM] Dane formularza:', {
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            message: document.getElementById('message').value,
            consent: consentCheckbox.checked
        });

        let isValid = true;
        const validationErrors = [];

        // Validate all fields
        fields.forEach(({ id, errorId, validate, optional }) => {
            const input = document.getElementById(id);
            const error = document.getElementById(errorId);
            const value = input.value;

            if (!optional && !validate(value)) {
                error.classList.remove("hidden");
                isValid = false;
                validationErrors.push(`${id}: niepoprawna wartość "${value}"`);
            } else if (optional && value.trim().length > 0 && !validate(value)) {
                error.classList.remove("hidden");
                isValid = false;
                validationErrors.push(`${id}: niepoprawna wartość "${value}"`);
            } else {
                error.classList.add("hidden");
            }
        });

        // Validate consent
        if (!consentCheckbox.checked) {
            errorConsent.classList.remove("hidden");
            isValid = false;
            validationErrors.push('consent: nie zaznaczona zgoda RODO');
        } else {
            errorConsent.classList.add("hidden");
        }

        if (!isValid) {
            console.log('[CONTACT FORM] ❌ Walidacja nie przeszła:');
            validationErrors.forEach(err => console.log('  - ' + err));
            return;
        }

        console.log('[CONTACT FORM] ✅ Walidacja przeszła pomyślnie');

        // Check if Turnstile token is ready
        if (contactTurnstileToken) {
            console.log('[CONTACT FORM] Token gotowy, wysyłanie...');
            submitContactForm();
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

// Submit function - OUTSIDE DOMContentLoaded so Turnstile callback can access it
async function submitContactForm() {
    console.log('[CONTACT FORM] Wysyłanie formularza...');

    const formData = new FormData();
    formData.append('name', document.getElementById('name').value);
    formData.append('email', document.getElementById('email').value);
    formData.append('phone', document.getElementById('phone').value);
    formData.append('message', document.getElementById('message').value);
    formData.append('consent', document.getElementById('consent-toggle').checked ? 'true' : 'false');
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
            const successMsg = document.getElementById("successMsg");
            const formwrapper = document.getElementById("formwrapper");
            const form = document.querySelector("form");

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
