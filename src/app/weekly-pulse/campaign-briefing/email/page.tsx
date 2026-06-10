'use client';

import { useState, useEffect, useRef } from 'react';

// ── Design tokens ────────────────────────────────────────────────────────────

const INK   = '#0E0E0E';
const PAPER = '#FAF7F2';
const SMOKE = '#6B7280';
const BONE  = '#E8E3DA';
const WHITE = '#FFFFFF';
const GREEN = '#2D6A4F';

export default function EmailPreviewPage() {
  const [html, setHtml] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [weekRange, setWeekRange] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'html' | 'subject' | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    fetch('/api/email-briefing')
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else {
          setHtml(data.html);
          setSubject(data.subject);
          setPreviewText(data.previewText);
          setWeekRange(data.weekRange);
        }
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Write HTML to iframe when it loads
  useEffect(() => {
    if (html && iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
      }
    }
  }, [html]);

  const copyToClipboard = async (text: string, label: 'html' | 'subject') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: PAPER, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: SMOKE, fontFamily: 'system-ui, sans-serif' }}>
            Generating email briefing...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: PAPER, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 16, color: '#B91C1C', fontFamily: 'system-ui, sans-serif', marginBottom: 8 }}>
            Error generating email
          </div>
          <div style={{ fontSize: 13, color: SMOKE, fontFamily: 'system-ui, sans-serif' }}>
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F3F4F6', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ── Toolbar ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: WHITE, borderBottom: `1px solid ${BONE}`,
        padding: '16px 24px',
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: GREEN, textTransform: 'uppercase' as const, letterSpacing: '1px' }}>
            Email Briefing
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: INK, marginTop: 2 }}>
            {weekRange}
          </div>
        </div>

        {/* Copy Subject */}
        <button
          onClick={() => copyToClipboard(subject, 'subject')}
          style={{
            padding: '8px 16px', borderRadius: 6,
            border: `1px solid ${BONE}`, background: WHITE,
            fontSize: 13, fontWeight: 600, color: INK,
            cursor: 'pointer', whiteSpace: 'nowrap' as const,
            transition: 'all 0.15s',
          }}
          onMouseOver={e => (e.currentTarget.style.background = PAPER)}
          onMouseOut={e => (e.currentTarget.style.background = WHITE)}
        >
          {copied === 'subject' ? 'Copied!' : 'Copy Subject Line'}
        </button>

        {/* Copy HTML */}
        <button
          onClick={() => html && copyToClipboard(html, 'html')}
          style={{
            padding: '8px 20px', borderRadius: 6,
            border: 'none', background: GREEN,
            fontSize: 13, fontWeight: 700, color: WHITE,
            cursor: 'pointer', whiteSpace: 'nowrap' as const,
            transition: 'all 0.15s',
          }}
          onMouseOver={e => (e.currentTarget.style.opacity = '0.9')}
          onMouseOut={e => (e.currentTarget.style.opacity = '1')}
        >
          {copied === 'html' ? 'Copied!' : 'Copy Email HTML'}
        </button>
      </div>

      {/* ── Info bar ── */}
      <div style={{
        padding: '12px 24px', background: '#FFFBEB',
        borderBottom: `1px solid #F59E0B33`,
        fontSize: 13, color: '#92400E', lineHeight: 1.5,
      }}>
        <strong>How to use:</strong> Click &quot;Copy Email HTML&quot; above, then paste into Mailchimp&apos;s code editor (Campaigns &rarr; Code your own) or Outlook (new email &rarr; Format Text &rarr; Edit in HTML). The subject line copies separately.
      </div>

      {/* ── Subject line preview ── */}
      <div style={{ padding: '16px 24px 0 24px' }}>
        <div style={{
          background: WHITE, borderRadius: 8, border: `1px solid ${BONE}`,
          padding: '12px 16px',
        }}>
          <div style={{ fontSize: 11, color: SMOKE, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: 4 }}>
            Subject Line
          </div>
          <div style={{ fontSize: 14, color: INK, fontWeight: 600 }}>
            {subject}
          </div>
          <div style={{ fontSize: 12, color: SMOKE, marginTop: 4 }}>
            Preview: {previewText}
          </div>
        </div>
      </div>

      {/* ── Email preview (iframe) ── */}
      <div style={{ padding: '16px 24px 32px 24px' }}>
        <div style={{
          background: WHITE, borderRadius: 8, border: `1px solid ${BONE}`,
          overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        }}>
          {/* Fake browser chrome */}
          <div style={{
            background: '#F9FAFB', borderBottom: `1px solid ${BONE}`,
            padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#EF4444' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#F59E0B' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981' }} />
            <div style={{
              marginLeft: 12, flex: 1,
              background: WHITE, borderRadius: 4, border: `1px solid ${BONE}`,
              padding: '4px 12px', fontSize: 12, color: SMOKE,
            }}>
              Email Preview — {weekRange}
            </div>
          </div>

          <iframe
            ref={iframeRef}
            title="Email Preview"
            style={{
              width: '100%', height: 800, border: 'none',
              display: 'block',
            }}
            sandbox="allow-same-origin"
          />
        </div>
      </div>
    </div>
  );
}
