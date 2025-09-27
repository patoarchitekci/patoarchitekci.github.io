export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    console.log('[API] Newsletter request received');
    const formData = await request.formData();
    const email = formData.get('email');
    const turnstileResponse = formData.get('cf-turnstile-response');

    console.log('[API] Email:', email);
    console.log('[API] Turnstile token:', turnstileResponse ? 'present' : 'missing');

    if (!email || !turnstileResponse) {
      console.error('[API] Missing required data');
      return new Response(JSON.stringify({
        success: false,
        error: 'Brak wymaganych danych'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('[API] Verifying Turnstile...');
    const turnstileVerify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET,
        response: turnstileResponse
      })
    });

    const turnstileResult = await turnstileVerify.json();
    console.log('[API] Turnstile result:', turnstileResult);

    if (!turnstileResult.success) {
      console.error('[API] Turnstile verification failed');
      return new Response(JSON.stringify({
        success: false,
        error: 'Weryfikacja Turnstile nie powiodła się'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('[API] Calling MailerLite API...');
    const mailerliteResponse = await fetch('https://connect.mailerlite.com/api/subscribers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.MAILERLITE_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        email: email,
        groups: [parseInt(env.MAILERLITE_GROUP_ID)],
        status: 'unconfirmed',
        fields: {
          source: 'newsletter_website'
        }
      })
    });

    const mailerliteData = await mailerliteResponse.json();
    console.log('[API] MailerLite response status:', mailerliteResponse.status);
    console.log('[API] MailerLite data:', mailerliteData);

    if (!mailerliteResponse.ok) {
      console.error('[API] MailerLite error:', mailerliteData);
      return new Response(JSON.stringify({
        success: false,
        error: mailerliteData.message || 'Błąd podczas zapisywania do newslettera'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('[API] ✅ Success! Subscriber added');
    return new Response(JSON.stringify({
      success: true,
      message: 'Sprawdź swoją skrzynkę pocztową i potwierdź subskrypcję!'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Newsletter error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Wystąpił błąd serwera'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}