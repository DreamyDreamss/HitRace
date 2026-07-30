import { useNavigate } from 'react-router-dom';
import { Eyebrow } from '../ui/kit';

// Temporary screen for routes being filled in during Milestone 3.
export function Placeholder({ title, code }: { title: string; code: string }) {
  const nav = useNavigate();
  return (
    <div className="flex flex-col gap-6 px-5 pt-5 pb-6 min-h-[70dvh]">
      <button onClick={() => nav(-1)} className="text-[15px] text-muted self-start">‹ 뒤로</button>
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
        <Eyebrow>{code}</Eyebrow>
        <h1 className="text-[22px] font-semibold">{title}</h1>
        <p className="text-[13px] text-text-3">이 화면은 곧 채워집니다 (Milestone 3).</p>
      </div>
    </div>
  );
}
