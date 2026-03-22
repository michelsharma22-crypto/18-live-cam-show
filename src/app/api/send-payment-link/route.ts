import { NextRequest, NextResponse } from 'next/server'

// POST - Send payment link email
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { to, subject, userName, amount, walletAddress, trackId, paymentLink } = body

    // Validate required fields
    if (!to || !userName || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // In production, use a real email service like SendGrid, Mailgun, or AWS SES
    // For now, we'll log the email details and return success
    console.log('📧 Payment Link Email:')
    console.log('To:', to)
    console.log('Subject:', subject || `Payment Link for ${userName}`)
    console.log('User:', userName)
    console.log('Amount:', amount)
    console.log('Wallet:', walletAddress)
    console.log('Track ID:', trackId)
    console.log('Payment Link:', paymentLink)

    // Generate HTML email content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Payment Link</title>
      </head>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #831843, #581c87); padding: 30px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; text-align: center;">🔥 LiveStream Payment</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; color: #333;">Hello Admin,</p>
          <p style="font-size: 16px; color: #333;">A payment link has been requested for the following withdrawal:</p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e0e0e0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">User:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #333;">${userName}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Amount:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #22c55e;">$${amount}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Wallet (TRC20):</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #333; word-break: break-all;">${walletAddress || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #666;">Track ID:</td>
                <td style="padding: 10px 0; font-weight: bold; color: #333;">${trackId || 'N/A'}</td>
              </tr>
            </table>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${paymentLink}" style="background: linear-gradient(135deg, #ec4899, #8b5cf6); color: white; padding: 15px 40px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">
              Claim Payment
            </a>
          </div>
          
          <p style="font-size: 14px; color: #666; text-align: center; margin-top: 30px;">
            Or copy this link: <br/>
            <a href="${paymentLink}" style="color: #ec4899; word-break: break-all;">${paymentLink}</a>
          </p>
          
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
          
          <p style="font-size: 12px; color: #999; text-align: center;">
            This is an automated message from LiveStream Payment System
          </p>
        </div>
      </body>
      </html>
    `

    // Log the HTML for debugging
    console.log('HTML Content generated')

    // In production, you would send the email here using a service like:
    // - SendGrid
    // - Mailgun
    // - AWS SES
    // - Resend
    
    // Example with a hypothetical email service:
    // await sendEmail({
    //   to,
    //   subject: subject || `Payment Link for ${userName}`,
    //   html: htmlContent
    // })

    return NextResponse.json({
      success: true,
      message: 'Email notification logged',
      email: {
        to,
        subject: subject || `Payment Link for ${userName}`,
        htmlGenerated: true
      }
    })
  } catch (error) {
    console.error('Send payment link error:', error)
    return NextResponse.json(
      { error: 'Failed to send payment link' },
      { status: 500 }
    )
  }
}
