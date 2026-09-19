import { appMetadata } from "@/app/app-metadata";

export function App() {
  return (
    <main className="min-h-dvh bg-[var(--hawya-surface)] text-[var(--hawya-foreground)]">
      <section className="mx-auto flex min-h-dvh w-full max-w-5xl items-center px-6 py-16 sm:px-10">
        <div className="max-w-2xl">
          <p className="mb-4 text-sm font-semibold tracking-[0.16em] text-[var(--hawya-muted)] uppercase">
            {appMetadata.stage}
          </p>
          <h1 className="text-5xl font-semibold tracking-[-0.045em] sm:text-7xl">
            {appMetadata.name}
          </h1>
          <p lang="ar" dir="rtl" className="mt-2 text-2xl text-[var(--hawya-muted)] sm:text-3xl">
            {appMetadata.arabicName}
          </p>
          <p className="mt-8 max-w-xl text-lg leading-8 text-[var(--hawya-muted)]">
            {appMetadata.tagline}
          </p>
          <div className="mt-10 inline-flex items-center rounded-full border border-[var(--hawya-border)] px-4 py-2 text-sm">
            Free · Open source · Local-first
          </div>
        </div>
      </section>
    </main>
  );
}
