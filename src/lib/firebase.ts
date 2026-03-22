import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app'
import { getAuth, Auth } from 'firebase/auth'
import { getFirestore, Firestore } from 'firebase/firestore'
import { getFirebaseConfig } from './config'

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null

export function isFirebaseAvailable(): boolean {
  const config = getFirebaseConfig()
  return !!(config.apiKey && config.authDomain && config.projectId)
}

export function getFirebaseApp(): FirebaseApp | null {
  if (app) return app
  
  if (!isFirebaseAvailable()) {
    console.warn('Firebase is not configured. Please set up your Firebase environment variables.')
    return null
  }

  try {
    app = getApps().length > 0 ? getApp() : initializeApp(getFirebaseConfig())
    return app
  } catch (error) {
    console.error('Failed to initialize Firebase:', error)
    return null
  }
}

export function getFirebaseAuth(): Auth | null {
  if (auth) return auth
  
  const firebaseApp = getFirebaseApp()
  if (!firebaseApp) return null

  try {
    auth = getAuth(firebaseApp)
    return auth
  } catch (error) {
    console.error('Failed to initialize Firebase Auth:', error)
    return null
  }
}

export function getFirebaseDb(): Firestore | null {
  if (db) return db
  
  const firebaseApp = getFirebaseApp()
  if (!firebaseApp) return null

  try {
    db = getFirestore(firebaseApp)
    return db
  } catch (error) {
    console.error('Failed to initialize Firestore:', error)
    return null
  }
}

// Initialize on module load (client-side only)
if (typeof window !== 'undefined') {
  getFirebaseApp()
}
