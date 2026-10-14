import './style.css';
import { renderApp } from './app';
import { startEventLog } from './eventLog';
import { startSelfTest } from './selfTest';
import { startSallaPush } from './start';

// At app start, before the first screen: the tap that launched the app reaches the click listeners added here.
startEventLog();
startSallaPush();
void startSelfTest();

const root = document.querySelector<HTMLElement>('#app');
if (root) {
  renderApp(root);
}
