export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    console.log('[Training Waitlist] Request received');
    const formData = await request.formData();
    const email = formData.get('email');
    const trainingName = formData.get('training_name');
    const turnstileResponse = formData.get('cf-turnstile-response');

    console.log('[Training Waitlist] Email:', email);
    console.log('[Training Waitlist] Training:', trainingName);
    console.log('[Training Waitlist] Turnstile:', turnstileResponse ? 'present' : 'missing');

    // Validation
    if (!email || !trainingName || !turnstileResponse) {
      console.error('[Training Waitlist] Missing required data');
      return new Response(JSON.stringify({
        success: false,
        error: 'Brak wymaganych danych'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify Turnstile
    console.log('[Training Waitlist] Verifying Turnstile...');
    const turnstileVerify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET,
        response: turnstileResponse
      })
    });

    const turnstileResult = await turnstileVerify.json();
    console.log('[Training Waitlist] Turnstile result:', turnstileResult);

    if (!turnstileResult.success) {
      console.error('[Training Waitlist] Turnstile verification failed');
      return new Response(JSON.stringify({
        success: false,
        error: 'Weryfikacja Turnstile nie powiodła się'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Extract data from Cloudflare headers
    const cfData = {
      ip: request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown',
      country: request.headers.get('CF-IPCountry') || 'unknown',
      city: request.headers.get('CF-IPCity') || 'unknown',
      region: request.headers.get('CF-Region') || 'unknown',
      timezone: request.headers.get('CF-Timezone') || 'unknown',
      userAgent: request.headers.get('User-Agent') || 'unknown',
      language: request.headers.get('Accept-Language') || 'unknown',
      referer: request.headers.get('Referer') || 'direct'
    };

    console.log('[Training Waitlist] CF Data:', cfData);

    // Group name for waitlist
    const groupName = `Szkolenie: ${trainingName} - Lista oczekujących`;
    console.log('[Training Waitlist] Group name:', groupName);

    // Check if group exists
    console.log('[Training Waitlist] Checking if group exists...');
    const groupsResponse = await fetch(
      `https://connect.mailerlite.com/api/groups?filter[name]=${encodeURIComponent(groupName)}`,
      {
        headers: {
          'Authorization': `Bearer ${env.MAILERLITE_API_KEY}`,
          'Accept': 'application/json'
        }
      }
    );

    const groupsData = await groupsResponse.json();
    console.log('[Training Waitlist] Groups found:', groupsData.data?.length || 0);

    let groupId;

    // Create group if doesn't exist
    if (!groupsData.data || groupsData.data.length === 0) {
      console.log('[Training Waitlist] Creating new group...');
      const createGroupResponse = await fetch(
        'https://connect.mailerlite.com/api/groups',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.MAILERLITE_API_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            name: groupName
          })
        }
      );

      const newGroupData = await createGroupResponse.json();
      console.log('[Training Waitlist] New group response:', newGroupData);

      if (!createGroupResponse.ok) {
        console.error('[Training Waitlist] Failed to create group:', newGroupData);
        return new Response(JSON.stringify({
          success: false,
          error: 'Nie udało się utworzyć grupy'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      groupId = newGroupData.data.id;
      console.log('[Training Waitlist] Created new group with ID:', groupId);
    } else {
      groupId = groupsData.data[0].id;
      console.log('[Training Waitlist] Using existing group with ID:', groupId);
    }

    // Add/update subscriber with all collected data
    console.log('[Training Waitlist] Adding subscriber to group...');
    const subscriberResponse = await fetch(
      'https://connect.mailerlite.com/api/subscribers',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.MAILERLITE_API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          email: email,
          groups: [groupId],
          status: 'active', // Active status as requested
          ip_address: cfData.ip,
          fields: {
            source: 'training_waitlist',
            training_name: trainingName,
            signup_country: cfData.country,
            signup_city: cfData.city,
            signup_region: cfData.region,
            signup_timezone: cfData.timezone,
            signup_language: cfData.language.split(',')[0], // Get primary language
            signup_referer: cfData.referer,
            signup_user_agent: cfData.userAgent.substring(0, 255), // Limit to 255 chars
            signup_date: new Date().toISOString()
          },
          opted_in_at: new Date().toISOString(),
          optin_ip: cfData.ip
        })
      }
    );

    const subscriberData = await subscriberResponse.json();
    console.log('[Training Waitlist] Subscriber response status:', subscriberResponse.status);
    console.log('[Training Waitlist] Subscriber data:', subscriberData);

    if (!subscriberResponse.ok) {
      // Check if it's a duplicate error
      if (subscriberData.message && subscriberData.message.includes('already')) {
        return new Response(JSON.stringify({
          success: true,
          message: 'Jesteś już zapisany na listę oczekujących!'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      console.error('[Training Waitlist] MailerLite error:', subscriberData);
      return new Response(JSON.stringify({
        success: false,
        error: subscriberData.message || 'Błąd podczas zapisywania na listę'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('[Training Waitlist] ✅ Success! Subscriber added to waitlist');
    return new Response(JSON.stringify({
      success: true,
      message: `Zostałeś zapisany na listę oczekujących na szkolenie "${trainingName}". Powiadomimy Cię o nowym terminie!`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Training Waitlist] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Wystąpił błąd serwera'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}