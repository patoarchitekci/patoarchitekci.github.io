const SITE = 'patoarchitekci';
const FORM = 'contact';
const POLICY_URL = 'https://patoarchitekci.io/polityka-prywatnosci/';
const RELAY_TIMEOUT_MS = 10000;

const json = (body, status) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' }
});

const escapeHtml = (value) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

// Base64 of UTF-8 bytes (btoa alone breaks on Polish characters)
const toBase64 = (text) => {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
};

// Critical Pushover alert; never throws, never blocks the response
async function sendAlert(env, stage, detail, submissionId) {
  if (!env.PUSHOVER_TOKEN || !env.PUSHOVER_USER) {
    console.error('[CONTACT] Pushover not configured, alert dropped:', stage, detail);
    return;
  }
  try {
    const response = await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        token: env.PUSHOVER_TOKEN,
        user: env.PUSHOVER_USER,
        priority: '2',
        retry: '60',
        expire: '3600',
        title: `[${SITE}] Formularz kontaktowy: błąd (${stage})`,
        message: `site: ${SITE}\nform: ${FORM}\nsubmission_id: ${submissionId || '-'}\nstage: ${stage}\n${String(detail).slice(0, 800)}`
      })
    });
    if (!response.ok) {
      console.error('[CONTACT] Pushover failed:', response.status, await response.text());
    }
  } catch (error) {
    console.error('[CONTACT] Pushover error:', error);
  }
}

function renderTeamEmail({ name, email, phone, message, timestamp }) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    h2 { color: #FE4404; }
    .field { margin: 15px 0; }
    .field strong { color: #666; }
    hr { border: none; border-top: 1px solid #ddd; margin: 20px 0; }
    .footer { color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <h2>🔔 Nowa wiadomość z formularza kontaktowego</h2>

  <div class="field"><strong>Imię:</strong> ${escapeHtml(name)}</div>
  <div class="field"><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></div>
  ${phone ? `<div class="field"><strong>Telefon:</strong> <a href="tel:${escapeHtml(phone)}">${escapeHtml(phone)}</a></div>` : ''}

  <h3>Wiadomość:</h3>
  <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>

  <hr>
  <p class="footer">Wysłano: ${timestamp}</p>
</body>
</html>
`;
  const text = [
    'Nowa wiadomość z formularza kontaktowego',
    '',
    `Imię: ${name}`,
    `Email: ${email}`,
    phone ? `Telefon: ${phone}` : null,
    '',
    'Wiadomość:',
    message,
    '',
    `Wysłano: ${timestamp}`
  ].filter((line) => line !== null).join('\n');

  return {
    subject: `[KONTAKT] Nowa wiadomość od ${name}`,
    html_b64: toBase64(html),
    text_b64: toBase64(text)
  };
}

function renderSenderCopy({ name, message }) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    h2 { color: #FE4404; }
    .message-box { background: #f5f5f5; padding: 15px; border-left: 4px solid #FE4404; margin: 20px 0; }
    hr { border: none; border-top: 1px solid #ddd; margin: 20px 0; }
    .footer { color: #666; }
    a { color: #FE4404; text-decoration: none; }
  </style>
</head>
<body>
  <h2>Dziękujemy za kontakt! 🎉</h2>

  <p>Cześć <strong>${escapeHtml(name)}</strong>,</p>

  <p>Otrzymaliśmy Twoją wiadomość i odpowiemy najszybciej jak to możliwe.</p>

  <h3>Kopia Twojej wiadomości:</h3>
  <div class="message-box">
    ${escapeHtml(message).replace(/\n/g, '<br>')}
  </div>

  <hr>

  <div class="footer">
    <p>Pozdrawiamy,<br>
    <strong>Zespół Patoarchitekci</strong></p>

    <p>🎙️ <a href="https://patoarchitekci.io">patoarchitekci.io</a></p>
  </div>
</body>
</html>
`;
  const text = [
    'Dziękujemy za kontakt!',
    '',
    `Cześć ${name},`,
    '',
    'Otrzymaliśmy Twoją wiadomość i odpowiemy najszybciej jak to możliwe.',
    '',
    'Kopia Twojej wiadomości:',
    message,
    '',
    'Pozdrawiamy,',
    'Zespół Patoarchitekci',
    'https://patoarchitekci.io'
  ].join('\n');

  return {
    subject: 'Potwierdzenie - Otrzymaliśmy Twoją wiadomość',
    html_b64: toBase64(html),
    text_b64: toBase64(text)
  };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const submissionId = crypto.randomUUID();
  const alert = (stage, detail) => context.waitUntil(sendAlert(env, stage, detail, submissionId));

  try {
    console.log('[CONTACT] Request received', submissionId);
    const formData = await request.formData();

    const name = formData.get('name');
    const email = formData.get('email');
    const phone = formData.get('phone') || '';
    const message = formData.get('message');
    const consent = formData.get('consent');
    const turnstileResponse = formData.get('cf-turnstile-response');

    // Validation
    if (!name || !email || !message || consent !== 'true' || !turnstileResponse) {
      return json({ success: false, error: 'Brak wymaganych danych' }, 400);
    }

    const nameClean = name.trim();
    const emailClean = email.trim().toLowerCase();
    const phoneClean = phone.trim();
    const messageClean = message.trim();

    if (nameClean.length === 0 || nameClean.length > 100) {
      return json({ success: false, error: 'Nieprawidłowe imię' }, 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailClean) || emailClean.length > 255) {
      return json({ success: false, error: 'Nieprawidłowy adres email' }, 400);
    }

    if (phoneClean.length > 0 && phoneClean.length < 9) {
      return json({ success: false, error: 'Nieprawidłowy numer telefonu' }, 400);
    }

    if (messageClean.length < 10 || messageClean.length > 2000) {
      return json({ success: false, error: 'Wiadomość musi mieć od 10 do 2000 znaków' }, 400);
    }

    // Verify Turnstile
    let turnstileResult;
    try {
      const turnstileVerify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: env.TURNSTILE_SECRET,
          response: turnstileResponse
        })
      });
      if (!turnstileVerify.ok) {
        throw new Error(`siteverify HTTP ${turnstileVerify.status}`);
      }
      turnstileResult = await turnstileVerify.json();
    } catch (error) {
      console.error('[CONTACT] Turnstile siteverify error:', error);
      alert('turnstile', error.message);
      return json({ success: false, error: 'Błąd weryfikacji antyspamowej, spróbuj ponownie' }, 502);
    }

    if (!turnstileResult.success) {
      console.error('[CONTACT] Turnstile verification failed', turnstileResult['error-codes']);
      return json({ success: false, error: 'Weryfikacja antyspamowa nie powiodła się' }, 403);
    }

    if (!env.CONTACT_RELAY_URL || !env.CONTACT_RELAY_API_KEY) {
      alert('config', 'Missing CONTACT_RELAY_URL or CONTACT_RELAY_API_KEY');
      return json({ success: false, error: 'Błąd podczas wysyłania wiadomości' }, 500);
    }

    const timestamp = new Date().toLocaleString('pl-PL', {
      timeZone: 'Europe/Warsaw',
      dateStyle: 'full',
      timeStyle: 'short'
    });

    const fields = { name: nameClean, email: emailClean, phone: phoneClean, message: messageClean, timestamp };

    const payload = {
      version: 1,
      site: SITE,
      form: FORM,
      submission_id: submissionId,
      submitted_at: new Date().toISOString(),
      locale: 'pl',
      sender: { name: nameClean, email: emailClean, phone: phoneClean || null },
      emails: {
        team: renderTeamEmail(fields),
        sender_copy: renderSenderCopy(fields)
      },
      raw: {
        message: messageClean,
        consent: { privacy: true, policy_url: POLICY_URL }
      },
      context: {
        page_url: request.headers.get('Referer') || null,
        referer: request.headers.get('Referer') || null,
        ip: request.headers.get('CF-Connecting-IP') || null,
        country: request.headers.get('CF-IPCountry') || null,
        user_agent: (request.headers.get('User-Agent') || '').slice(0, 255) || null
      },
      site_fields: {}
    };

    let relayResponse;
    try {
      relayResponse = await fetch(env.CONTACT_RELAY_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.CONTACT_RELAY_API_KEY}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': submissionId
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(RELAY_TIMEOUT_MS)
      });
    } catch (error) {
      console.error('[CONTACT] Relay network error:', error);
      alert('relay-network', `${error.name}: ${error.message}`);
      return json({ success: false, error: 'Błąd podczas wysyłania wiadomości' }, 502);
    }

    const relayText = await relayResponse.text();

    if (relayResponse.status !== 200 && relayResponse.status !== 202) {
      console.error('[CONTACT] Relay rejected:', relayResponse.status, relayText);
      alert('relay-status', `HTTP ${relayResponse.status}: ${relayText.slice(0, 500)}`);
      return json({ success: false, error: 'Błąd podczas wysyłania wiadomości' }, 502);
    }

    console.log('[CONTACT] Relay accepted:', relayResponse.status, relayText);
    return json({
      success: true,
      message: 'Wiadomość została wysłana! Kopia została wysłana na Twój email.'
    }, 200);

  } catch (error) {
    console.error('[CONTACT] Error:', error);
    alert('exception', error.stack || error.message);
    return json({ success: false, error: 'Wystąpił błąd serwera' }, 500);
  }
}
