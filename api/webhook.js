// Farcaster Mini App Webhook Handler
// Receives notification events from Farcaster clients
// Stores notification tokens in Supabase for sending notifications later

import { parseWebhookEvent, verifyAppKeyWithNeynar } from "@farcaster/miniapp-node";
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

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
                if (event.notificationDetails && supabase) {
                    await storeNotificationToken(fid, event.notificationDetails);
                }
                break;

            case 'miniapp_removed':
                console.log(`User ${fid} removed the mini app`);
                if (supabase) {
                    await deleteNotificationToken(fid);
                }
                break;

            case 'notifications_enabled':
                console.log(`User ${fid} enabled notifications`);
                if (event.notificationDetails && supabase) {
                    await storeNotificationToken(fid, event.notificationDetails);
                }
                break;

            case 'notifications_disabled':
                console.log(`User ${fid} disabled notifications`);
                if (supabase) {
                    await deleteNotificationToken(fid);
                }
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

// Store notification token in Supabase
async function storeNotificationToken(fid, notificationDetails) {
    if (!supabase) return;

    try {
        // Upsert (insert or update) the token
        const { error } = await supabase
            .from('notification_tokens')
            .upsert({
                fid: fid,
                token: notificationDetails.token,
                url: notificationDetails.url,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'fid'
            });

        if (error) {
            console.error('Failed to store notification token:', error);
        } else {
            console.log(`Stored notification token for FID ${fid}`);
        }
    } catch (error) {
        console.error('Error storing notification token:', error);
    }
}

// Delete notification token from Supabase
async function deleteNotificationToken(fid) {
    if (!supabase) return;

    try {
        const { error } = await supabase
            .from('notification_tokens')
            .delete()
            .eq('fid', fid);

        if (error) {
            console.error('Failed to delete notification token:', error);
        } else {
            console.log(`Deleted notification token for FID ${fid}`);
        }
    } catch (error) {
        console.error('Error deleting notification token:', error);
    }
}
