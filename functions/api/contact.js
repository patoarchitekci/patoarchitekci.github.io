export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    console.log('[CONTACT] Request received');
    const formData = await request.formData();

    const name = formData.get('name');
    const email = formData.get('email');
    const phone = formData.get('phone') || '';
    const message = formData.get('message');
    const consent = formData.get('consent');
    const turnstileResponse = formData.get('cf-turnstile-response');

    console.log('[CONTACT] Data:', { name, email, phone: phone ? 'present' : 'empty', message: message?.length, consent, turnstile: turnstileResponse ? 'present' : 'missing' });

    // Validation
    if (!name || !email || !message || consent !== 'true' || !turnstileResponse) {
      console.error('[CONTACT] Missing required data');
      return new Response(JSON.stringify({
        success: false,
        error: 'Brak wymaganych danych'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Server-side validation
    const nameClean = name.trim();
    const emailClean = email.trim().toLowerCase();
    const phoneClean = phone.trim();
    const messageClean = message.trim();

    if (nameClean.length === 0 || nameClean.length > 100) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Nieprawidłowe imię'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailClean) || emailClean.length > 255) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Nieprawidłowy adres email'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (phoneClean.length > 0 && phoneClean.length < 9) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Nieprawidłowy numer telefonu'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (messageClean.length < 10 || messageClean.length > 2000) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Wiadomość musi mieć od 10 do 2000 znaków'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Verify Turnstile
    console.log('[CONTACT] Verifying Turnstile...');
    const turnstileVerify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET,
        response: turnstileResponse
      })
    });

    const turnstileResult = await turnstileVerify.json();
    console.log('[CONTACT] Turnstile result:', turnstileResult.success);

    if (!turnstileResult.success) {
      console.error('[CONTACT] Turnstile verification failed');
      return new Response(JSON.stringify({
        success: false,
        error: 'Weryfikacja antyspamowa nie powiodła się'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get Microsoft Graph API token
    console.log('[CONTACT] Getting MS Graph token...');
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${env.MS_TENANT_ID}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: env.MS_CLIENT_ID,
          client_secret: env.MS_CLIENT_SECRET,
          scope: 'https://graph.microsoft.com/.default',
          grant_type: 'client_credentials'
        })
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('[CONTACT] Failed to get token:', tokenData);
      return new Response(JSON.stringify({
        success: false,
        error: 'Błąd autoryzacji'
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const accessToken = tokenData.access_token;
    console.log('[CONTACT] Token obtained');

    const timestamp = new Date().toLocaleString('pl-PL', {
      timeZone: 'Europe/Warsaw',
      dateStyle: 'full',
      timeStyle: 'short'
    });

    // Get email addresses from env
    const salesEmail = env.CONTACT_SALES_EMAIL || 'sales@protopia.tech';
    const podcastEmail = env.CONTACT_PODCAST_EMAIL || 'podcast@patoarchitekci.io';

    console.log('[CONTACT] Sending to:', salesEmail, podcastEmail);

    // EMAIL 1: To us (sales@protopia.tech + podcast@patoarchitekci.io)
    console.log('[CONTACT] Sending email 1 (to us)...');
    const email1Body = {
      message: {
        subject: `[KONTAKT] Nowa wiadomość od ${nameClean}`,
        body: {
          contentType: 'HTML',
          content: `
<!DOCTYPE html>
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

  <div class="field"><strong>Imię:</strong> ${nameClean}</div>
  <div class="field"><strong>Email:</strong> <a href="mailto:${emailClean}">${emailClean}</a></div>
  ${phoneClean ? `<div class="field"><strong>Telefon:</strong> <a href="tel:${phoneClean}">${phoneClean}</a></div>` : ''}

  <h3>Wiadomość:</h3>
  <p>${messageClean.replace(/\n/g, '<br>')}</p>

  <hr>
  <p class="footer">Wysłano: ${timestamp}</p>
</body>
</html>
`
        },
        toRecipients: [
          { emailAddress: { address: salesEmail } },
          { emailAddress: { address: podcastEmail } }
        ]
      },
      saveToSentItems: true
    };

    const sendEmail1 = await fetch(
      `https://graph.microsoft.com/v1.0/users/${env.MS_USER_ID}/sendMail`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(email1Body)
      }
    );

    if (!sendEmail1.ok) {
      const error1 = await sendEmail1.text();
      console.error('[CONTACT] Failed to send email 1:', error1);
      return new Response(JSON.stringify({
        success: false,
        error: 'Błąd podczas wysyłania wiadomości'
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    console.log('[CONTACT] Email 1 sent successfully');

    // EMAIL 2: To client (with CC to us)
    console.log('[CONTACT] Sending email 2 (to client with CC)...');
    const email2Body = {
      message: {
        subject: 'Potwierdzenie - Otrzymaliśmy Twoją wiadomość',
        body: {
          contentType: 'HTML',
          content: `
<!DOCTYPE html>
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

  <p>Cześć <strong>${nameClean}</strong>,</p>

  <p>Otrzymaliśmy Twoją wiadomość i odpowiemy najszybciej jak to możliwe.</p>

  <h3>Kopia Twojej wiadomości:</h3>
  <div class="message-box">
    ${messageClean.replace(/\n/g, '<br>')}
  </div>

  <hr>

  <div class="footer">
    <p>Pozdrawiamy,<br>
    <strong>Zespół Patoarchitekci</strong></p>

    <p>🎙️ <a href="https://patoarchitekci.io">patoarchitekci.io</a></p>
  </div>
</body>
</html>
`
        },
        toRecipients: [
          { emailAddress: { address: emailClean } }
        ],
        ccRecipients: [
          { emailAddress: { address: salesEmail } },
          { emailAddress: { address: podcastEmail } }
        ]
      },
      saveToSentItems: true
    };

    const sendEmail2 = await fetch(
      `https://graph.microsoft.com/v1.0/users/${env.MS_USER_ID}/sendMail`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(email2Body)
      }
    );

    if (!sendEmail2.ok) {
      const error2 = await sendEmail2.text();
      console.error('[CONTACT] Failed to send email 2:', error2);
      // Email 1 was sent successfully, so we still return success but log the error
      console.warn('[CONTACT] Email 1 sent but email 2 failed - partial success');
    } else {
      console.log('[CONTACT] Email 2 sent successfully');
    }

    console.log('[CONTACT] ✅ Success! Both emails sent');
    return new Response(JSON.stringify({
      success: true,
      message: 'Wiadomość została wysłana! Kopia została wysłana na Twój email.'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[CONTACT] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Wystąpił błąd serwera'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
