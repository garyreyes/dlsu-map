// P1 Floor preview (6d, user-flows §6): the owner's check before a floor is marked `checked: true`. Dev-only: opened at
// /preview.html under `npm run dev`, never built (preview.html isn't a build input) and never imported by the app.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { FloorPreview } from './FloorPreview';
import '@/styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('preview.html is missing <div id="root">');

createRoot(root).render(
  <StrictMode>
    <FloorPreview />
  </StrictMode>,
);
