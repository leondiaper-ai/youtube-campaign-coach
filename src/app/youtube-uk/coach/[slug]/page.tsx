import { redirect } from 'next/navigation';
export default async function PartnerCoachRedirect({params}:{params:Promise<{slug:string}>}) { const {slug}=await params; redirect(`/coach/${encodeURIComponent(slug)}?partner=youtube-uk`); }
