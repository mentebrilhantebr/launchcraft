/**
 * Tela inicial — Etapa 9
 *
 * Doc 02, seção 4: "A tela inicial será limpa, sem excesso de informações."
 * "Pequena mensagem de boas-vindas." Exemplo: "Descreva sua ideia e eu ajudarei
 * você a transformá-la em um negócio digital."
 *
 * MVP com login obrigatório: o chat fica dentro do projeto (/app/project/[id]);
 * aqui apenas a boas-vindas e o acesso.
 */

import Link from 'next/link';
import Brand from '@/components/Brand';
import ThemeToggle from '@/components/ThemeToggle';

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <Brand className="text-lg" />
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-24">
        <div className="glass w-full max-w-xl rounded-3xl px-8 py-12 text-center">
          <p className="mb-4 text-sm font-medium text-accent">Seu assistente de negócios digitais</p>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Descreva sua ideia e eu ajudarei você a transformá-la em um negócio digital.
          </h1>
          <div className="mt-8 flex justify-center">
            <Link href="/login" className="btn-primary px-6 py-3">
              Começar
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
