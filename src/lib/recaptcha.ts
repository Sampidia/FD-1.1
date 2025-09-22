/**
 * Google reCAPTCHA verification utilities
 */

// Verify reCAPTCHA token with Google's API
export async function verifyRecaptcha(token: string): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET_KEY || process.env.RECAPTCHA_SECRET_KEY_PLACEHOLDER;

  if (!secret || secret === process.env.RECAPTCHA_SECRET_KEY_PLACEHOLDER) {
    console.warn("⚠️ reCAPTCHA secret key not configured, bypassing verification");
    return true; // Allow in development/debugging
  }

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
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
      console.error('❌ reCAPTCHA verification failed:', data['error-codes']);
      return false;
    }

    // Verify score for v3 (though we'll mostly use v2 invisible, keeping flexible)
    if (data.score !== undefined && data.score < 0.5) {
      console.error('❌ reCAPTCHA score too low:', data.score);
      return false;
    }

    console.log('✅ reCAPTCHA verification successful');
    return true;
  } catch (error) {
    console.error('❌ reCAPTCHA verification error:', error);
    // In production, you might want to return false here
    // For development/debugging, allow through
    return false;
  }
}

// Verify reCAPTCHA token for NextAuth credentials (with request context)
export async function verifyRecaptchaForSignIn(token: string, email: string): Promise<{ success: boolean; error?: string }> {
  const secret = process.env.RECAPTCHA_SECRET_KEY || process.env.RECAPTCHA_SECRET_KEY_PLACEHOLDER;

  if (!secret || secret === process.env.RECAPTCHA_SECRET_KEY_PLACEHOLDER) {
    console.warn("⚠️ reCAPTCHA secret key not configured for sign-in, allowing access");
    return { success: true };
  }

  try {
    const isValid = await verifyRecaptcha(token);
    if (!isValid) {
      return {
        success: false,
        error: "reCAPTCHA verification failed. Please complete the captcha again."
      };
    }
    return { success: true };
  } catch (error) {
    console.error('❌ reCAPTCHA verification error during sign-in:', error);
    return {
      success: false,
      error: "Unable to verify captcha at this time. Please try again."
    };
  }
}
