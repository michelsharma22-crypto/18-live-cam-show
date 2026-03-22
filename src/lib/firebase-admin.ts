import * as admin from 'firebase-admin'

let adminApp: admin.app.App | null = null
let adminDb: admin.firestore.Firestore | null = null
let adminAuth: admin.auth.Auth | null = null

// Service account configuration from environment variables
const getServiceAccount = () => ({
  projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
})

export function isFirebaseAdminConfigured(): boolean {
  const sa = getServiceAccount()
  return !!(sa.projectId && sa.clientEmail && sa.privateKey)
}

function initializeApp(): admin.app.App | null {
  if (!isFirebaseAdminConfigured()) {
    console.warn('Firebase Admin is not configured. Please set up service account credentials.')
    return null
  }

  try {
    if (admin.apps.length > 0) {
      return admin.app()
    }
    
    const app = admin.initializeApp({
      credential: admin.credential.cert(getServiceAccount() as admin.ServiceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    })
    return app
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error)
    return null
  }
}

export function getFirebaseAdminApp(): admin.app.App | null {
  if (adminApp) return adminApp
  adminApp = initializeApp()
  return adminApp
}

export function getAdminFirestore(): admin.firestore.Firestore | null {
  if (adminDb) return adminDb
  
  const app = getFirebaseAdminApp()
  if (!app) return null

  try {
    // Disable telemetry to avoid OpenTelemetry dependency issues
    adminDb = app.firestore()
    adminDb.settings({
      ignoreUndefinedProperties: true,
    })
    return adminDb
  } catch (error) {
    console.error('Failed to initialize Firestore Admin:', error)
    return null
  }
}

export function getAdminAuth(): admin.auth.Auth | null {
  if (adminAuth) return adminAuth
  
  const app = getFirebaseAdminApp()
  if (!app) return null

  try {
    adminAuth = admin.auth(app)
    return adminAuth
  } catch (error) {
    console.error('Failed to initialize Auth Admin:', error)
    return null
  }
}

// Helper function to verify ID token
export async function verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken | null> {
  const auth = getAdminAuth()
  if (!auth) return null
  
  try {
    const decodedToken = await auth.verifyIdToken(idToken)
    return decodedToken
  } catch (error) {
    console.error('Failed to verify ID token:', error)
    return null
  }
}

// Admin UIDs and emails
export const ADMIN_UIDS = ['GowHbJJEbxVBEJySqirLyLSIjtz2']
export const ADMIN_EMAILS = ['yns19971020@gmail.com']

export function isAdminUser(uid: string, email?: string): boolean {
  return ADMIN_UIDS.includes(uid) || (email && ADMIN_EMAILS.includes(email))
}
