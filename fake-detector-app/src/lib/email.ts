import nodemailer from 'nodemailer'
import { Logger } from './logger'

// Email configuration
export const emailConfig = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER!, // generated SMTP password
    pass: process.env.SMTP_PASS!, // generated SMTP password
  },
  from: process.env.SMTP_FROM_EMAIL || '"Fake Detector" <noreply@fake-detector-app.com>',
}

// Create reusable transporter object using the default SMTP transport
let transporter: nodemailer.Transporter

export function getEmailTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport(emailConfig)
  }
  return transporter
}

// Email sending interface
export interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
  from?: string
  attachments?: Array<{
    filename: string
    content: string | Buffer
    contentType?: string
  }>
}

// Base email sending function
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const transporter = getEmailTransporter()

    const mailOptions: nodemailer.SendMailOptions = {
      from: options.from || emailConfig.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments,
    }

    const info = await transporter.sendMail(mailOptions)

    Logger.info('Email sent successfully', {
      messageId: info.messageId,
      to: options.to,
      subject: options.subject
    })

    return true
  } catch (error) {
    Logger.error('Email sending failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      to: options.to,
      subject: options.subject
    })
    return false
  }
}

// Email templates
export const emailTemplates = {
  welcome: (userName: string): EmailOptions => ({
    to: '',
    subject: 'Welcome to Fake Products Detector!',
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <h1 style="color: #1E40AF; text-align: center;">Welcome to Fake Products Detector!</h1>

        <div style="background: linear-gradient(135deg, #FFD700 0%, #1E40AF 100%); padding: 20px; border-radius: 10px; margin: 20px 0;">
          <h2 style="color: white; margin: 0; text-align: center;">Hello ${userName}! 👋</h2>
        </div>

        <div style="background: #f9f9f9; padding: 30px; border-radius: 10px; margin: 20px 0;">
          <p style="font-size: 16px; line-height: 1.6; color: #333;">
            Thank you for joining Fake Detector ! Your account has been successfully created with <strong>5 daily points</strong> to start scanning products and protecting your health.
          </p>

          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #FFD700;">
            <h3 style="color: #1E40AF; margin-top: 0;">🎯 What You Can Do Now:</h3>
            <ul style="color: #555; padding-left: 20px;">
              <li>Scan products before purchasing</li>
              <li>Check authenticity with NAFDAC database</li>
              <li>Purchase additional points anytime</li>
              <li>Receive safety alerts via email</li>
            </ul>
          </div>

          <p style="font-size: 14px; color: #666; text-align: center; margin-top: 30px;">
            Stay safe, ${userName}! Protect your health with verified products.
          </p>
        </div>

        <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
          <p>Fake Products Detector - Verify Before You Buy</p>
          <p>If you didn't create this account, please ignore this email.</p>
        </div>
      </div>
    `,
    text: `
      Welcome to Fake Products Detector, ${userName}!

      Your account has been created successfully with 5 daily points.

      You can now:
      • Scan products before purchasing
      • Check authenticity with NAFDAC database
      • Purchase additional points anytime
      • Receive safety alerts via email

      Stay safe and protect your health!
    `
  }),

  dailyPointsGranted: (userName: string, currentBalance: number): EmailOptions => ({
    to: '',
    subject: 'Your Daily Points Have Been Added! 🔋',
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <h1 style="color: #FFD700; text-align: center;">Daily Points Added! 🔋</h1>

        <div style="background: linear-gradient(135deg, #FFD700 0%, #1E40AF 100%); padding: 20px; border-radius: 10px; margin: 20px 0;">
          <h2 style="color: white; margin: 0; text-align: center;">Hello ${userName}!</h2>
        </div>

        <div style="background: #f9f9f9; padding: 30px; border-radius: 10px; margin: 20px 0;">
          <p style="font-size: 16px; line-height: 1.6; color: #333;">
            Great news! Your <strong>5 daily points</strong> have been automatically added to your account. You now have <strong>${currentBalance} total points</strong> ready to use.
          </p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.NEXTAUTH_URL}/dashboard" style="background: #1E40AF; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold;">Start Scanning Products</a>
        </div>

        <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
          <p>Fake Detector - Verify Podicts Before You Buy</p>
        </div>
      </div>
    `,
    text: `
      Daily Points Added!

      Hello ${userName},

      Your 5 daily points have been added! You now have ${currentBalance} total points.

      Start scanning products now!
    `
  }),

  productAlert: (
    userName: string,
    productName: string,
    result: 'genuine' | 'counterfeit',
    summary: string,
    resultId: string,
    pointsUsed: number,
    remainingPoints: number
  ): EmailOptions => ({
    to: '',
    subject: result === 'counterfeit' ? '⚠️ Counterfeit Product Alert!' : '✅ Genuine Product Verified',
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <h1 style="color: ${result === 'counterfeit' ? '#DC2626' : '#16A34A'}; text-align: center;">
          ${result === 'counterfeit' ? '⚠️ Counterfeit Alert!' : '✅ Genuine Product!'}
        </h1>

        <div style="background: linear-gradient(135deg, #FFD700 0%, #1E40AF 100%); padding: 20px; border-radius: 10px; margin: 20px 0;">
          <h2 style="color: white; margin: 0; text-align: center;">Hello ${userName}!</h2>
        </div>

        <div style="background: #f9f9f9; padding: 30px; border-radius: 10px; margin: 20px 0;">
          <h3 style="color: #1E40AF;">Product Scanned: ${productName}</h3>
          <p style="font-size: 16px; line-height: 1.6; color: #333;">
            Result ID: <strong>${resultId}</strong><br>
            Status: <strong style="color: ${result === 'counterfeit' ? '#DC2626' : '#16A34A'};">${result.toUpperCase()}</strong><br>
            Points Used: ${pointsUsed}<br>
            Remaining Points: ${remainingPoints}
          </p>

          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${result === 'counterfeit' ? '#DC2626' : '#16A34A'};">
            <h4 style="margin-top: 0; color: #1E40AF;">📋 Summary:</h4>
            <p style="margin: 0; color: #555; line-height: 1.6;">${summary}</p>
          </div>

          ${result === 'counterfeit' ?
            '<div style="background: #FEF2F2; border: 1px solid #FECACA; color: #DC2626; padding: 15px; border-radius: 8px; margin: 15px 0;">⚠️ <strong>Important:</strong> This product may be counterfeit. Please consult with healthcare professionals before use.</div>'
            :
            '<div style="background: #F0FDF4; border: 1px solid #BBF7D0; color: #166534; padding: 15px; border-radius: 8px; margin: 15px 0;">✅ This product appears to be genuine based on our database verification.</div>'
          }
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.NEXTAUTH_URL}/dashboard" style="background: #1E40AF; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold;">Scan Another Product</a>
        </div>

        <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
          <p>Fake Products Detector - Verify Before You Buy</p>
          <p>Source: NAFDAC Official Database</p>
        </div>
      </div>
    `,
    text: `
      ${result.toUpperCase()} Product Alert!

      Hello ${userName},

      Product Scanned: ${productName}
      Result ID: ${resultId}
      Status: ${result.toUpperCase()}
      Points Used: ${pointsUsed}
      Remaining Points: ${remainingPoints}

      Summary: ${summary}

      ${result === 'counterfeit' ?
        '⚠️ IMPORTANT: This product may be counterfeit. Please consult healthcare professionals before use.'
        : '✅ This product appears genuine based on our database verification.'
      }

      Source: NAFDAC Official Database
    `
  }),

  paymentSuccessful: (
    userName: string,
    amount: number,
    pointsPurchased: number,
    transactionId: string,
    newBalance: number
  ): EmailOptions => ({
    to: '',
    subject: `Payment Successful - ${pointsPurchased} Points Added! 💳`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <h1 style="color: #16A34A; text-align: center;">Payment Successful! ✅</h1>

        <div style="background: linear-gradient(135deg, #FFD700 0%, #1E40AF 100%); padding: 20px; border-radius: 10px; margin: 20px 0;">
          <h2 style="color: white; margin: 0; text-align: center;">Hello ${userName}!</h2>
        </div>

        <div style="background: #f9f9f9; padding: 30px; border-radius: 10px; margin: 20px 0;">
          <p style="font-size: 16px; line-height: 1.6; color: #333;">
            Your payment has been processed successfully! Here are the details:
          </p>

          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #16A34A;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
              <span style="color: #666;">Amount Paid:</span>
              <strong style="color: #16A34A;">₦${amount.toLocaleString()}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
              <span style="color: #666;">Points Purchased:</span>
              <strong style="color: #1E40AF;">${pointsPurchased}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
              <span style="color: #666;">Transaction ID:</span>
              <span style="font-family: monospace; color: #666;">${transactionId}</span>
            </div>
            <div style="display: flex; justify-content: space-between; border-top: 2px solid #eee; padding-top: 10px; margin-top: 10px;">
              <span style="color: #666;">New Balance:</span>
              <strong style="color: #16A34A; font-size: 18px;">${newBalance} points</strong>
            </div>
          </div>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.NEXTAUTH_URL}/dashboard" style="background: #1E40AF; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold;">Start Scanning</a>
        </div>

        <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
          <p>Fake Products Detector - Verify Before You Buy</p>
          <p>Thank you for protecting your health!</p>
        </div>
      </div>
    `,
    text: `
      Payment Successful!

      Hello ${userName},

      Your payment has been processed successfully!

      Amount Paid: ₦${amount.toLocaleString()}
      Points Purchased: ${pointsPurchased}
      Transaction ID: ${transactionId}
      New Balance: ${newBalance} points

      Thank you for protecting your health!

      Start scanning products now!
    `
  }),

  paymentFailure: (
    userId: string,
    amount: number,
    currency: string,
    gateway: string,
    transactionId: string,
    failureReason: string
  ): EmailOptions => ({
    to: '',
    subject: `🚨 Payment Failure Alert - ${gateway.toUpperCase()} Transaction Failed`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <h1 style="color: #DC2626; text-align: center;">🚨 Payment Failure Alert!</h1>

        <div style="background: linear-gradient(135deg, #DC2626 0%, #991B1B 100%); padding: 20px; border-radius: 10px; margin: 20px 0;">
          <h2 style="color: white; margin: 0; text-align: center;">Payment Processing Failed</h2>
        </div>

        <div style="background: #FEF2F2; border: 1px solid #FECACA; padding: 30px; border-radius: 10px; margin: 20px 0;">
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #DC2626;">
            <h3 style="color: #DC2626; margin-top: 0;">Payment Details:</h3>
            <div style="margin-bottom: 15px;">
              <strong style="color: #666;">User ID:</strong>
              <code style="background: #F3F4F6; color: #374151; padding: 2px 6px; border-radius: 3px; font-family: monospace; margin-left: 10px;">${userId}</code>
            </div>
            <div style="margin-bottom: 15px;">
              <strong style="color: #666;">Amount:</strong>
              <span style="background: #FEF2F2; color: #DC2626; padding: 4px 8px; border-radius: 4px; font-weight: bold; margin-left: 10px;">${currency} ${amount.toLocaleString()}</span>
            </div>
            <div style="margin-bottom: 15px;">
              <strong style="color: #666;">Payment Gateway:</strong>
              <span style="background: #E0E7FF; color: #3730A3; padding: 4px 8px; border-radius: 4px; margin-left: 10px;">${gateway.toUpperCase()}</span>
            </div>
            <div style="margin-bottom: 15px;">
              <strong style="color: #666;">Transaction ID:</strong>
              <code style="background: #F3F4F6; color: #374151; padding: 2px 6px; border-radius: 3px; font-family: monospace; margin-left: 10px;">${transactionId}</code>
            </div>
            <div style="margin-bottom: 15px;">
              <strong style="color: #666;">Failure Reason:</strong>
              <div style="background: #F9FAFB; padding: 10px; border-radius: 4px; font-family: monospace; color: #374151; margin-top: 5px;">
                ${failureReason}
              </div>
            </div>
            <div style="margin-bottom: 0;">
              <strong style="color: #666;">Timestamp:</strong>
              <span style="color: #6B7280; font-family: monospace; margin-left: 10px;">${new Date().toLocaleString()}</span>
            </div>
          </div>

          <div style="background: #FFF5F5; border: 1px solid #FEB2B2; padding: 15px; border-radius: 8px; margin-top: 20px;">
            <h4 style="color: #C53030; margin-top: 0;">⚠️ Revenue Impact:</h4>
            <ul style="color: #742A2A; margin: 10px 0; padding-left: 20px;">
              <li>This payment failure resulted in lost revenue of ${currency} ${amount.toLocaleString()}</li>
              <li>Monitor for patterns - multiple failures may indicate gateway issues</li>
              <li>Contact the user to resolve payment issues</li>
              <li>Check gateway dashboard for additional failure details</li>
            </ul>
          </div>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.NEXTAUTH_URL}/admin" style="background: #DC2626; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold;">View Admin Dashboard</a>
        </div>

        <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
          <p>Fake Detector - Payment Monitoring Alert</p>
          <p>This is an automated notification for payment processing failures.</p>
        </div>
      </div>
    `,
    text: `
      🚨 Payment Failure Alert!

      Payment Processing Failed

      Payment Details:
      - User ID: ${userId}
      - Amount: ${currency} ${amount.toLocaleString()}
      - Payment Gateway: ${gateway.toUpperCase()}
      - Transaction ID: ${transactionId}
      - Failure Reason: ${failureReason}
      - Timestamp: ${new Date().toLocaleString()}

      Revenue Impact:
      • Lost revenue of ${currency} ${amount.toLocaleString()}
      • Monitor for patterns - multiple failures may indicate gateway issues
      • Contact the user to resolve payment issues
      • Check gateway dashboard for additional failure details

      This is an automated notification for payment processing failures.
    `
  }),

  aiProviderError: (
    provider: string,
    errorMessage: string,
    userPlan?: string,
    userId?: string
  ): EmailOptions => ({
    to: '',
    subject: `🚨 AI Provider Error: ${provider.toUpperCase()} Quota/Billing Issue`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <h1 style="color: #DC2626; text-align: center;">🚨 AI Provider Error Alert!</h1>

        <div style="background: linear-gradient(135deg, #DC2626 0%, #991B1B 100%); padding: 20px; border-radius: 10px; margin: 20px 0;">
          <h2 style="color: white; margin: 0; text-align: center;">${provider.toUpperCase()} API Issue Detected</h2>
        </div>

        <div style="background: #FEF2F2; border: 1px solid #FECACA; padding: 30px; border-radius: 10px; margin: 20px 0;">
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #DC2626;">
            <h3 style="color: #DC2626; margin-top: 0;">Error Details:</h3>
            <div style="margin-bottom: 15px;">
              <strong style="color: #666;">Provider:</strong>
              <span style="background: #FEE2E2; color: #DC2626; padding: 4px 8px; border-radius: 4px; font-weight: bold;">${provider.toUpperCase()}</span>
            </div>
            <div style="margin-bottom: 15px;">
              <strong style="color: #666;">Error Message:</strong>
              <div style="background: #F9FAFB; padding: 10px; border-radius: 4px; font-family: monospace; color: #374151; margin-top: 5px;">
                ${errorMessage}
              </div>
            </div>
            ${userPlan ? `
            <div style="margin-bottom: 15px;">
              <strong style="color: #666;">User Plan:</strong>
              <span style="background: #E0E7FF; color: #3730A3; padding: 4px 8px; border-radius: 4px;">${userPlan}</span>
            </div>
            ` : ''}
            ${userId ? `
            <div style="margin-bottom: 15px;">
              <strong style="color: #666;">User ID:</strong>
              <code style="background: #F3F4F6; color: #374151; padding: 2px 6px; border-radius: 3px; font-family: monospace;">${userId}</code>
            </div>
            ` : ''}
            <div style="margin-bottom: 0;">
              <strong style="color: #666;">Timestamp:</strong>
              <span style="color: #6B7280; font-family: monospace;">${new Date().toLocaleString()}</span>
            </div>
          </div>

          <div style="background: #FFF5F5; border: 1px solid #FEB2B2; padding: 15px; border-radius: 8px; margin-top: 20px;">
            <h4 style="color: #C53030; margin-top: 0;">⚠️ Action Required:</h4>
            <ul style="color: #742A2A; margin: 10px 0; padding-left: 20px;">
              <li>Check your ${provider} billing dashboard</li>
              <li>Verify API quota limits and usage</li>
              <li>Consider upgrading your ${provider} plan</li>
              <li>Monitor affected user requests</li>
            </ul>
          </div>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="https://console.${provider === 'google' ? 'cloud' : provider}.google.com/billing" style="background: #DC2626; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold;">Check ${provider.toUpperCase()} Billing</a>
        </div>

        <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
          <p>Fake Products Detector - System Alert</p>
          <p>This is an automated notification for API quota/billing issues.</p>
        </div>
      </div>
    `,
    text: `
      🚨 AI Provider Error Alert!

      ${provider.toUpperCase()} API Issue Detected

      Error Details:
      - Provider: ${provider.toUpperCase()}
      - Error Message: ${errorMessage}
      ${userPlan ? `- User Plan: ${userPlan}` : ''}
      ${userId ? `- User ID: ${userId}` : ''}
      - Timestamp: ${new Date().toLocaleString()}

      Action Required:
      • Check your ${provider} billing dashboard
      • Verify API quota limits and usage
      • Consider upgrading your ${provider} plan
      • Monitor affected user requests

      This is an automated notification for API quota/billing issues.
    `
  }),
}

// Email service class
export class EmailService {
  static async sendWelcomeEmail(email: string, userName: string): Promise<void> {
    const template = emailTemplates.welcome(userName)
    template.to = email
    await sendEmail(template)
  }

  static async sendDailyPointsNotification(email: string, userName: string, currentBalance: number): Promise<void> {
    const template = emailTemplates.dailyPointsGranted(userName, currentBalance)
    template.to = email
    await sendEmail(template)
  }

  static async sendProductScanResult(
    email: string,
    userName: string,
    productName: string,
    result: 'genuine' | 'counterfeit',
    summary: string,
    resultId: string,
    pointsUsed: number,
    remainingPoints: number
  ): Promise<void> {
    const template = emailTemplates.productAlert(userName, productName, result, summary, resultId, pointsUsed, remainingPoints)
    template.to = email
    await sendEmail(template)
  }

  static async sendPaymentConfirmation(
    email: string,
    userName: string,
    amount: number,
    pointsPurchased: number,
    transactionId: string,
    newBalance: number
  ): Promise<void> {
    const template = emailTemplates.paymentSuccessful(userName, amount, pointsPurchased, transactionId, newBalance)
    template.to = email
    await sendEmail(template)
  }

  static async sendPaymentFailure(
    adminEmail: string,
    userId: string,
    amount: number,
    currency: string,
    gateway: string,
    transactionId: string,
    failureReason: string
  ): Promise<void> {
    const template = emailTemplates.paymentFailure(userId, amount, currency, gateway, transactionId, failureReason)
    template.to = adminEmail
    await sendEmail(template)
  }

  static async sendSystemHealthAlert(
    adminEmail: string,
    alertTitle: string,
    issues: Array<{
      metric: string
      value: number
      threshold: number
      status: string
      message: string
    }>,
    severity: 'warning' | 'critical'
  ): Promise<void> {
    const issuesSummary = issues.map(issue =>
      `• ${issue.metric}: ${issue.value.toFixed(1)} (threshold: ${issue.threshold}) - ${issue.status}`
    ).join('\n')

    const emailSubject = `${alertTitle} - ${issues.length} System Issues Detected`
    const emailHtml = `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <h1 style="color: ${severity === 'critical' ? '#DC2626' : '#D97706'}; text-align: center;">${alertTitle}</h1>

        <div style="background: ${severity === 'critical' ? '#FEF2F2' : '#FFFBEB'}; border: 1px solid ${severity === 'critical' ? '#FECACA' : '#FDE68A'}; padding: 30px; border-radius: 10px; margin: 20px 0;">
          <h2 style="color: ${severity === 'critical' ? '#C53030' : '#92400E'}; margin-top: 0;">System Health Issues Detected</h2>

          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #374151;">Issues Summary:</h3>
            <ul style="color: #4B5563; line-height: 1.6;">
              ${issues.map(issue => `
                <li><strong>${issue.metric}:</strong> ${issue.value.toFixed(1)} (threshold: ${issue.threshold}) - <span style="color: ${issue.status === 'critical' ? '#DC2626' : '#D97706'};">${issue.status}</span></li>
              `).join('')}
            </ul>
          </div>

          <div style="background: ${severity === 'critical' ? '#FFF5F5' : '#FFFEF5'}; border: 1px solid ${severity === 'critical' ? '#FEB2B2' : '#FDE047'}; padding: 15px; border-radius: 8px; margin-top: 20px;">
            <h4 style="color: ${severity === 'critical' ? '#C53030' : '#92400E'}; margin-top: 0;">Recommended Actions:</h4>
            <ul style="color: ${severity === 'critical' ? '#742A2A' : '#78350F'}; margin: 10px 0; padding-left: 20px;">
              <li>Check system resources and scaling requirements</li>
              <li>Review recent error logs for patterns</li>
              <li>Monitor affected services closely</li>
              <li>${severity === 'critical' ? 'Consider emergency maintenance' : 'Schedule maintenance if issues persist'}</li>
            </ul>
          </div>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.NEXTAUTH_URL}/admin" style="background: #1E40AF; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold;">View Admin Dashboard</a>
        </div>

        <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
          <p>Fake Products Detector - System Health Monitor</p>
          <p>This is an automated system health alert.</p>
          <p>Timestamp: ${new Date().toLocaleString()}</p>
        </div>
      </div>
    `

    await sendEmail({
      to: adminEmail,
      subject: emailSubject,
      html: emailHtml
    })
  }

  static async sendSecurityAlert(
    adminEmail: string,
    alertTitle: string,
    eventType: string,
    severity: string,
    userId: string | undefined,
    ipAddress: string | undefined,
    details: Record<string, unknown>
  ): Promise<void> {
    const emailSubject = alertTitle
    const emailHtml = `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <h1 style="color: #DC2626; text-align: center;">${alertTitle}</h1>

        <div style="background: #FEF2F2; border: 1px solid #FECACA; padding: 30px; border-radius: 10px; margin: 20px 0;">
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #DC2626;">
            <h3 style="color: #DC2626; margin-top: 0;">Security Event Details:</h3>
            <div style="margin-bottom: 15px;">
              <strong style="color: #666;">Event Type:</strong>
              <span style="background: #FEE2E2; color: #DC2626; padding: 4px 8px; border-radius: 4px; font-weight: bold; margin-left: 10px;">${eventType.replace('_', ' ').toUpperCase()}</span>
            </div>
            <div style="margin-bottom: 15px;">
              <strong style="color: #666;">Severity:</strong>
              <span style="background: #FEE2E2; color: #DC2626; padding: 4px 8px; border-radius: 4px; font-weight: bold; margin-left: 10px;">${severity.toUpperCase()}</span>
            </div>
            ${userId ? `
            <div style="margin-bottom: 15px;">
              <strong style="color: #666;">User ID:</strong>
              <code style="background: #F3F4F6; color: #374151; padding: 2px 6px; border-radius: 3px; font-family: monospace; margin-left: 10px;">${userId}</code>
            </div>
            ` : ''}
            ${ipAddress ? `
            <div style="margin-bottom: 15px;">
              <strong style="color: #666;">IP Address:</strong>
              <code style="background: #F3F4F6; color: #374151; padding: 2px 6px; border-radius: 3px; font-family: monospace; margin-left: 10px;">${ipAddress}</code>
            </div>
            ` : ''}
            <div style="margin-bottom: 15px;">
              <strong style="color: #666;">Details:</strong>
              <div style="background: #F9FAFB; padding: 10px; border-radius: 4px; font-family: monospace; color: #374151; margin-top: 5px;">
                ${JSON.stringify(details, null, 2)}
              </div>
            </div>
            <div style="margin-bottom: 0;">
              <strong style="color: #666;">Timestamp:</strong>
              <span style="color: #6B7280; font-family: monospace; margin-left: 10px;">${new Date().toLocaleString()}</span>
            </div>
          </div>

          <div style="background: #FFF5F5; border: 1px solid #FEB2B2; padding: 15px; border-radius: 8px; margin-top: 20px;">
            <h4 style="color: #C53030; margin-top: 0;">⚠️ Recommended Actions:</h4>
            <ul style="color: #742A2A; margin: 10px 0; padding-left: 20px;">
              <li>Review user activity and IP addresses</li>
              <li>Check authentication logs for patterns</li>
              <li>Consider temporary account suspension if suspicious</li>
              <li>Monitor for additional security events</li>
              <li>Update security policies if needed</li>
            </ul>
          </div>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.NEXTAUTH_URL}/admin" style="background: #DC2626; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold;">View Admin Dashboard</a>
        </div>

        <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
          <p>Fake Products Detector - Security Monitoring Alert</p>
          <p>This is an automated security notification.</p>
        </div>
      </div>
    `

    await sendEmail({
      to: adminEmail,
      subject: emailSubject,
      html: emailHtml
    })
  }

  static async sendAIProviderError(
    adminEmail: string,
    provider: string,
    errorMessage: string,
    userPlan?: string,
    userId?: string
  ): Promise<void> {
    const template = emailTemplates.aiProviderError(provider, errorMessage, userPlan, userId)
    template.to = adminEmail
    await sendEmail(template)
  }
}
