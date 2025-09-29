'use client';

import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  Sentry.captureException(error);

  return (
    <html>
      <body>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '20px',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            backgroundColor: '#f7f7f7',
            padding: '40px',
            borderRadius: '8px',
            textAlign: 'center',
            maxWidth: '500px'
          }}>
            <h1 style={{ color: '#e0234e', marginBottom: '16px' }}>Something went wrong!</h1>
            <p style={{ color: '#666', marginBottom: '24px' }}>
              We're sorry for the inconvenience. The error has been reported to our team.
            </p>
            <button
              onClick={() => reset()}
              style={{
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
