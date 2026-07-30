import { lazy, Suspense, type ReactNode } from 'react';
import type { RouteObject } from 'react-router-dom';
import { Outlet } from 'react-router-dom';
import { Root } from './screens/Root';
import { Home } from './screens/Home';
import { DeviceShell } from './ui/Shell';
import { Spinner } from './ui/kit';

// Route-level code splitting: each screen is its own chunk, loaded on demand.
const Onboarding = lazy(() => import('./screens/Onboarding').then((m) => ({ default: m.Onboarding })));
const Running = lazy(() => import('./screens/Running').then((m) => ({ default: m.Running })));
const Summary = lazy(() => import('./screens/Summary').then((m) => ({ default: m.Summary })));
const ForgeResult = lazy(() => import('./screens/ForgeResult').then((m) => ({ default: m.ForgeResult })));
const Collection = lazy(() => import('./screens/Collection').then((m) => ({ default: m.Collection })));
const SwordDetail = lazy(() => import('./screens/SwordDetail').then((m) => ({ default: m.SwordDetail })));
const Upgrade = lazy(() => import('./screens/Upgrade').then((m) => ({ default: m.Upgrade })));
const Gacha = lazy(() => import('./screens/Gacha').then((m) => ({ default: m.Gacha })));
const Matching = lazy(() => import('./screens/Matching').then((m) => ({ default: m.Matching })));
const Battle = lazy(() => import('./screens/Battle').then((m) => ({ default: m.Battle })));
const Ranking = lazy(() => import('./screens/Ranking').then((m) => ({ default: m.Ranking })));
const Season = lazy(() => import('./screens/Season').then((m) => ({ default: m.Season })));
const Profile = lazy(() => import('./screens/Profile').then((m) => ({ default: m.Profile })));
const Workshop = lazy(() => import('./screens/Workshop').then((m) => ({ default: m.Workshop })));
const Parts = lazy(() => import('./screens/Parts').then((m) => ({ default: m.Parts })));
const Fusion = lazy(() => import('./screens/Fusion').then((m) => ({ default: m.Fusion })));
const Codex = lazy(() => import('./screens/Codex').then((m) => ({ default: m.Codex })));
const ManualRun = lazy(() => import('./screens/ManualRun').then((m) => ({ default: m.ManualRun })));
const CourseBoard = lazy(() => import('./screens/CourseBoard').then((m) => ({ default: m.CourseBoard })));
const Replay = lazy(() => import('./screens/Replay').then((m) => ({ default: m.Replay })));

const Susp = ({ children }: { children: ReactNode }) => <Suspense fallback={<Spinner />}>{children}</Suspense>;

const Tabbed = () => (
  <DeviceShell nav>
    <Susp><Outlet /></Susp>
  </DeviceShell>
);
const Stacked = () => (
  <DeviceShell nav={false}>
    <Susp><Outlet /></Susp>
  </DeviceShell>
);

export const routes: RouteObject[] = [
  // Public replay — no auth gate, so a shared link opens for anyone.
  { path: '/replay/:data', element: <Susp><Replay /></Susp> },
  {
    path: '/',
    element: <Root />,
    children: [
      {
        element: <Tabbed />,
        children: [
          { index: true, element: <Home /> },
          { path: 'collection', element: <Collection /> },
          { path: 'pvp', element: <Matching /> },
          { path: 'gacha', element: <Gacha /> },
          { path: 'ranking', element: <Ranking /> },
          { path: 'season', element: <Season /> },
          { path: 'profile', element: <Profile /> },
        ],
      },
      {
        element: <Stacked />,
        children: [
          { path: 'run', element: <Running /> },
          { path: 'run/manual', element: <ManualRun /> },
          { path: 'run/summary', element: <Summary /> },
          { path: 'forge/:swordId', element: <ForgeResult /> },
          { path: 'forge/fusion', element: <Fusion /> },
          { path: 'sword/:id', element: <SwordDetail /> },
          { path: 'sword/:id/upgrade', element: <Upgrade /> },
          { path: 'sword/:id/workshop', element: <Workshop /> },
          { path: 'sword/:id/parts', element: <Parts /> },
          { path: 'pvp/:matchId', element: <Battle /> },
          { path: 'onboarding', element: <Onboarding /> },
          { path: 'codex', element: <Codex /> },
          { path: 'course/:hash', element: <CourseBoard /> },
        ],
      },
    ],
  },
];
