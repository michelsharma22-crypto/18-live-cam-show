#!/bin/bash

# Simple script to create .env.local file
# Run with: bash scripts/create-env.sh

if [ -f ".env.local" ]; then
  echo ""
  echo "⚠️  .env.local file already exists!"
  echo ""
  echo "Current content:"
  echo "────────────────────────────────────────"
  cat .env.local
  echo "────────────────────────────────────────"
  echo ""
  echo "💡 Delete the file first if you want to recreate it:"
  echo "   rm .env.local && bash scripts/create-env.sh"
else
  cat > .env.local << 'EOF'
# ===========================================
# Environment Configuration
# ===========================================
# Fill in your values below and save the file
# ===========================================

# PayPal Configuration
PAYPAL_CLIENT_ID=your_paypal_client_id_here
PAYPAL_CLIENT_SECRET=your_paypal_client_secret_here

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id_here
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id_here
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id_here

# Agora Configuration
NEXT_PUBLIC_AGORA_APP_ID=your_agora_app_id_here

# Cloudinary Configuration
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name_here
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your_upload_preset_here
EOF

  echo ""
  echo "✅ .env.local file created successfully!"
  echo ""
  echo "🔧 Next steps:"
  echo "   1. Edit .env.local with your actual credentials"
  echo "   2. Save the file"
  echo "   3. Restart the dev server"
  echo ""
fi
