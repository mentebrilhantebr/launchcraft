/**
 * Marca textual LaunchCraft — Etapa 9 (visual discreto, sem logotipo gráfico).
 */

export default function Brand({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <span
        aria-hidden="true"
        className="inline-block h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-primary-soft"
      />
      LaunchCraft
    </span>
  );
}
