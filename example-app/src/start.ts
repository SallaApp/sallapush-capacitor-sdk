import {
  SallaPush,
  type SallaPushNotification,
} from '@salla.sa/sallapush-capacitor';
import { eventLog } from './eventLog';

/** SallaPush's start-up calls. main.ts makes them before the first screen, so the tap that launched the app arrives. */
export function startSallaPush(): void {
  // snippet:click-listener
  SallaPush.Notifications.addEventListener('click', (event) => {
    route(event.notification);
  });
  // end-snippet
}

// The example's stand-in for the app's navigation: it writes where a tap leads to the event log.
const router = {
  showProduct: (id: number) => eventLog.add('route', `product ${id}`),
  showOrder: (id: string) => eventLog.add('route', `order ${id}`),
  open: (url: string) => eventLog.add('route', url),
};

function route(notification: SallaPushNotification): void {
  switch (notification.getString('type')) {
    case 'product': {
      const id = notification.getInt('id');
      if (id !== null) {
        router.showProduct(id);
      }
      break;
    }
    case 'order': {
      const id = notification.getString('id');
      if (id !== null) {
        router.showOrder(id);
      }
      break;
    }
    default:
      // With openLaunchUrls on, SallaPush opened it already: skip this.
      if (notification.launchUrl !== null) {
        router.open(notification.launchUrl);
      }
  }
}
