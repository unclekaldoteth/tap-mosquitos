// Debug API - logs SDK context to Vercel logs
// Check Vercel Dashboard > Deployments > Functions > debug for logs

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { context, message } = req.body;

        console.log('=== DEBUG LOG ===');
        console.log('Message:', message);
        console.log('SDK Context:', JSON.stringify(context, null, 2));
        console.log('=================');

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Debug error:', error);
        return res.status(500).json({ error: error.message });
    }
}
