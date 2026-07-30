// Lightweight i18n scaffold. KR is the launch locale (target market); EN is a stub
// to prove the pipeline. Strings are externalised progressively — add keys here and
// replace literals with t('key'). No dependency, no bundle cost beyond the dict.

import { create } from 'zustand';

export type Locale = 'ko' | 'en';

type Dict = Record<string, string>;

const ko: Dict = {
  'nav.home': '홈',
  'nav.run': '러닝',
  'nav.collection': '컬렉션',
  'nav.pvp': '대전',
  'nav.shop': '상점',
  'common.back': '뒤로',
  'common.retry': '다시 시도',
  'login.cta': '데모로 시작하기',
  'login.tagline': '달린 경로가 검이 된다',
  'home.startRun': '러닝 시작',
};

const en: Dict = {
  'nav.home': 'Home',
  'nav.run': 'Run',
  'nav.collection': 'Blades',
  'nav.pvp': 'Battle',
  'nav.shop': 'Shop',
  'common.back': 'Back',
  'common.retry': 'Retry',
  'login.cta': 'Start with demo',
  'login.tagline': 'the route you run becomes a blade',
  'home.startRun': 'Start run',
};

const DICTS: Record<Locale, Dict> = { ko, en };

interface LocaleStore {
  locale: Locale;
  setLocale: (l: Locale) => void;
}

export const useLocale = create<LocaleStore>((set) => ({
  locale: (localStorage.getItem('rb_locale') as Locale) || 'ko',
  setLocale: (locale) => { localStorage.setItem('rb_locale', locale); set({ locale }); },
}));

/** Translate a key for the current locale (falls back to ko, then the key itself). */
export function t(key: string): string {
  const { locale } = useLocale.getState();
  return DICTS[locale][key] ?? ko[key] ?? key;
}

/** Hook form so components re-render on locale change. */
export function useT() {
  const locale = useLocale((s) => s.locale);
  return (key: string) => DICTS[locale][key] ?? ko[key] ?? key;
}
