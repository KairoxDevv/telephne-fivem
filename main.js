import './core/bridge.js';
import { registerApp, screenEl, goBack, goHome } from './core/os.js';
import './core/overlays.js';
import './core/calls.js';
import phone from './apps/phone.js';
import messages from './apps/messages.js';
import contacts from './apps/contacts.js';
import camera from './apps/camera.js';
import gallery from './apps/gallery.js';
import settings from './apps/settings.js';
import store from './apps/store.js';
import bank from './apps/bank.js';
import crypto from './apps/crypto.js';
import casino from './apps/casino.js';
import garage from './apps/garage.js';
import notes from './apps/notes.js';
import calculator from './apps/calculator.js';
import services from './apps/services.js';
import pulse from './apps/pulse.js';
import ads from './apps/ads.js';

[settings, garage, calculator, gallery, bank, crypto, casino, notes, services, pulse, ads, phone, messages, contacts, store, camera].forEach(registerApp);

screenEl.addEventListener('click', (e) => {
  const n = e.target.closest('[data-nav]');
  if (!n) return;
  if (n.dataset.nav === 'back') goBack();
  if (n.dataset.nav === 'home') goHome();
});
