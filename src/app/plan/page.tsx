import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Redirecting to Coach...',
};

export default function PlanPage() {
  redirect('/coach');
}
