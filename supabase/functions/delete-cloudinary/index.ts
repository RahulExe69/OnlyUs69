// Edge Function: delete-cloudinary
// Permanent deletion across multiple Cloudinary accounts for OnlyUs
// Handles photos, videos, voice notes, and raw media

interface DeleteRequest {
  action?: 'delete' | 'verify';
  public_ids?: string[];
  public_id?: string;
  cloud_name?: string;
  // Direct test credentials if verifying an account
  apiKey?: string;
  apiSecret?: string;
}

interface CloudinaryAccountAuth {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  label?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    let payload: DeleteRequest = {};
    if (req.method === 'POST') {
      try {
        payload = await req.json();
      } catch {
        payload = {};
      }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://vrstmtjfqlbfyxtsothf.supabase.co';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';

    // If client requested verification of a specific credential pair
    if (payload.action === 'verify') {
      const cloudName = (payload.cloud_name || '').trim();
      const apiKey = (payload.apiKey || '').trim();
      const apiSecret = (payload.apiSecret || '').trim();

      if (!cloudName || !apiKey || !apiSecret) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing cloud_name, apiKey, or apiSecret' }),
          { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }

      const basicAuth = btoa(`${apiKey}:${apiSecret}`);
      const pingRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/ping`, {
        method: 'GET',
        headers: {
          Authorization: `Basic ${basicAuth}`,
        },
      });

      if (pingRes.ok) {
        return new Response(
          JSON.stringify({ success: true, message: 'Cloudinary API credentials verified successfully!' }),
          { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      } else {
        const errText = await pingRes.text();
        return new Response(
          JSON.stringify({ success: false, error: `Invalid Cloudinary credentials: ${errText}` }),
          { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Normal deletion flow
    let targetIds: string[] = [];
    if (Array.isArray(payload.public_ids)) {
      targetIds = payload.public_ids.filter(Boolean).map(id => id.trim());
    } else if (payload.public_id && typeof payload.public_id === 'string') {
      targetIds = [payload.public_id.trim()];
    }

    if (targetIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No public_ids specified to delete', deleted: [] }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Collect Cloudinary accounts with API credentials
    const accounts: CloudinaryAccountAuth[] = [];

    // A: Check environment variables
    const envAccountsJson = Deno.env.get('CLOUDINARY_ACCOUNTS_JSON');
    if (envAccountsJson) {
      try {
        const parsed = JSON.parse(envAccountsJson);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item.cloudName && item.apiKey && item.apiSecret) {
              accounts.push({
                cloudName: item.cloudName.trim(),
                apiKey: item.apiKey.trim(),
                apiSecret: item.apiSecret.trim(),
                label: item.label,
              });
            }
          }
        }
      } catch (e) {
        console.warn('Failed parsing CLOUDINARY_ACCOUNTS_JSON:', e);
      }
    }

    const singleCloud = Deno.env.get('CLOUDINARY_CLOUD_NAME');
    const singleKey = Deno.env.get('CLOUDINARY_API_KEY');
    const singleSecret = Deno.env.get('CLOUDINARY_API_SECRET');
    if (singleCloud && singleKey && singleSecret) {
      accounts.push({
        cloudName: singleCloud.trim(),
        apiKey: singleKey.trim(),
        apiSecret: singleSecret.trim(),
        label: 'Default Env Secret',
      });
    }

    // B: Fetch accounts stored in database `app_config.cloudinary_config`
    try {
      const configRes = await fetch(`${supabaseUrl}/rest/v1/app_config?id=eq.main&select=cloudinary_config`, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      });

      if (configRes.ok) {
        const rows = await configRes.json();
        const confArray = rows?.[0]?.cloudinary_config;
        if (Array.isArray(confArray)) {
          for (const acc of confArray) {
            if (acc.cloudName && acc.apiKey && acc.apiSecret) {
              // Avoid duplicate cloudName + apiKey
              const exists = accounts.some(
                a => a.cloudName.toLowerCase() === acc.cloudName.trim().toLowerCase() && a.apiKey === acc.apiKey.trim()
              );
              if (!exists) {
                accounts.push({
                  cloudName: acc.cloudName.trim(),
                  apiKey: acc.apiKey.trim(),
                  apiSecret: acc.apiSecret.trim(),
                  label: acc.label || acc.cloudName,
                });
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('Could not query app_config for cloudinary accounts:', err);
    }

    if (accounts.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          warning: 'No Cloudinary accounts with API Key & Secret configured.',
          instructions: 'Add API Key and API Secret in Cloud Storage Settings or set CLOUDINARY_API_SECRET in Edge Function secrets.',
          public_ids: targetIds,
        }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // Filter accounts if caller targeted a specific cloud_name
    const targetAccounts = payload.cloud_name
      ? accounts.filter(a => a.cloudName.toLowerCase() === payload.cloud_name?.toLowerCase())
      : accounts;

    const finalAccounts = targetAccounts.length > 0 ? targetAccounts : accounts;

    // Step 2: Attempt deletion across accounts and resource types (image, video, raw)
    const resourceTypes = ['image', 'video', 'raw'];
    const deletedMap: Record<string, string> = {};
    const remainingIds = new Set(targetIds);

    for (const account of finalAccounts) {
      if (remainingIds.size === 0) break;

      const basicAuth = btoa(`${account.apiKey}:${account.apiSecret}`);

      for (const resType of resourceTypes) {
        if (remainingIds.size === 0) break;

        const idsToTry = Array.from(remainingIds);
        // Batch in groups of 50
        for (let i = 0; i < idsToTry.length; i += 50) {
          const chunk = idsToTry.slice(i, i + 50);
          const queryParams = chunk.map(id => `public_ids[]=${encodeURIComponent(id)}`).join('&');
          const deleteUrl = `https://api.cloudinary.com/v1_1/${account.cloudName}/resources/${resType}/upload?${queryParams}`;

          try {
            const delRes = await fetch(deleteUrl, {
              method: 'DELETE',
              headers: {
                Authorization: `Basic ${basicAuth}`,
              },
            });

            if (delRes.ok) {
              const resData = await delRes.json();
              if (resData?.deleted) {
                for (const [id, status] of Object.entries(resData.deleted)) {
                  if (status === 'deleted') {
                    deletedMap[id] = `deleted (${resType} on ${account.cloudName})`;
                    remainingIds.delete(id);
                  }
                }
              }
            }
          } catch (e) {
            console.warn(`Error deleting ${resType} on ${account.cloudName}:`, e);
          }
        }
      }
    }

    const successfullyDeleted = Object.keys(deletedMap);
    const notFound = Array.from(remainingIds);

    return new Response(
      JSON.stringify({
        success: true,
        deletedCount: successfullyDeleted.length,
        deleted: successfullyDeleted,
        notFound,
        details: deletedMap,
        accountsChecked: finalAccounts.map(a => a.cloudName),
      }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Cloudinary deletion error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
});
