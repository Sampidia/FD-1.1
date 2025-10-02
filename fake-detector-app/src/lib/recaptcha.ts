/**
 * Cloudflare Turnstile verification utilities
 */

// Verify Turnstile token with Cloudflare's API
export async function verifyRecaptcha(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY || '1x0000000000000000000000000000000AA';

  if (!secret || secret === '1x0000000000000000000000000000000AA') {
    console.warn("⚠️ Cloudflare Turnstile secret key not configured, bypassing verification");
    return true; // Allow in development/debugging
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret,
        response: token,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      console.error('❌ Cloudflare Turnstile verification failed:', data['error-codes']);
      return false;
    }

    console.log('✅ Cloudflare Turnstile verification successful');
    return true;
  } catch (error) {
    console.error('❌ Cloudflare Turnstile verification error:', error);
    // In production, you might want to return false here
    // For development/debugging, allow through
    return false;
  }
}

// Verify Turnstile token for NextAuth credentials (with request context)
export async function verifyRecaptchaForSignIn(token: string, email: string): Promise<{ success: boolean; error?: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY || '1x0000000000000000000000000000000AA';

  if (!secret || secret === '1x0000000000000000000000000000000AA') {
    console.warn("⚠️ Cloudflare Turnstile secret key not configured for sign-in, allowing access");
    return { success: true };
  }

  try {
    const isValid = await verifyRecaptcha(token);
    if (!isValid) {
      return {
        success: false,
        error: "Cloudflare Turnstile verification failed. Please complete the captcha again."
      };
    }
    return { success: true };
  } catch (error) {
    console.error('❌ Cloudflare Turnstile verification error during sign-in:', error);
    return {
      success: false,
      error: "Unable to verify captcha at this time. Please try again."
    };
  }
}
