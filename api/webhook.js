// Farcaster Mini App Webhook Handler
// Receives notification events from Farcaster clients

export default function handler(req, res) {
    // Only accept POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const event = req.body;

        // Log the event for debugging
        console.log('Webhook received:', JSON.stringify(event, null, 2));

        // Handle different event types
        switch (event.event) {
            case 'frame_added':
                console.log(`User ${event.notificationDetails?.token} added the app`);
                break;
            case 'frame_removed':
                console.log(`User removed the app`);
                break;
            case 'notifications_enabled':
                console.log(`User enabled notifications`);
                break;
            case 'notifications_disabled':
                console.log(`User disabled notifications`);
                break;
            default:
                console.log('Unknown event type:', event.event);
        }

        // Respond with success
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Webhook error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
