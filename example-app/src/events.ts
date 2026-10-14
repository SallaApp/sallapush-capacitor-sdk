import { eventLog } from './eventLog';
import { foreground, type ForegroundMode } from './foreground';
import { button, element, note, section, select } from './ui';

const MODES: readonly ForegroundMode[] = ['off', 'show', 'hold'];

const MODE_NOTES: Record<ForegroundMode, string> = {
  off: 'No listener: SallaPush shows foreground notifications itself, as sent.',
  show:
    "A listener that doesn't prevent: each one is shown once it returns. On iOS that is SallaPush's local copy, " +
    'without the image, action buttons or interruption level.',
  hold: 'A listener that prevents: each one waits below, and Display shows it within 10 minutes.',
};

export function renderForeground(): HTMLElement {
  const modeNote = note(MODE_NOTES[foreground.mode()]);
  const held = element('div', 'held-list');
  const render = () => {
    modeNote.textContent = MODE_NOTES[foreground.mode()];
    held.replaceChildren(
      ...foreground.held().map((notification) =>
        element(
          'div',
          'held',
          element(
            'span',
            'text',
            notification.title ?? notification.notificationId ?? 'notification'
          ),
          button('Display', () => foreground.display(notification))
        )
      )
    );
  };
  foreground.subscribe(render);
  render();
  return section(
    'Foreground notifications',
    select(MODES, foreground.mode(), foreground.setMode),
    modeNote,
    held
  );
}

export function renderEventLog(): HTMLElement {
  const lines = element('div', 'log');
  const render = () => {
    lines.replaceChildren(
      ...eventLog
        .lines()
        .map((line) =>
          element(
            'p',
            'log-line',
            element('span', 'time', `${line.time} `),
            element('span', 'kind', line.kind),
            ` ${line.text}`
          )
        )
    );
  };
  eventLog.subscribe(render);
  render();
  return section('Event log', button('Clear', eventLog.clear), lines);
}
