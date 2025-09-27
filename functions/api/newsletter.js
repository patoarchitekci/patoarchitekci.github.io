export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const formData = await request.formData();
    const email = formData.get('email');
    const turnstileResponse = formData.get('cf-turnstile-response');

    if (!email || !turnstileResponse) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Brak wymaganych danych'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const turnstileVerify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET,
        response: turnstileResponse
      })
    });

    const turnstileResult = await turnstileVerify.json();

    if (!turnstileResult.success) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Weryfikacja Turnstile nie powiodła się'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const mailerliteResponse = await fetch('https://connect.mailerlite.com/api/subscribers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.MAILERLITE_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        email: email,
        groups: [env.MAILERLITE_GROUP_ID],
        status: 'unconfirmed',
        fields: {
          source: 'newsletter_website'
        }
      })
    });

    const mailerliteData = await mailerliteResponse.json();

    if (!mailerliteResponse.ok) {
      console.error('MailerLite error:', mailerliteData);
      return new Response(JSON.stringify({
        success: false,
        error: mailerliteData.message || 'Błąd podczas zapisywania do newslettera'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

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