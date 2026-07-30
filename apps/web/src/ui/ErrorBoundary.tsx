import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

// Catches render-time crashes anywhere below it and shows a recoverable fallback
// instead of a blank screen.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Hook point for a real crash reporter (Sentry, etc.) in production.
    console.error('[HitRace] render error:', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-5 bg-bg px-8 text-center">
          <div className="flex flex-col gap-2">
            <span className="eyebrow">문제가 발생했어요</span>
            <h1 className="text-[20px] font-semibold">화면을 불러오지 못했습니다</h1>
            <p className="text-[13px] text-text-3">잠시 후 다시 시도해 주세요. 데이터는 안전합니다.</p>
          </div>
          <button
            onClick={() => { this.setState({ error: null }); location.assign('/'); }}
            className="pressable h-[52px] px-8 rounded-2xl bg-gold text-[#0B0C0E] font-bold text-[15px]"
          >
            홈으로
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
