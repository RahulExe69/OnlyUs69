import https from 'https';

const SUPABASE_PROJECT_ID = process.env.SUPABASE_PROJECT_ID || 'vrstmtjfqlbfyxtsothf';
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

const sql = `
-- Drop restrictive authenticated-only policies and create permissive public / anon policies
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.messages;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.games;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.app_config;
DROP POLICY IF EXISTS "Allow all messages for all" ON public.messages;
DROP POLICY IF EXISTS "Allow all users for all" ON public.users;
DROP POLICY IF EXISTS "Allow all games for all" ON public.games;
DROP POLICY IF EXISTS "Allow all app_config for all" ON public.app_config;

CREATE POLICY "Allow all messages for all" ON public.messages FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow all users for all" ON public.users FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow all games for all" ON public.games FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow all app_config for all" ON public.app_config FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

-- Also ensure Replica Identity Full for realtime updates
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.users REPLICA IDENTITY FULL;
ALTER TABLE public.games REPLICA IDENTITY FULL;
ALTER TABLE public.app_config REPLICA IDENTITY FULL;
`;

const postData = JSON.stringify({ query: sql });

const options = {
  hostname: 'api.supabase.com',
  port: 443,
  path: `/v1/projects/${SUPABASE_PROJECT_ID}/database/query`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log("RLS Fix Result:", body);
  });
});

req.write(postData);
req.end();
