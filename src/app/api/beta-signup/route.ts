import { NextRequest, NextResponse } from 'next/server'
import { Logger } from '@/lib/logger'
import nodemailer from 'nodemailer'

// Email configuration following Next.js best practices
const emailConfig = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
}

// Create reusable transporter object using the default SMTP transport
let transporter: nodemailer.Transporter

function getEmailTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport(emailConfig)
  }
  return transporter
}

interface BetaFormData {
  name: string
  email: string
  platform: 'android' | 'ios' | 'both'
  whatsapp: string
}

export async function POST(request: NextRequest) {
  try {
    // Parse form data from request body
    const body = await request.json() as BetaFormData
    const { name, email, platform, whatsapp } = body

    // Validate required fields
    if (!name || !email || !platform || !whatsapp) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Please provide a valid email address' },
        { status: 400 }
      )
    }

    // Log the beta signup
    Logger.info('Beta program signup', { name, email, platform, whatsapp })

    // Format platform display
    const platformDisplay = {
      android: '📱 Android Only',
      ios: '🍎 iOS Only',
      both: '📱🍎 Both Android & iOS'
    }[platform] || platform

    // Format beta signup email
    const betaSignupEmailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Beta Program Signup</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #FF6B35 0%, #F7931E 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .field { margin-bottom: 20px; }
            .label { font-weight: bold; color: #1E40AF; }
            .value { background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #FF6B35; margin-top: 5px; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            .highlight { background: #fff3cd; border-left-color: #ffc107; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🚀 New Beta Program Signup</h1>
            <p>Someone wants to join the Fake Detector Beta Program!</p>
          </div>

          <div class="content">
            <div class="field">
              <div class="label">👤 Full Name:</div>
              <div class="value">${name}</div>
            </div>

            <div class="field">
              <div class="label">✉️ Email:</div>
              <div class="value">${email}</div>
            </div>

            <div class="field">
              <div class="label">📱 Platform:</div>
              <div class="value highlight">${platformDisplay}</div>
            </div>

            <div class="field">
              <div class="label">💬 WhatsApp:</div>
              <div class="value">${whatsapp}</div>
            </div>
          </div>

          <div class="footer">
            <p><strong>Next Steps:</strong> Contact them via WhatsApp to provide app download instructions</p>
            <p>Submitted: ${new Date().toLocaleString()}</p>
          </div>
        </body>
      </html>
    `

    const betaSignupEmailText = `
      New Beta Program Signup

      Name: ${name}
      Email: ${email}
      Platform: ${platformDisplay}
      WhatsApp: ${whatsapp}

      Next Steps: Contact them via WhatsApp to provide app download instructions
      Submitted: ${new Date().toLocaleString()}
    `

    // Send email to sampidia0@gmail.com
    const transporter = getEmailTransporter()
    const emailResult = await transporter.sendMail({
      from: 'hr@sampidia.com.ng',
      to: 'sampidia0@gmail.com',
      subject: `Beta Program Signup: ${name} - ${platformDisplay}`,
      html: betaSignupEmailHtml,
      text: betaSignupEmailText,
    })

    if (emailResult.messageId) {
      Logger.info('Beta signup email sent successfully', {
        name,
        email,
        messageId: emailResult.messageId
      })

      return NextResponse.json(
        {
          success: true,
          message: 'Successfully joined beta program! We will contact you soon.'
        },
        { status: 200 }
      )
    } else {
      Logger.error('Failed to send beta signup email', { name, email })
      return NextResponse.json(
        { error: 'Failed to send email. Please try again.' },
        { status: 500 }
      )
    }

  } catch (error) {
    Logger.error('Beta signup error', { error })
    return NextResponse.json(
      { error: 'Internal server error. Please try again later.' },
      { status: 500 }
    )
  }
}

// Handle unsupported methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}
