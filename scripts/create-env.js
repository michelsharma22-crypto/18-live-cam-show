/**
 * Script to create .env.local file with placeholders
 * Run with: node scripts/create-env.js
 * 
 * This script creates a .env.local file with all required environment variables
 * for the Live Streaming application.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const envContent = `# ===========================================
# Environment Configuration
# ===========================================
# Fill in your values below and save the file
# Then restart the dev server for changes to take effect
# ===========================================

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id_here
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id_here
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id_here

# Agora Configuration (Video Streaming)
NEXT_PUBLIC_AGORA_APP_ID=your_agora_app_id_here

# PayPal Configuration (Payments)
NEXT_PUBLIC_PAYPAL_CLIENT_ID=your_paypal_client_id_here
NEXT_PUBLIC_PAYPAL_CLIENT_SECRET=your_paypal_client_secret_here
NEXT_PUBLIC_PAYPAL_LIVE_MODE=false

# Cloudinary Configuration (Image Uploads)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name_here
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your_upload_preset_here

# Oxapay Configuration (Crypto Payments)
OXAPAY_MERCHANT_ID=your_merchant_id_here
`

const envPath = path.join(__dirname, '..', '.env.local')

// Check if file already exists
if (fs.existsSync(envPath)) {
  console.log('\n⚠️  .env.local file already exists!\n')
  console.log('📝 Current content:\n')
  console.log('─'.repeat(50))
  console.log(fs.readFileSync(envPath, 'utf8'))
  console.log('─'.repeat(50))
  console.log('\n💡 If you want to recreate it:')
  console.log('   1. Delete the existing .env.local file')
  console.log('   2. Run this script again: node scripts/create-env.js\n')
} else {
  // Create the file
  fs.writeFileSync(envPath, envContent, 'utf8')
  console.log('\n✅ .env.local file created successfully!')
  console.log('📝 Location:', envPath)
  console.log('\n🔧 Next steps:')
  console.log('   1. Open .env.local in your file editor')
  console.log('   2. Replace all placeholder values with your actual credentials:')
  console.log('      - Firebase: https://console.firebase.google.com/')
  console.log('      - Agora: https://console.agora.io/')
  console.log('      - PayPal: https://developer.paypal.com/dashboard/')
  console.log('   3. Save the file')
  console.log('   4. Restart the dev server (or it will auto-reload)\n')
}
