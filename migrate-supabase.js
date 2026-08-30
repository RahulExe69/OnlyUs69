import https from 'https';

const SUPABASE_PROJECT_ID = process.env.SUPABASE_PROJECT_ID || 'vrstmtjfqlbfyxtsothf';
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!SUPABASE_ACCESS_TOKEN) {
  console.error("ERROR: SUPABASE_ACCESS_TOKEN environment variable is missing.");
  process.exit(1);
}

const sql = `
-- 1. Ensure app_config has partner_passcode column
ALTER TABLE IF EXISTS app_config 
ADD COLUMN IF NOT EXISTS partner_passcode text DEFAULT '123456';

-- 2. Ensure initial row exists
INSERT INTO app_config (id, owner_email, partner_allowed_emails, partner_passcode)
VALUES ('main', 'bodruddoja4@gmail.com', ARRAY[]::text[], '123456')
ON CONFLICT (id) DO UPDATE 
SET partner_passcode = COALESCE(app_config.partner_passcode, '123456');

-- 3. Verify public read access for app_config so partner PIN can be validated
ALTER TABLE IF EXISTS app_config ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'app_config' AND policyname = 'Allow public read config'
  ) THEN
    CREATE POLICY "Allow public read config" ON app_config FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'app_config' AND policyname = 'Allow all update config'
  ) THEN
    CREATE POLICY "Allow all update config" ON app_config FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
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

console.log(`Executing SQL migration against Supabase project: ${SUPABASE_PROJECT_ID}...`);

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log(`Response Status: ${res.statusCode}`);
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log("Migration executed successfully!");
      console.log(body);
    } else {
      console.error("Migration failed with response:", body);
    }
  });
});

req.on('error', (e) => {
  console.error("Request failed:", e);
});

req.write(postData);
req.end();
