
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

// Training Waitlist Modal functionality
document.addEventListener('DOMContentLoaded', function() {
    console.log('[WAITLIST] Inicjalizacja modalu...');

    const modal = document.getElementById('training-waitlist-modal');
    const modalBackdrop = document.getElementById('modal-backdrop');
    const modalClose = document.getElementById('modal-close');
    const form = document.getElementById('waitlistForm');
    const emailInput = document.getElementById('waitlistEmailInput');
    const errorMsg = document.getElementById('waitlistErrorMsg');
    const successMsg = document.getElementById('waitlistSuccessMsg');

    // Tryb waitlisty: termin przeszły / tylko lista oczekujących / wyprzedane (quantity 0)
    const rootEl = document.querySelector('[data-training-past]');
    const isTrainingPast = rootEl?.dataset.trainingPast === 'true';
    const isSoldOut = rootEl?.dataset.soldOut === 'true';
    console.log('[WAITLIST] Przeszłe:', isTrainingPast, '| Wyprzedane:', isSoldOut);

    // Zamienia wszystkie CTA zakupu (linki [data-buy-cta] oraz przyciski "Zapisz się")
    // na wyzwalacze listy oczekujących. Idempotentne — można wywołać ponownie, gdy
    // szkolenie wyprzeda się "na żywo" (z licznika biletów).
    window.enterWaitlistMode = function () {
        if (!modal) return;
        if (rootEl) rootEl.dataset.soldOut = 'true';
        document.querySelectorAll('[data-buy-cta], button').forEach(function (el) {
            const isAnchor = el.hasAttribute('data-buy-cta');
            if (!isAnchor && el.textContent.trim() !== 'Zapisz się') return;
            if (isAnchor) { el.setAttribute('href', '#'); el.removeAttribute('target'); }
            el.textContent = 'Rezerwuj miejsce';
            el.dataset.waitlistButton = 'true';
        });
    };

    // Obsługa kliknięć w wyzwalacze waitlisty (podpięta zawsze, gdy modal istnieje).
    if (modal) {
        document.addEventListener('click', function (e) {
            const trigger = e.target.closest && e.target.closest('[data-waitlist-button="true"]');
            if (trigger) {
                e.preventDefault();
                openModal();
            }
        });
    }

    if ((isTrainingPast || isSoldOut) && modal) {
        window.enterWaitlistMode();
    }

    // Turnstile dla waitlist
    let waitlistTurnstileToken = null;
    let waitlistTurnstileWidgetId = null;
    let waitlistPendingSubmit = false;

    // Initialize Turnstile for waitlist when modal opens
    function initWaitlistTurnstile() {
        if (window.turnstile && !waitlistTurnstileWidgetId) {
            console.log('[WAITLIST TURNSTILE] Inicjalizacja widgetu...');
            waitlistTurnstileWidgetId = window.turnstile.render('#waitlist-turnstile-container', {
                sitekey: '0x4AAAAAAB3rTpbU6V5I845R',
                callback: function(token) {
                    console.log('[WAITLIST TURNSTILE] ✅ Token otrzymany');
                    waitlistTurnstileToken = token;

                    if (waitlistPendingSubmit) {
                        console.log('[WAITLIST TURNSTILE] Formularz czekał na token, wysyłanie...');
                        waitlistPendingSubmit = false;
                        submitWaitlistForm();
                    }
                },
                'error-callback': function() {
                    console.error('[WAITLIST TURNSTILE] ❌ Błąd weryfikacji');
                    waitlistPendingSubmit = false;
                    errorMsg.textContent = "Weryfikacja nie powiodła się. Spróbuj ponownie.";
                    errorMsg.classList.remove("hidden");
                    const submitButton = form.querySelector('button[type="submit"]');
                    submitButton.textContent = "Rezerwuj";
                    submitButton.disabled = false;
                },
                size: 'invisible',
                appearance: 'interaction-only'
            });
            console.log('[WAITLIST TURNSTILE] Widget zainicjowany, ID:', waitlistTurnstileWidgetId);
        }
    }

    // Funkcja otwierająca modal
    function openModal() {
        if (modal) {
            console.log('[WAITLIST] Otwieranie modalu...');
            modal.classList.remove('hidden');
            document.body.classList.add('overflow-hidden');

            // Initialize Turnstile when modal opens
            if (!waitlistTurnstileWidgetId) {
                setTimeout(initWaitlistTurnstile, 100);
            }
        }
    }

    // Funkcja zamykająca modal
    function closeModal() {
        if (modal) {
            console.log('[WAITLIST] Zamykanie modalu...');
            modal.classList.add('hidden');
            document.body.classList.remove('overflow-hidden');

            // Reset form
            if (form) form.reset();
            if (errorMsg) errorMsg.classList.add('hidden');
            if (successMsg) successMsg.classList.add('hidden');
        }
    }

    // Submit waitlist form
    async function submitWaitlistForm() {
        console.log('[WAITLIST] Wysyłanie formularza...');
        const submitButton = form.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;
        submitButton.textContent = "Zapisywanie...";
        submitButton.disabled = true;

        try {
            const formData = new FormData(form);
            formData.append('cf-turnstile-response', waitlistTurnstileToken);
            console.log('[WAITLIST] Email:', formData.get('email'));
            console.log('[WAITLIST] Training:', formData.get('training_name'));
            console.log('[WAITLIST] Token Turnstile:', waitlistTurnstileToken ? 'obecny' : 'brak');

            const response = await fetch('/api/training-waitlist', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            console.log('[WAITLIST API] Odpowiedź:', data);

            if (data.success) {
                console.log('[WAITLIST] ✅ Sukces! Użytkownik zapisany na listę oczekujących');
                errorMsg.classList.add("hidden");
                successMsg.classList.remove("hidden");
                emailInput.value = "";

                // Reset Turnstile
                if (window.turnstile && waitlistTurnstileWidgetId !== null) {
                    window.turnstile.reset(waitlistTurnstileWidgetId);
                }
                waitlistTurnstileToken = null;

                // Automatyczne zamknięcie modalu po 5 sekundach
                setTimeout(() => {
                    closeModal();
                }, 5000);
            } else {
                console.error('[WAITLIST] ❌ Błąd:', data.error);
                errorMsg.textContent = data.error || "Wystąpił błąd. Spróbuj ponownie.";
                errorMsg.classList.remove("hidden");
                successMsg.classList.add("hidden");

                // Reset Turnstile
                if (window.turnstile && waitlistTurnstileWidgetId !== null) {
                    window.turnstile.reset(waitlistTurnstileWidgetId);
                }
                waitlistTurnstileToken = null;
            }
        } catch (error) {
            console.error("[WAITLIST] ❌ Błąd połączenia:", error);
            errorMsg.textContent = "Wystąpił błąd połączenia. Spróbuj ponownie.";
            errorMsg.classList.remove("hidden");
            successMsg.classList.add("hidden");
        } finally {
            submitButton.textContent = originalText;
            submitButton.disabled = false;
        }
    }

    // Obsługa zamykania modalu
    if (modalClose) {
        modalClose.addEventListener('click', closeModal);
    }

    if (modalBackdrop) {
        modalBackdrop.addEventListener('click', closeModal);
    }

    // Obsługa formularza
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            console.log('[WAITLIST FORM] Submit kliknięty');

            const email = emailInput.value.trim();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!emailRegex.test(email)) {
                console.log('[WAITLIST FORM] ❌ Email niepoprawny:', email);
                errorMsg.textContent = "Wprowadź poprawny adres e-mail.";
                errorMsg.classList.remove("hidden");
                successMsg.classList.add("hidden");
                return;
            }

            console.log('[WAITLIST FORM] ✅ Email poprawny:', email);
            errorMsg.classList.add("hidden");

            // Jeśli już mamy token, wyślij od razu
            if (waitlistTurnstileToken) {
                console.log('[WAITLIST FORM] Token już istnieje, wysyłanie...');
                submitWaitlistForm();
            } else {
                // Uruchom Turnstile challenge
                console.log('[WAITLIST FORM] Brak tokena, uruchamiam Turnstile...');
                const submitButton = form.querySelector('button[type="submit"]');
                submitButton.textContent = "Weryfikacja...";
                submitButton.disabled = true;

                if (window.turnstile && waitlistTurnstileWidgetId !== null) {
                    console.log('[WAITLIST TURNSTILE] Wykonywanie challenge...');
                    waitlistPendingSubmit = true;
                    window.turnstile.execute(waitlistTurnstileWidgetId);
                } else {
                    console.error('[WAITLIST TURNSTILE] ❌ Widget nie zainicjowany!');
                    submitButton.textContent = "Rezerwuj";
                    submitButton.disabled = false;
                }
            }
        });
    }
});