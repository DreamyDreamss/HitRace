import { useToast, type ToastKind } from '../store/toast';

const STYLE: Record<ToastKind, string> = {
  info: 'border-hair-2 text-text-2',
  success: 'border-gold/50 text-gold-2',
  error: 'border-red/50 text-red',
};

export function ToastHost() {
  const { toasts, remove } = useToast();
  return (
    <div className="pointer-events-none fixed top-3 inset-x-0 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => remove(t.id)}
          className={`pointer-events-auto max-w-[380px] w-full bg-surface-3/95 backdrop-blur border ${STYLE[t.kind]} rounded-[12px] px-4 py-3 text-[13px] text-left animate-reveal shadow-lg`}
        >
          {t.msg}
        </button>
      ))}
    </div>
  );
}
