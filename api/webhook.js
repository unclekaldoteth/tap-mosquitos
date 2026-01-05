// Farcaster Mini App Webhook Handler
// Receives notification events from Farcaster clients
// Uses @farcaster/miniapp-node for proper event parsing and verification

import { parseWebhookEvent, verifyAppKeyWithNeynar } from "@farcaster/miniapp-node";

export default async function handler(req, res) {
    // Only accept POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const requestJson = req.body;

        // Parse and verify the webhook event
        let data;
        try {
            data = await parseWebhookEvent(requestJson, verifyAppKeyWithNeynar);
        } catch (e) {
            console.error('Webhook verification failed:', e);
            return res.status(401).json({ error: 'Invalid signature' });
        }

        // Extract webhook data
        const fid = data.fid;
        const appFid = data.appFid;
        const event = data.event;

        console.log(`Webhook event: ${event.event} from FID ${fid}`);

        // Handle different event types
        switch (event.event) {
            case 'miniapp_added':
                console.log(`User ${fid} added the mini app`);
                if (event.notificationDetails) {
                    // Store notification token for this user
                    console.log('Notification details:', event.notificationDetails);
                }
                break;

            case 'miniapp_removed':
                console.log(`User ${fid} removed the mini app`);
                break;

            case 'notifications_enabled':
                console.log(`User ${fid} enabled notifications`);
                // Store notification details for sending notifications later
                if (event.notificationDetails) {
                    console.log('Notification token:', event.notificationDetails.token);
                    console.log('Notification URL:', event.notificationDetails.url);
                }
                break;

            case 'notifications_disabled':
                console.log(`User ${fid} disabled notifications`);
                break;

            default:
                console.log('Unknown event type:', event.event);
        }

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Webhook error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
