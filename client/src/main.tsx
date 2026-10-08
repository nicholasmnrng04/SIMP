import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './carbon.scss';
import './styles.css';
import './redesign.scss';
import './readable.scss';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
