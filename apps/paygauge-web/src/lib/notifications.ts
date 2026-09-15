import type { NotificationItem } from './api';

export async function requestDeviceNotificationPermission() {
  if (typeof window === 'undefined') return 'unsupported';

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const result = await LocalNotifications.requestPermissions();
    if (result.display) return result.display;
  } catch {
    // Browser fallback below keeps local development usable outside Capacitor.
  }

  if ('Notification' in window) return Notification.requestPermission();
  return 'unsupported';
}

export async function sendLocalTestNotification(item: NotificationItem) {
  if (typeof window === 'undefined') return 'unsupported';

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Date.now() % 2_147_483_647),
          title: item.title,
          body: item.body,
          schedule: { at: new Date(Date.now() + 1000) },
          extra: { loanId: item.loan_id, type: item.type },
        },
      ],
    });
    return 'scheduled';
  } catch {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(item.title, { body: item.body });
      return 'sent';
    }
  }

  return 'permission-needed';
}
