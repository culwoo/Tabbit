import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.103.2';
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const DEFAULT_BATCH_SIZE = 50;
const MAX_EXPO_MESSAGES_PER_REQUEST = 100;

type NotificationType =
  | 'group_invite'
  | 'new_certification'
  | 'certification_comment'
  | 'group_chat'
  | 'threshold_unlocked'
  | 'story_card_finalized';

type NotificationRow = {
  id: string;
  type: NotificationType;
  payload: Record<string, unknown> | null;
  created_at: string;
};

type DeliveryRow = {
  id: string;
  notification_id: string;
  user_id: string;
  attempts: number;
  notifications: NotificationRow | NotificationRow[] | null;
};

type PushTokenRow = {
  user_id: string;
  expo_push_token: string;
  platform: 'android' | 'ios' | 'web' | 'unknown';
};

type ExpoTicket = {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
};

type OutboundMessage = {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  channelId: string;
  data: Record<string, unknown>;
};

type OutboundContext = {
  deliveryId: string;
  expoPushToken: string;
};

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Origin': '*',
};

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const functionSecret = Deno.env.get('PUSH_FUNCTION_SECRET');

  if (functionSecret) {
    const authorization = request.headers.get('authorization') ?? '';

    if (authorization !== `Bearer ${functionSecret}`) {
      return json({ error: 'Unauthorized' }, 401);
    }
  }

  try {
    const body = await parseJsonBody(request);
    const batchSize = clampBatchSize(body.batchSize);
    const result = await sendPendingPushNotifications(batchSize);

    return json(result);
  } catch (error) {
    console.error('[send-push-notifications] error:', error);
    return json({ error: normalizeError(error) }, 500);
  }
});

async function sendPendingPushNotifications(batchSize: number) {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: deliveries, error: deliveryError } = await supabase
    .from('push_notification_deliveries')
    .select('id, notification_id, user_id, attempts, notifications(id, type, payload, created_at)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(batchSize);

  if (deliveryError) {
    throw deliveryError;
  }

  const pendingDeliveries = (deliveries ?? []) as DeliveryRow[];

  if (pendingDeliveries.length === 0) {
    return { failed: 0, sent: 0, skipped: 0, total: 0 };
  }

  const userIds = [...new Set(pendingDeliveries.map((delivery) => delivery.user_id))];
  const { data: pushTokens, error: tokenError } = await supabase
    .from('push_tokens')
    .select('user_id, expo_push_token, platform')
    .in('user_id', userIds)
    .is('disabled_at', null);

  if (tokenError) {
    throw tokenError;
  }

  const tokensByUserId = groupTokensByUserId((pushTokens ?? []) as PushTokenRow[]);
  const outboundMessages: OutboundMessage[] = [];
  const outboundContexts: OutboundContext[] = [];
  let skipped = 0;

  for (const delivery of pendingDeliveries) {
    const tokens = tokensByUserId.get(delivery.user_id) ?? [];
    const notification = unwrapNotification(delivery.notifications);

    if (!notification || tokens.length === 0) {
      skipped += 1;
      await markDelivery(supabase, delivery, 'skipped', 'No active push token.');
      continue;
    }

    for (const token of tokens) {
      outboundContexts.push({
        deliveryId: delivery.id,
        expoPushToken: token.expo_push_token,
      });
      outboundMessages.push(buildExpoMessage(notification, token.expo_push_token));
    }
  }

  const ticketResults = new Map<string, ExpoTicket[]>();

  for (let index = 0; index < outboundMessages.length; index += MAX_EXPO_MESSAGES_PER_REQUEST) {
    const messageChunk = outboundMessages.slice(index, index + MAX_EXPO_MESSAGES_PER_REQUEST);
    const contextChunk = outboundContexts.slice(index, index + MAX_EXPO_MESSAGES_PER_REQUEST);
    const tickets = await sendExpoMessageChunk(messageChunk);

    for (let ticketIndex = 0; ticketIndex < contextChunk.length; ticketIndex += 1) {
      const context = contextChunk[ticketIndex];
      const ticket = tickets[ticketIndex] ?? {
        status: 'error',
        message: 'Expo did not return a ticket for this message.',
      };

      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        await supabase
          .from('push_tokens')
          .update({ disabled_at: new Date().toISOString() })
          .eq('expo_push_token', context.expoPushToken);
      }

      const existingTickets = ticketResults.get(context.deliveryId) ?? [];
      existingTickets.push(ticket);
      ticketResults.set(context.deliveryId, existingTickets);
    }
  }

  let sent = 0;
  let failed = 0;

  for (const delivery of pendingDeliveries) {
    const tickets = ticketResults.get(delivery.id);

    if (!tickets) {
      continue;
    }

    const okTicket = tickets.find((ticket) => ticket.status === 'ok');

    if (okTicket) {
      sent += 1;
      await markDelivery(supabase, delivery, 'sent', null, okTicket.id ?? null);
      continue;
    }

    failed += 1;
    await markDelivery(
      supabase,
      delivery,
      'failed',
      tickets.map((ticket) => ticket.message ?? ticket.details?.error ?? 'Unknown error').join('; '),
    );
  }

  return {
    failed,
    sent,
    skipped,
    total: pendingDeliveries.length,
  };
}

function buildExpoMessage(notification: NotificationRow, expoPushToken: string): OutboundMessage {
  const payload = isRecord(notification.payload) ? notification.payload : {};
  const message = getString(payload.message) ?? getString(payload.body) ?? fallbackBody(notification.type);

  return {
    body: message,
    channelId: 'tabbit-default',
    data: {
      ...payload,
      notificationId: notification.id,
      type: notification.type,
    },
    sound: 'default',
    title: fallbackTitle(notification.type),
    to: expoPushToken,
  };
}

async function sendExpoMessageChunk(messages: OutboundMessage[]) {
  const response = await fetch(EXPO_PUSH_URL, {
    body: JSON.stringify(messages),
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  const responseBody = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`Expo Push API failed (${response.status}): ${JSON.stringify(responseBody)}`);
  }

  return (responseBody.data ?? []) as ExpoTicket[];
}

async function markDelivery(
  supabase: ReturnType<typeof createClient>,
  delivery: DeliveryRow,
  status: 'sent' | 'failed' | 'skipped',
  lastError: string | null,
  receiptId: string | null = null,
) {
  const { error } = await supabase
    .from('push_notification_deliveries')
    .update({
      attempts: delivery.attempts + 1,
      last_error: lastError,
      receipt_id: receiptId,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
      status,
    })
    .eq('id', delivery.id);

  if (error) {
    throw error;
  }
}

function groupTokensByUserId(tokens: PushTokenRow[]) {
  const map = new Map<string, PushTokenRow[]>();

  for (const token of tokens) {
    const existing = map.get(token.user_id) ?? [];
    existing.push(token);
    map.set(token.user_id, existing);
  }

  return map;
}

function unwrapNotification(value: NotificationRow | NotificationRow[] | null) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function fallbackTitle(type: NotificationType) {
  switch (type) {
    case 'group_chat':
      return 'New chat message';
    case 'group_invite':
      return 'Group invite';
    case 'new_certification':
      return 'New certification';
    case 'threshold_unlocked':
      return 'Story unlocked';
    case 'story_card_finalized':
      return 'Story finalized';
    case 'certification_comment':
      return 'New comment';
    default:
      return 'Tabbit';
  }
}

function fallbackBody(type: NotificationType) {
  switch (type) {
    case 'group_chat':
      return 'A group has a new chat message.';
    case 'group_invite':
      return 'You have a new group invite.';
    case 'new_certification':
      return 'A member posted a new certification.';
    case 'threshold_unlocked':
      return 'A group story is ready to view.';
    case 'story_card_finalized':
      return 'A group story has been finalized.';
    case 'certification_comment':
      return 'A member left a comment.';
    default:
      return 'Open Tabbit for the latest update.';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

async function parseJsonBody(request: Request) {
  if (request.method === 'GET') {
    return {};
  }

  const text = await request.text();

  if (!text) {
    return {};
  }

  return JSON.parse(text) as Record<string, unknown>;
}

function clampBatchSize(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_BATCH_SIZE;
  }

  return Math.max(1, Math.min(100, Math.floor(value)));
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    status,
  });
}
