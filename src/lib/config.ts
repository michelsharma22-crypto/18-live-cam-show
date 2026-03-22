// Firebase and third-party service configuration
// These values should be set in your .env.local file

export function getFirebaseConfig() {
  return {
    // Firebase Configuration
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
    
    // Agora for video streaming
    agoraAppId: process.env.NEXT_PUBLIC_AGORA_APP_ID || '',
    
    // Cloudinary for image uploads
    cloudinaryCloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '',
    cloudinaryUploadPreset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || '',
    
    // OxaPay for USDT TRC20 payments (Two-key system)
    // Merchant Key - Use for generating payment requests/Top Ups
    oxapayMerchantKey: process.env.OXAPAY_MERCHANT_KEY || 'NWWDFT-WOUARY-YTVKMH-HSWAJW',
    // API Key - Use for status checks and admin-related tasks
    oxapayApiKey: process.env.OXAPAY_API_KEY || 'FB15BH-N6MHUV-7BDCX7-YMQKJR',
    
    // USDT Direct System API Key
    usdtApiKey: process.env.USDT_API_KEY || 'Rl3kI0BbXhkTpQUM',
    
    // App URL for callbacks
    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://18-live-cam-show.vercel.app',
  }
}

export function isFirebaseConfigured(): boolean {
  const config = getFirebaseConfig()
  return !!(config.apiKey && config.projectId)
}

export function isOxaPayConfigured(): boolean {
  const config = getFirebaseConfig()
  return !!(config.oxapayMerchantKey && config.oxapayApiKey)
}

export function isAgoraConfigured(): boolean {
  const config = getFirebaseConfig()
  return !!config.agoraAppId
}

// Helper to check all required configs
export function checkRequiredConfigs() {
  const config = getFirebaseConfig()
  const missing: string[] = []
  
  if (!config.apiKey) missing.push('NEXT_PUBLIC_FIREBASE_API_KEY')
  if (!config.projectId) missing.push('NEXT_PUBLIC_FIREBASE_PROJECT_ID')
  if (!config.agoraAppId) missing.push('NEXT_PUBLIC_AGORA_APP_ID')
  if (!config.cloudinaryCloudName) missing.push('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME')
  if (!config.oxapayMerchantKey) missing.push('OXAPAY_MERCHANT_KEY')
  if (!config.oxapayApiKey) missing.push('OXAPAY_API_KEY')
  
  return {
    isComplete: missing.length === 0,
    missing
  }
}
