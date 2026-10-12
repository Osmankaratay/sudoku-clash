import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import './firebase.ts';

// Auto-register service worker for offline gameplay & PWA installability
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(<App />);
