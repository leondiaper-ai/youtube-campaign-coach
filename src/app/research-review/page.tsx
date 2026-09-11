import ResearchReview from '@/components/ResearchReview';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Research Review — promote or reject Grok\'s verified examples',
  description: 'The human gate between verified external research and the client-facing Ideas tab.',
};

export default function ResearchReviewPage() {
  return <ResearchReview />;
}
