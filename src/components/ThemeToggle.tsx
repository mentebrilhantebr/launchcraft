/**
 * Alternador de tema claro/escuro — Etapa 9
 *
 * Doc 02, seção 4: "Alternância entre modo claro e modo escuro."
 * Doc 02 (parte 2): "O usuário poderá alternar entre: Modo Claro / Modo Escuro —
 * Sem alterar a organização da interface."
 *
 * Persiste apenas a PREFERÊNCIA de tema em localStorage (nunca tokens).
 */

'use client';

import { useEffect, useState } from 'react';

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('lc-theme', next ? 'dark' : 'light');
    } catch {
      // Sem acesso ao localStorage — apenas não persiste.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Ativar modo claro' : 'Ativar modo escuro'}
      title={dark ? 'Modo claro' : 'Modo escuro'}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted transition-colors hover:bg-surface hover:text-foreground ${className}`}
    >
      {dark ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
