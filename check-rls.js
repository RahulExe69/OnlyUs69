import https from 'https';

const SUPABASE_PROJECT_ID = process.env.SUPABASE_PROJECT_ID || 'vrstmtjfqlbfyxtsothf';
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

const sql = `
SELECT 
  schemaname, 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

SELECT * FROM pg_policies WHERE schemaname = 'public';

SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
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
    console.log("RLS and Realtime configuration:");
    console.log(body);
  });
});

req.write(postData);
req.end();
