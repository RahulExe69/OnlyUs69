// Edge Function: send-push
// Native Deno Zero-Dependency FCM v1 Push Delivery for OnlyUs
// Wakes up Android devices instantly with High-Priority Data Payloads

interface PushRequest {
  type?: string;
  table?: string;
  record?: any;
  message?: any;
  senderRole?: string;
  senderName?: string;
  avatarUrl?: string;
  text?: string;
  targetRole?: string;
}

function base64UrlEncode(str: string): string {
  const b64 = btoa(str);
  return b64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlEncodeBuffer(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getGoogleOAuth2Token(clientEmail: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const cleanPem = privateKeyPem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');

  const binaryDer = Uint8Array.from(atob(cleanPem), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claim))}`;
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsigned)
  );

  const jwt = `${unsigned}.${base64UrlEncodeBuffer(signature)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OAuth token failed: ${res.status} - ${errText}`);
  }

  const tokenData = await res.json();
  return tokenData.access_token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const body: PushRequest = await req.json().catch(() => ({}));
    const record = body.record || body.message || body;

    const senderRole = record.sender_role || body.senderRole || 'partner';
    const targetRole = body.targetRole || (senderRole === 'owner' ? 'partner' : 'owner');

    let textPreview = record.text || body.text || '';
    if (!textPreview) {
      if (record.attachment_url) {
        textPreview = '📎 Media attachment';
      } else {
        textPreview = 'Sent you a message';
      }
    }

    const senderName = body.senderName || (senderRole === 'owner' ? 'Rahul' : 'Nusrat');
    const avatarUrl = body.avatarUrl || '';
    const messageId = record.id ? String(record.id) : String(Date.now());
    const notificationId = String(Math.floor(Date.now() % 100000));

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://vrstmtjfqlbfyxtsothf.supabase.co';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    // Fetch registered tokens directly via PostgREST
    const tokensRes = await fetch(
      `${supabaseUrl}/rest/v1/fcm_tokens?role=eq.${targetRole}&select=id,token,platform`,
      {
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
      }
    );

    if (!tokensRes.ok) {
      const err = await tokensRes.text();
      return new Response(JSON.stringify({ error: `Failed to fetch tokens: ${err}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const tokens: Array<{ id: string; token: string; platform: string }> = await tokensRes.json();

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ status: 'no_tokens', targetRole }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const projectId = Deno.env.get('FIREBASE_PROJECT_ID') || 'onlyus69';
    const clientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL') || '';
    const privateKey = (Deno.env.get('FIREBASE_PRIVATE_KEY') || '').replace(/\\n/g, '\n');

    if (!clientEmail || !privateKey) {
      throw new Error('Firebase credentials not configured in environment');
    }

    const accessToken = await getGoogleOAuth2Token(clientEmail, privateKey);

    const results = [];
    const tokensToDelete: string[] = [];

    for (const t of tokens) {
      const fcmPayload = {
        message: {
          token: t.token,
          // High-priority DATA message: Android wakes up app even in killed/doze state!
          data: {
            title: senderName,
            body: textPreview,
            avatarUrl: avatarUrl,
            replyRole: targetRole,
            notificationId: notificationId,
            messageId: messageId,
          },
          android: {
            priority: 'high',
            ttl: '86400s',
          },
        },
      };

      const fcmRes = await fetch(
        `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(fcmPayload),
        }
      );

      const fcmResult = await fcmRes.json();
      results.push({ token: t.token, status: fcmRes.status, response: fcmResult });

      if (
        fcmRes.status === 404 ||
        (fcmResult.error &&
          (fcmResult.error.status === 'NOT_FOUND' ||
            fcmResult.error.message?.includes('UNREGISTERED')))
      ) {
        tokensToDelete.push(t.token);
      }
    }

    if (tokensToDelete.length > 0) {
      const deleteFilter = `in.(${tokensToDelete.map(tok => `"${tok}"`).join(',')})`;
      await fetch(`${supabaseUrl}/rest/v1/fcm_tokens?token=${deleteFilter}`, {
        method: 'DELETE',
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        sentCount: results.length,
        results,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (err: any) {
    console.error('Push notification error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});
