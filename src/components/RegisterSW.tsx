"use client";

import { useEffect } from 'react';

/** Registra il service worker minimo richiesto per l'installazione PWA. */
export const RegisterSW = () => {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return null;
};
