import { redirect } from 'next/navigation';

export const metadata = {
  title: 'YouTube Weekly Pulse',
  description: 'Weekly YouTube intelligence briefing — campaign signals, content opportunities, and channel momentum.',
};

export default function WeeklyPulsePage() {
  redirect('/weekly-pulse/campaign-briefing');
}
