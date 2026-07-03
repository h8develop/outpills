export function Footer() {
  return (
    <footer className="border-t border-cobalt/40 mt-24">
      <div className="mx-auto max-w-7xl px-4 py-10 flex flex-col sm:flex-row items-start justify-between gap-6">
        <div className="font-mono text-xs text-steel space-y-1">
          <p className="tracking-widest2 uppercase">outpills · 薬局 · 24/7</p>
          <p>OUTSIDE OVERDOSE — INSIDE CLARITY</p>
          <p className="text-cobalt">BATCH {new Date().getFullYear()} · НЕ ЯВЛЯЕТСЯ ЛЕКАРСТВЕННЫМ СРЕДСТВОМ</p>
        </div>
        <div className="font-mono text-xs text-steel space-y-1 text-right">
          <p>ПОБОЧНЫЕ ЭФФЕКТЫ: ясность,</p>
          <p>лёгкое чувство превосходства.</p>
        </div>
      </div>
    </footer>
  );
}
