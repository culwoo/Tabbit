import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { PropsWithChildren, useEffect, useRef } from 'react';

import { syncPushRegistration } from '@/features/notifications/lib/push-registration';
import { useAppSession } from '@/providers/app-session-provider';

type NotificationData = Record<string, unknown>;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function PushNotificationProvider({ children }: PropsWithChildren) {
  const { bootstrapState, userId } = useAppSession();
  const handledResponseIds = useRef(new Set<string>());

  useEffect(() => {
    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      console.log('[PushNotifications] received:', notification.request.identifier);
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      routeNotificationResponse(response, handledResponseIds.current);
    });

    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          routeNotificationResponse(response, handledResponseIds.current);
        }
      })
      .catch((error) => {
        console.warn('[PushNotifications] initial response error:', error);
      });

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (bootstrapState === 'checking') {
      return;
    }

    void syncPushRegistration(userId).catch((error) => {
      console.warn('[PushNotifications] registration sync error:', error);
    });
  }, [bootstrapState, userId]);

  return children;
}

function routeNotificationResponse(
  response: Notifications.NotificationResponse,
  handledResponseIds: Set<string>,
) {
  const responseId = `${response.notification.request.identifier}:${response.actionIdentifier}`;

  if (handledResponseIds.has(responseId)) {
    return;
  }

  handledResponseIds.add(responseId);
  routeNotificationData(response.notification.request.content.data ?? {});
}

function routeNotificationData(data: NotificationData) {
  const type = getString(data.type);
  const groupId = getString(data.groupId);
  const lifestyleDate = getString(data.lifestyleDate);

  if (type === 'group_chat' && groupId) {
    router.push(`/groups/chat/${encodeURIComponent(groupId)}`);
    return;
  }

  if (type === 'story_card_finalized' && lifestyleDate) {
    router.push(`/calendar/${encodeURIComponent(lifestyleDate)}`);
    return;
  }

  if (groupId) {
    router.push(`/groups/${encodeURIComponent(groupId)}`);
  }
}

function getString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}
