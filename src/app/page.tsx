'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth'
import { doc, setDoc, getDoc, updateDoc, onSnapshot, collection, increment, arrayUnion, arrayRemove, Timestamp, addDoc } from 'firebase/firestore'
import { getFirebaseAuth, getFirebaseDb, isFirebaseAvailable } from '@/lib/firebase'
import { getFirebaseConfig } from '@/lib/config'

interface UserProfile {
  uid: string
  displayName: string
  coins: number
  bio: string
  photoURL: string
  country: string
  city?: string
  phone?: string
  age: number
  gender: string
  islive: boolean
  lastBonus: number
  email?: string
  language?: string
  birthday?: string
  followers?: string[]
  following?: string[]
  isOnline?: boolean
  lastSeen?: Timestamp
  isPremium?: boolean
  isAdmin?: boolean
  hasUsedFirstTimeOffer?: boolean
  // Verification Package System
  hasPurchasedVerificationPackage?: boolean
  verificationPackagePurchasedAt?: Timestamp
  totalAdminCommissionPaid?: number
}

interface ChatMessage {
  id: string
  text: string
  sender: string
  senderName: string
  senderPhoto: string
  timestamp: number
}

interface Notification {
  id: string
  type: string
  message: string
  fromUid?: string
  fromPhoto?: string
  timestamp?: Timestamp
  read: boolean
}

interface GiftItem {
  emoji: string
  cost: number
  name: string
}

interface TopUpPackage {
  price: number
  coins: number
  isVIP?: boolean
  isOffer?: boolean
  originalCoins?: number
}

interface WithdrawalRequest {
  id: string
  uid: string
  displayName: string
  email?: string
  usdtWalletAddress: string
  amountInDollars: string
  coinsRedeemed: number
  status: 'pending' | 'approved' | 'rejected'
  timestamp?: Timestamp
  processedAt?: Timestamp
  paymentMethod?: 'usdt_trc20'
  paymentLink?: string
  trackId?: string
}

interface AgoraClient {
  join: (appId: string, channel: string, token: string | null, uid: string | null) => Promise<void>
  leave: () => Promise<void>
  publish: (tracks: unknown[]) => Promise<void>
  subscribe: (user: AgoraRemoteUser, mediaType: string) => Promise<void>
  setClientRole: (role: string) => Promise<void>
  on: (event: string, callback: (...args: unknown[]) => void) => void
}

interface AgoraRemoteUser {
  uid: string
  videoTrack?: AgoraTrack
  audioTrack?: AgoraTrack
}

interface AgoraTrack {
  play: (elementId: string) => void
  stop: () => void
  close: () => void
  setEnabled: (enabled: boolean) => void
}

interface WindowExtensions {
  AgoraRTC?: {
    createClient: (config: { mode: string; codec: string }) => AgoraClient
    createMicrophoneAndCameraTracks: () => Promise<AgoraTrack[]>
  }
  localStorage?: Storage
  hilltopads_config?: {
    zones: {
      interstitial: string
      rewarded: string
      native: string
    }
    onAdComplete: (type: string) => void
    onAdError: (type: string, error: string) => void
    onAdStarted: (type: string) => void
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Window extends WindowExtensions {}
}

// Romantic Gift Items - 12 Premium Gifts with Glassmorphism Design
const GIFTS: GiftItem[] = [
  { emoji: '🌹', cost: 50, name: 'Red Rose' },
  { emoji: '💍', cost: 500, name: 'Diamond Ring' },
  { emoji: '🥂', cost: 200, name: 'Champagne' },
  { emoji: '💘', cost: 100, name: "Cupid's Arrow" },
  { emoji: '⌚', cost: 1000, name: 'Luxury Watch' },
  { emoji: '❤️‍🔥', cost: 150, name: 'Heart Balloon' },
  { emoji: '🎀', cost: 75, name: 'Silk Ribbon' },
  { emoji: '🧴', cost: 300, name: 'Perfume' },
  { emoji: '🧸', cost: 250, name: 'Teddy Bear' },
  { emoji: '🍷', cost: 400, name: 'Wine Glass' },
  { emoji: '💌', cost: 80, name: 'Love Letter' },
  { emoji: '🗝️', cost: 2000, name: 'Golden Key' }
]

// ============================================
// COIN ECONOMY SYSTEM - $1 = 10,000 Coins
// ============================================
const WITHDRAW_RATE = 10000 // 10,000 coins = $1
const MIN_WITHDRAW_COINS = 150000 // $15 minimum withdrawal (150,000 coins)
const MIN_WITHDRAW_DOLLARS = 15 // $15 minimum withdrawal in dollars
const DAILY_BONUS_AMOUNT = 50 // 50 coins daily bonus
const PREMIUM_VIDEO_CALL_RATE = 28000 // 28,000 coins per minute
const PREMIUM_MESSAGE_COST = 100 // 100 coins per message

// Verification Package System - Required before first withdrawal
const VERIFICATION_PACKAGE_COST = 10000 // 10,000 coins = $1 verification package
const VERIFICATION_PACKAGE_DOLLARS = 1 // $1 verification package
const ADMIN_COMMISSION_RATE = 0.10 // 10% admin commission on withdrawals

// Ad Rewards System
const AD_REWARD_COINS = 50 // Coins earned per ad watch
const AD_WATCH_DURATION = 30 // Simulated ad duration in seconds
const DAILY_AD_LIMIT = 10 // Max ads per day for earning

// Top Up Packages - All prices based on $1 = 10,000 coins
const TOP_UP_PACKAGES: TopUpPackage[] = [
  { price: 1.00, coins: 10000 },      // $1 = 10,000 coins
  { price: 25.00, coins: 250000 },    // $25 = 250,000 coins
  { price: 50.00, coins: 500000 },    // $50 = 500,000 coins
  { price: 100.00, coins: 1000000 },  // $100 = 1,000,000 coins
  { price: 250.00, coins: 2500000, isVIP: true } // $250 = 2,500,000 coins
]

// First Time Offer - Special bonus for new users
const FIRST_TIME_OFFER: TopUpPackage = {
  price: 50.00,
  coins: 1500000,       // 1,500,000 coins for $50 (3x bonus!)
  originalCoins: 500000,
  isOffer: true
}

// Login Interstitial Timer Component - Auto-closes after ad duration
function LoginInterstitialTimer({ onComplete }: { onComplete: () => void }) {
  const [timeLeft, setTimeLeft] = useState(5) // 5 seconds ad

  useEffect(() => {
    if (timeLeft <= 0) {
      onComplete()
      return
    }

    const timer = setTimeout(() => {
      setTimeLeft(prev => prev - 1)
    }, 1000)

    return () => clearTimeout(timer)
  }, [timeLeft, onComplete])

  return (
    <div style={{
      background: 'rgba(249,115,22,0.2)',
      borderRadius: '9999px',
      padding: '0.5rem 1.5rem',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem'
    }}>
      <div className="spinner" style={{ 
        width: '16px', 
        height: '16px', 
        border: '2px solid rgba(255,255,255,0.2)', 
        borderTopColor: '#f97316',
        borderRadius: '50%'
      }}></div>
      <span style={{ color: 'white', fontSize: '0.875rem', fontWeight: '500' }}>
        {timeLeft}s
      </span>
    </div>
  )
}

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [mounted, setMounted] = useState(false)
  const [currentScreen, setCurrentScreen] = useState('home')
  const [showGiftPanel, setShowGiftPanel] = useState(false)
  const [showLiveScreen, setShowLiveScreen] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [isHostLive, setIsHostLive] = useState(false)
  const [currentHost, setCurrentHost] = useState<UserProfile | null>(null)
  const [currentHostId, setCurrentHostId] = useState('')
  const [viewers, setViewers] = useState(0)
  const [totalGifts, setTotalGifts] = useState(0)
  const [users, setUsers] = useState<UserProfile[]>([])
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [authEmail, setAuthEmail] = useState('')
  const [authPass, setAuthPass] = useState('')
  const [isLoginMode, setIsLoginMode] = useState(false)
  const [editName, setEditName] = useState('')
  const [editBio, setEditBio] = useState('')
  const [editAge, setEditAge] = useState('')
  const [editCountry, setEditCountry] = useState('')
  const [editCity, setEditCity] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editGender, setEditGender] = useState('Male')
  const [editBirthday, setEditBirthday] = useState('')
  const [editLang, setEditLang] = useState('')
  const [micEnabled, setMicEnabled] = useState(true)
  const [camEnabled, setCamEnabled] = useState(true)
  const [localTracks, setLocalTracks] = useState<AgoraTrack[]>([])
  const [remoteVideoTrack, setRemoteVideoTrack] = useState<AgoraTrack | null>(null)
  const agoraClientRef = useRef<AgoraClient | null>(null)
  const [agoraReady, setAgoraReady] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionError, setConnectionError] = useState('')
  const [showPremiumVideoCall, setShowPremiumVideoCall] = useState(false)
  const [premiumVideoCallUser, setPremiumVideoCallUser] = useState<UserProfile | null>(null)
  const [videoCallDuration, setVideoCallDuration] = useState(0)
  const [videoCallActive, setVideoCallActive] = useState(false)
  const [videoCallConnecting, setVideoCallConnecting] = useState(false)
  const videoCallTimerRef = useRef<NodeJS.Timeout | null>(null)
  const premiumVideoClientRef = useRef<AgoraClient | null>(null)
  const [premiumLocalTracks, setPremiumLocalTracks] = useState<AgoraTrack[]>([])
  const [premiumRemoteVideoTrack, setPremiumRemoteVideoTrack] = useState<AgoraTrack | null>(null)
  const [premiumVideoMicEnabled, setPremiumVideoMicEnabled] = useState(true)
  const [premiumVideoCamEnabled, setPremiumVideoCamEnabled] = useState(true)
  const [showUserModal, setShowUserModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [selectedPackage, setSelectedPackage] = useState<TopUpPackage | null>(null)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [adminTab, setAdminTab] = useState('users')
  const [platformEarnings, setPlatformEarnings] = useState({ totalCommission: 0, totalWithdrawals: 0 })
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([])
  const [adminWithdrawAmount, setAdminWithdrawAmount] = useState('')
  const [adminUsdtWallet, setAdminUsdtWallet] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [showDailyBonus, setShowDailyBonus] = useState(false)
  const [dailyBonusData, setDailyBonusData] = useState<{
    currentDay: number
    lastClaimDate: string | null
    canClaim: boolean
    totalClaimed: number
  } | null>(null)
  const [manualCoinAmount, setManualCoinAmount] = useState('')
  const [premiumTab, setPremiumTab] = useState<'message' | 'video'>('message')
  const [chatRecipient, setChatRecipient] = useState<UserProfile | null>(null)
  const [showChatModal, setShowChatModal] = useState(false)
  const [privateMessages, setPrivateMessages] = useState<ChatMessage[]>([])
  const [privateMessageInput, setPrivateMessageInput] = useState('')
  // USDT TRC20 Wallet for withdrawals
  const [usdtWalletAddress, setUsdtWalletAddress] = useState('')
  const [trc20Confirmed, setTrc20Confirmed] = useState(false)
  const [showExitModal, setShowExitModal] = useState(false)
  const [showVerificationModal, setShowVerificationModal] = useState(false)
  const [verificationPurchasing, setVerificationPurchasing] = useState(false)
  const [showWithdrawalBlockedModal, setShowWithdrawalBlockedModal] = useState(false)

  // Ad Integration State
  const [showAdModal, setShowAdModal] = useState(false)
  const [adType, setAdType] = useState<'dailyBonus' | 'withdrawal' | 'earnCoins' | null>(null)
  const [adLoading, setAdLoading] = useState(false)
  const [adProgress, setAdProgress] = useState(0)
  const [adCompleted, setAdCompleted] = useState(false)
  const [adReward, setAdReward] = useState(0)

  // Free Coins - 10 Independent Ad Slots (3 ads each)
  const [adSlotStatus, setAdSlotStatus] = useState<Record<number, 'available' | 'watching' | 'completed'>>({})
  const [currentAdSlot, setCurrentAdSlot] = useState<number | null>(null)
  const [currentAdInSlot, setCurrentAdInSlot] = useState(1) // 1, 2, or 3
  const [showFreeCoinsModal, setShowFreeCoinsModal] = useState(false)
  const [loginInterstitialShown, setLoginInterstitialShown] = useState(false)
  const [showLoginInterstitial, setShowLoginInterstitial] = useState(false)

  const config = getFirebaseConfig()
  const AGORA_APP_ID = config.agoraAppId

  useEffect(() => {
    setMounted(true)
  }, [])

  const showToast = useCallback((message: string) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined' && !window.AgoraRTC) {
      // Mock localStorage if not available
      try {
        window.localStorage.getItem('test')
      } catch {
        const mockStorage: Record<string, string> = {}
        Object.defineProperty(window, 'localStorage', {
          value: {
            getItem: (k: string) => mockStorage[k] || null,
            setItem: (k: string, v: string) => { mockStorage[k] = v },
            removeItem: (k: string) => { delete mockStorage[k] },
            clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]) },
            key: (i: number) => Object.keys(mockStorage)[i] || null,
            get length() { return Object.keys(mockStorage).length }
          },
          writable: false,
          configurable: true
        })
      }
      const script = document.createElement('script')
      script.src = 'https://download.agora.io/sdk/release/AgoraRTC_N-4.18.2.js'
      script.async = true
      script.onload = () => setAgoraReady(true)
      document.body.appendChild(script)
    } else if (typeof window !== 'undefined' && window.AgoraRTC) {
      setAgoraReady(true)
    }
  }, [])

  // Load ad slot status from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && firebaseUser) {
      const savedStatus = localStorage.getItem(`adSlots_${firebaseUser.uid}`)
      if (savedStatus) {
        try {
          const parsed = JSON.parse(savedStatus)
          // Check if it's a new day - reset all slots at midnight
          const today = new Date().toDateString()
          const savedDate = localStorage.getItem(`adSlotsDate_${firebaseUser.uid}`)
          if (savedDate !== today) {
            // New day - reset all slots
            setAdSlotStatus({})
            localStorage.removeItem(`adSlots_${firebaseUser.uid}`)
          } else {
            setAdSlotStatus(parsed)
          }
        } catch {
          setAdSlotStatus({})
        }
      }
    }
  }, [firebaseUser])

  useEffect(() => {
    if (!mounted) return
    const auth = getFirebaseAuth()
    const db = getFirebaseDb()
    if (!auth || !db) {
      setLoading(false)
      return
    }
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setFirebaseUser(user)
        setIsAuthenticated(true)
        
        // Check if user profile exists, if not wait for it (new user registration)
        let userDoc = await getDoc(doc(db, 'profiles', user.uid))
        let retries = 0
        
        // Wait up to 5 seconds for the profile to be created (for new users)
        while (!userDoc.exists() && retries < 10) {
          await new Promise(resolve => setTimeout(resolve, 500))
          userDoc = await getDoc(doc(db, 'profiles', user.uid))
          retries++
        }
        
        if (userDoc.exists()) {
          const userData = userDoc.data() as UserProfile
          const ADMIN_UIDS = ['GowHbJJEbxVBEJySqirLyLSIjtz2']
          const ADMIN_EMAILS = ['yns19971020@gmail.com']
          const isAdminUser = ADMIN_UIDS.includes(user.uid) || ADMIN_EMAILS.includes(user.email || '')
          setCurrentUser({
            uid: user.uid,
            ...userData,
            isAdmin: userData.isAdmin || isAdminUser
          })
          setEditName(userData.displayName || '')
          setEditBio(userData.bio || '')
          setEditAge(userData.age?.toString() || '')
          setEditCountry(userData.country || '')
          setEditCity(userData.city || '')
          setEditPhone(userData.phone || '')
          setEditGender(userData.gender || 'Male')
          setEditBirthday(userData.birthday || '')
          setEditLang(userData.language || '')
          await updateDoc(doc(db, 'profiles', user.uid), { isOnline: true, lastSeen: Timestamp.now() })

          // Show interstitial ad on login (after user data is loaded)
          if (!loginInterstitialShown) {
            setLoginInterstitialShown(true)
            setShowLoginInterstitial(true)
          }
        } else {
          // User document doesn't exist - this shouldn't happen but handle gracefully
          console.error('User profile not found after registration')
          // Create profile for user if missing
          const defaultProfile = {
            displayName: user.email?.split('@')[0] || 'User',
            email: user.email || '',
            coins: 1000,
            bio: 'Hey there!',
            photoURL: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop',
            country: '',
            city: '',
            phone: '',
            age: 18,
            gender: 'Male',
            language: '',
            birthday: '',
            islive: false,
            lastBonus: Date.now(),
            followers: [],
            following: [],
            isOnline: true,
            lastSeen: Timestamp.now(),
            isPremium: false,
            isAdmin: false
          }
          await setDoc(doc(db, 'profiles', user.uid), defaultProfile)
          setCurrentUser({ uid: user.uid, ...defaultProfile })
          
          if (!loginInterstitialShown) {
            setLoginInterstitialShown(true)
            setShowLoginInterstitial(true)
          }
        }
      } else {
        setFirebaseUser(null)
        setIsAuthenticated(false)
        setCurrentUser(null)
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [mounted, loginInterstitialShown])

  useEffect(() => {
    const db = getFirebaseDb()
    if (!db || !isAuthenticated) return
    const unsubscribe = onSnapshot(
      collection(db, 'profiles'),
      (snapshot) => {
        const usersList: UserProfile[] = []
        snapshot.forEach((d) => {
          if (d.id !== firebaseUser?.uid) {
            usersList.push({ uid: d.id, ...d.data() } as UserProfile)
          }
        })
        setUsers(usersList)
      },
      (error) => {
        console.log('Profiles listener error:', error.message)
      }
    )
    return () => unsubscribe()
  }, [isAuthenticated, firebaseUser])

  useEffect(() => {
    if (isAuthenticated && firebaseUser) {
      checkDailyBonus()
    }
  }, [isAuthenticated, firebaseUser])

  useEffect(() => {
    const db = getFirebaseDb()
    if (!db || !firebaseUser) return
    const unsubscribe = onSnapshot(
      collection(db, 'notifications'),
      (snapshot) => {
        const notifList: Notification[] = []
        let unread = 0
        snapshot.forEach((d) => {
          const data = d.data()
          if (data.toUid === firebaseUser.uid) {
            notifList.push({ id: d.id, ...data } as Notification)
            if (!data.read) unread++
          }
        })
        setNotifications(notifList)
        setUnreadCount(unread)
      },
      (error) => {
        console.log('Notifications listener error:', error.message)
      }
    )
    return () => unsubscribe()
  }, [firebaseUser])

  useEffect(() => {
    const db = getFirebaseDb()
    if (!db || !showLiveScreen) return
    const chatId = currentHostId || firebaseUser?.uid
    if (!chatId) return
    const unsubscribe = onSnapshot(
      collection(db, 'livechats', chatId, 'messages'),
      (snapshot) => {
        const messagesList: ChatMessage[] = []
        snapshot.forEach((d) => {
          messagesList.push({ id: d.id, ...d.data() } as ChatMessage)
        })
        messagesList.sort((a, b) => a.timestamp - b.timestamp)
        setChatMessages(messagesList)
      },
      (error) => {
        console.log('Chat listener error:', error.message)
      }
    )
    return () => unsubscribe()
  }, [currentHostId, showLiveScreen, firebaseUser])

  useEffect(() => {
    const db = getFirebaseDb()
    if (!db) return
    const unsubscribe = onSnapshot(
      doc(db, 'platform', 'earnings'),
      (d) => {
        if (d.exists()) {
          setPlatformEarnings({
            totalCommission: d.data().totalCommission || 0,
            totalWithdrawals: d.data().totalWithdrawals || 0
          })
        }
      },
      (error) => {
        console.log('Platform earnings listener error:', error.message)
      }
    )
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const db = getFirebaseDb()
    if (!db || !showAdminPanel) return
    const unsubscribe = onSnapshot(
      collection(db, 'withdrawals'),
      (snapshot) => {
        const requests: WithdrawalRequest[] = []
        snapshot.forEach((d) => {
          requests.push({ id: d.id, ...d.data() } as WithdrawalRequest)
        })
        requests.sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0))
        setWithdrawalRequests(requests)
      },
      (error) => {
        console.log('Withdrawals listener error:', error.message)
      }
    )
    return () => unsubscribe()
  }, [showAdminPanel])

  // Load private messages when chat modal opens
  useEffect(() => {
    const db = getFirebaseDb()
    if (!db || !showChatModal || !chatRecipient || !firebaseUser) return
    const chatId = [firebaseUser.uid, chatRecipient.uid].sort().join('_')
    const unsubscribe = onSnapshot(
      collection(db, 'privateChats', chatId, 'messages'),
      (snapshot) => {
        const messagesList: ChatMessage[] = []
        snapshot.forEach((d) => {
          messagesList.push({ id: d.id, ...d.data() } as ChatMessage)
        })
        messagesList.sort((a, b) => a.timestamp - b.timestamp)
        setPrivateMessages(messagesList)
      },
      (error) => {
        console.log('Private chat listener error:', error.message)
      }
    )
    return () => unsubscribe()
  }, [showChatModal, chatRecipient, firebaseUser])

  const checkDailyBonus = async () => {
    if (!firebaseUser) return
    const db = getFirebaseDb()
    if (!db) return
    try {
      const bonusDoc = await getDoc(doc(db, 'dailyBonus', firebaseUser.uid))
      const today = new Date().toISOString().split('T')[0]
      if (bonusDoc.exists()) {
        const data = bonusDoc.data()
        if (data.lastClaimDate === today) {
          setDailyBonusData({
            currentDay: 1,
            lastClaimDate: data.lastClaimDate,
            canClaim: false,
            totalClaimed: data.totalClaimed || 0
          })
        } else {
          setDailyBonusData({
            currentDay: 1,
            lastClaimDate: data.lastClaimDate,
            canClaim: true,
            totalClaimed: data.totalClaimed || 0
          })
          setShowDailyBonus(true)
        }
      } else {
        setDailyBonusData({ currentDay: 1, lastClaimDate: null, canClaim: true, totalClaimed: 0 })
        setShowDailyBonus(true)
      }
    } catch {
      // Handle error silently
    }
  }

  const claimDailyBonus = async () => {
    if (!firebaseUser || !dailyBonusData?.canClaim) return
    const db = getFirebaseDb()
    if (!db) return
    const today = new Date().toISOString().split('T')[0]
    try {
      await updateDoc(doc(db, 'profiles', firebaseUser.uid), { coins: increment(DAILY_BONUS_AMOUNT) })
      await setDoc(doc(db, 'dailyBonus', firebaseUser.uid), {
        lastClaimDate: today,
        totalClaimed: (dailyBonusData.totalClaimed || 0) + DAILY_BONUS_AMOUNT,
        lastUpdated: Timestamp.now()
      })
      setCurrentUser(prev => prev ? { ...prev, coins: prev.coins + DAILY_BONUS_AMOUNT } : null)
      setDailyBonusData({
        currentDay: 1,
        lastClaimDate: today,
        canClaim: false,
        totalClaimed: (dailyBonusData.totalClaimed || 0) + DAILY_BONUS_AMOUNT
      })
      showToast(`🎁 Daily Bonus: +${DAILY_BONUS_AMOUNT} coins!`)
      setShowDailyBonus(false)
    } catch {
      showToast('Failed to claim bonus')
    }
  }

  // Purchase Verification Package - Required before first withdrawal
  const purchaseVerificationPackage = async () => {
    if (!currentUser || !firebaseUser) return
    
    if (currentUser.coins < VERIFICATION_PACKAGE_COST) {
      showToast(`Need ${VERIFICATION_PACKAGE_COST} coins for verification`)
      return
    }

    setVerificationPurchasing(true)
    const db = getFirebaseDb()
    if (!db) {
      setVerificationPurchasing(false)
      return
    }

    try {
      // Deduct coins from user
      await updateDoc(doc(db, 'profiles', firebaseUser.uid), {
        coins: increment(-VERIFICATION_PACKAGE_COST),
        hasPurchasedVerificationPackage: true,
        verificationPackagePurchasedAt: Timestamp.now(),
        totalAdminCommissionPaid: increment(VERIFICATION_PACKAGE_COST)
      })

      // Record admin commission
      await setDoc(doc(db, 'platform', 'earnings'), {
        totalCommission: increment(VERIFICATION_PACKAGE_COST),
        totalWithdrawals: increment(0),
        verificationPackagesSold: increment(1)
      }, { merge: true })

      // Update local state
      setCurrentUser(prev => prev ? {
        ...prev,
        coins: prev.coins - VERIFICATION_PACKAGE_COST,
        hasPurchasedVerificationPackage: true,
        totalAdminCommissionPaid: (prev.totalAdminCommissionPaid || 0) + VERIFICATION_PACKAGE_COST
      } : null)

      showToast('✅ Verification Package Purchased! You can now withdraw once you reach $15.')
      setShowVerificationModal(false)
    } catch (error) {
      console.error('Verification purchase error:', error)
      showToast('Failed to purchase verification package')
    } finally {
      setVerificationPurchasing(false)
    }
  }

  // ============================================
  // HILLTOPADS INTEGRATION - Ad Watch Functions
  // ============================================

  // Start watching an ad
  const startAdWatch = (type: 'dailyBonus' | 'withdrawal' | 'earnCoins') => {
    setAdType(type)
    setAdLoading(true)
    setAdProgress(0)
    setAdCompleted(false)
    setShowAdModal(true)

    // Set reward based on ad type
    switch (type) {
      case 'dailyBonus':
        setAdReward(DAILY_BONUS_AMOUNT)
        break
      case 'earnCoins':
        setAdReward(AD_REWARD_COINS)
        break
      case 'withdrawal':
        setAdReward(0) // No reward, just ad gate
        break
    }

    // Simulate ad progress (in production, this would be triggered by HilltopAds callbacks)
    const interval = setInterval(() => {
      setAdProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          return 100
        }
        return prev + (100 / AD_WATCH_DURATION)
      })
    }, 1000)

    // Simulate ad completion after duration
    setTimeout(() => {
      setAdLoading(false)
      setAdCompleted(true)
      clearInterval(interval)
      setAdProgress(100)

      // Trigger HilltopAds callback simulation
      if (typeof window !== 'undefined' && window.hilltopads_config?.onAdComplete) {
        window.hilltopads_config.onAdComplete(type)
      }
    }, AD_WATCH_DURATION * 1000)
  }

  // Complete ad watch and claim reward
  const completeAdWatch = async () => {
    if (!adType || !firebaseUser) return

    const db = getFirebaseDb()
    if (!db) return

    try {
      if (adType === 'dailyBonus') {
        // Claim daily bonus after ad
        const today = new Date().toISOString().split('T')[0]
        await updateDoc(doc(db, 'profiles', firebaseUser.uid), { coins: increment(DAILY_BONUS_AMOUNT) })
        await setDoc(doc(db, 'dailyBonus', firebaseUser.uid), {
          lastClaimDate: today,
          totalClaimed: increment(DAILY_BONUS_AMOUNT),
          lastUpdated: Timestamp.now()
        }, { merge: true })
        setCurrentUser(prev => prev ? { ...prev, coins: prev.coins + DAILY_BONUS_AMOUNT } : null)
        showToast(`🎁 Daily Bonus: +${DAILY_BONUS_AMOUNT} coins!`)
        setShowDailyBonus(false)
      } else if (adType === 'earnCoins') {
        // Add coins from ad watch
        await updateDoc(doc(db, 'profiles', firebaseUser.uid), { coins: increment(AD_REWARD_COINS) })
        setCurrentUser(prev => prev ? { ...prev, coins: prev.coins + AD_REWARD_COINS } : null)
        showToast(`✅ +${AD_REWARD_COINS} coins earned from ad!`)
      } else if (adType === 'withdrawal') {
        // Process withdrawal after ad
        setShowAdModal(false)
        await processWithdrawal()
      }

      setShowAdModal(false)
      setAdType(null)
    } catch (error) {
      console.error('Ad reward error:', error)
      showToast('Failed to claim reward')
    }
  }

  // Skip ad (no reward)
  const skipAd = () => {
    setShowAdModal(false)
    setAdType(null)
    setAdLoading(false)
    setAdProgress(0)
    setAdCompleted(false)
    showToast('Ad skipped - no reward given')
  }

  // ============================================
  // FREE COINS - 10 Independent Ad Slots (3 Ads Each)
  // ============================================

  // Start watching ads for a specific slot (3 consecutive ads)
  const startSlotAdWatch = (slotNumber: number) => {
    if (adSlotStatus[slotNumber] === 'completed') {
      showToast('This slot is already completed!')
      return
    }
    if (adSlotStatus[slotNumber] === 'watching' || currentAdSlot !== null) {
      showToast('Please wait for current ad to finish')
      return
    }

    // Mark slot as watching
    const newStatus = { ...adSlotStatus, [slotNumber]: 'watching' as const }
    setAdSlotStatus(newStatus)
    setCurrentAdSlot(slotNumber)
    setCurrentAdInSlot(1)
    setShowFreeCoinsModal(true)
    setAdProgress(0)
    setAdCompleted(false)
    setAdLoading(true)

    // Save to localStorage
    if (firebaseUser) {
      localStorage.setItem(`adSlots_${firebaseUser.uid}`, JSON.stringify(newStatus))
      localStorage.setItem(`adSlotsDate_${firebaseUser.uid}`, new Date().toDateString())
    }

    // Start the first ad
    playAdInSlot(slotNumber, 1)
  }

  // Play a specific ad in the slot sequence
  const playAdInSlot = (slotNumber: number, adNumber: number) => {
    setCurrentAdInSlot(adNumber)
    setAdProgress(0)
    setAdLoading(true)
    setAdCompleted(false)

    // Simulate ad progress
    const adDuration = 10 // 10 seconds per ad
    const interval = setInterval(() => {
      setAdProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          return 100
        }
        return prev + (100 / adDuration)
      })
    }, 1000)

    // Ad completes after duration
    setTimeout(() => {
      clearInterval(interval)
      setAdProgress(100)
      setAdLoading(false)
      setAdCompleted(true)

      // If this was the 3rd ad, complete the slot
      if (adNumber === 3) {
        completeSlot(slotNumber)
      }
    }, adDuration * 1000)
  }

  // Move to next ad in slot or complete
  const nextAdInSlot = () => {
    if (currentAdSlot === null) return

    if (currentAdInSlot < 3) {
      // Play next ad
      playAdInSlot(currentAdSlot, currentAdInSlot + 1)
    } else {
      // All 3 ads completed
      completeSlot(currentAdSlot)
    }
  }

  // Complete a slot and award coins
  const completeSlot = async (slotNumber: number) => {
    const db = getFirebaseDb()
    if (!db || !firebaseUser) return

    try {
      // Award coins
      await updateDoc(doc(db, 'profiles', firebaseUser.uid), { coins: increment(AD_REWARD_COINS) })
      setCurrentUser(prev => prev ? { ...prev, coins: prev.coins + AD_REWARD_COINS } : null)

      // Mark slot as completed
      const newStatus = { ...adSlotStatus, [slotNumber]: 'completed' as const }
      setAdSlotStatus(newStatus)

      // Save to localStorage
      localStorage.setItem(`adSlots_${firebaseUser.uid}`, JSON.stringify(newStatus))
      localStorage.setItem(`adSlotsDate_${firebaseUser.uid}`, new Date().toDateString())

      showToast(`🎉 +${AD_REWARD_COINS} coins! Slot ${slotNumber} completed!`)

      // Close modal after short delay
      setTimeout(() => {
        setShowFreeCoinsModal(false)
        setCurrentAdSlot(null)
        setCurrentAdInSlot(1)
      }, 1500)
    } catch (error) {
      console.error('Error awarding coins:', error)
      showToast('Error awarding coins')
    }
  }

  // Cancel ad watching (no reward)
  const cancelSlotAd = () => {
    // Reset the slot to available if it was being watched
    if (currentAdSlot !== null && adSlotStatus[currentAdSlot] === 'watching') {
      const newStatus = { ...adSlotStatus }
      delete newStatus[currentAdSlot]
      setAdSlotStatus(newStatus)
      if (firebaseUser) {
        localStorage.setItem(`adSlots_${firebaseUser.uid}`, JSON.stringify(newStatus))
      }
    }
    setShowFreeCoinsModal(false)
    setCurrentAdSlot(null)
    setCurrentAdInSlot(1)
    setAdProgress(0)
    setAdLoading(false)
    setAdCompleted(false)
    showToast('Ad cancelled - no reward given')
  }

  // Close login interstitial
  const closeLoginInterstitial = () => {
    setShowLoginInterstitial(false)
  }

  // Process withdrawal (called after ad completes)
  const processWithdrawal = async () => {
    if (!usdtWalletAddress || usdtWalletAddress.length < 20) {
      showToast('Valid USDT TRC20 wallet address required')
      return
    }

    if (!trc20Confirmed) {
      showToast('Please confirm this is a TRC20 network address')
      return
    }

    const db = getFirebaseDb()
    if (!db || !firebaseUser || !currentUser) return

    const grossAmount = currentUser.coins / WITHDRAW_RATE
    const adminCommission = grossAmount * ADMIN_COMMISSION_RATE
    const netAmount = grossAmount - adminCommission

    try {
      await addDoc(collection(db, 'withdrawals'), {
        uid: firebaseUser.uid,
        displayName: currentUser.displayName,
        email: currentUser.email,
        usdtWalletAddress,
        paymentNetwork: 'TRC20',
        grossAmount: `$${grossAmount.toFixed(2)}`,
        adminCommission: `$${adminCommission.toFixed(2)}`,
        netAmount: `$${netAmount.toFixed(2)}`,
        coinsRedeemed: currentUser.coins,
        status: 'pending',
        timestamp: Timestamp.now(),
        hasVerificationPackage: true
      })

      await updateDoc(doc(db, 'profiles', firebaseUser.uid), { coins: 0 })

      await setDoc(doc(db, 'platform', 'earnings'), {
        totalCommission: increment(adminCommission * WITHDRAW_RATE),
        totalWithdrawals: increment(1)
      }, { merge: true })

      setCurrentUser(prev => prev ? { ...prev, coins: 0 } : null)
      setUsdtWalletAddress('')
      setTrc20Confirmed(false)
      showToast(`✅ Withdrawal requested: $${netAmount.toFixed(2)} USDT (TRC20) (after $${adminCommission.toFixed(2)} fee)`)
    } catch (error) {
      console.error('Withdrawal error:', error)
      showToast('Error requesting withdrawal')
    }
  }

  // Check if user can withdraw
  const canWithdraw = (): { allowed: boolean; reason: string } => {
    if (!currentUser) {
      return { allowed: false, reason: 'Please login' }
    }
    
    if (!currentUser.hasPurchasedVerificationPackage) {
      return { allowed: false, reason: 'Verification Package Required' }
    }
    
    if (currentUser.coins < MIN_WITHDRAW_COINS) {
      return { allowed: false, reason: `Min: $${MIN_WITHDRAW_DOLLARS} (${MIN_WITHDRAW_COINS} coins)` }
    }
    
    return { allowed: true, reason: '' }
  }

  // Process OxaPay Payment for USDT TRC20
  const processOxaPayPayment = async (pkg: TopUpPackage) => {
    if (!firebaseUser || !currentUser) {
      showToast('Please login to purchase')
      return
    }

    try {
      showToast('🔄 Creating USDT TRC20 payment request...')
      
      // Generate unique Order ID
      const orderId = `TOPUP-${Date.now()}-${firebaseUser.uid.slice(0, 8).toUpperCase()}`
      
      // Call our API to create OxaPay payment
      const response = await fetch('/api/oxapay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: pkg.price,
          coins: pkg.coins,
          uid: firebaseUser.uid,
          orderId: orderId,
          description: `Top Up: ${pkg.coins.toLocaleString()} coins`
        })
      })

      const data = await response.json()

      if (data.success && data.paymentUrl) {
        // Open OxaPay payment page in new window
        window.open(data.paymentUrl, '_blank')
        showToast('✅ Payment page opened! Complete payment to receive coins.')
        
        // Start polling for payment status using trackId
        const trackId = data.trackId
        const pollInterval = setInterval(async () => {
          try {
            const statusResponse = await fetch(`/api/oxapay?trackId=${trackId}`)
            const statusData = await statusResponse.json()
            
            if (statusData.success && statusData.status === 'paid') {
              clearInterval(pollInterval)
              // Add coins to user
              const db = getFirebaseDb()
              if (db) {
                const updateData: Record<string, unknown> = { coins: increment(pkg.coins) }
                if (pkg.isOffer) updateData.hasUsedFirstTimeOffer = true
                await updateDoc(doc(db, 'profiles', firebaseUser.uid), updateData)
                setCurrentUser(prev => prev ? {
                  ...prev,
                  coins: prev.coins + pkg.coins,
                  hasUsedFirstTimeOffer: pkg.isOffer ? true : prev.hasUsedFirstTimeOffer
                } : null)
                showToast(`✅ Payment successful! +${pkg.coins.toLocaleString()} coins added!`)
                setSelectedPackage(null)
              }
            }
          } catch {
            // Continue polling on error
          }
        }, 5000) // Poll every 5 seconds

        // Stop polling after 10 minutes
        setTimeout(() => clearInterval(pollInterval), 600000)
      } else {
        showToast(data.error || 'Failed to create payment request')
      }
    } catch (error) {
      console.error('OxaPay payment error:', error)
      showToast('Failed to process payment')
    }
  }

  const requestWithdrawal = async () => {
    // Check if user has purchased verification package
    if (!currentUser?.hasPurchasedVerificationPackage) {
      setShowWithdrawalBlockedModal(true)
      return
    }

    // Check minimum withdrawal amount
    if ((currentUser?.coins || 0) < MIN_WITHDRAW_COINS) {
      showToast(`Minimum withdrawal is $${MIN_WITHDRAW_DOLLARS} (${MIN_WITHDRAW_COINS.toLocaleString()} coins)`)
      return
    }

    // Validate USDT TRC20 wallet address
    if (!usdtWalletAddress || usdtWalletAddress.length < 20) {
      showToast('Valid USDT (TRC20) wallet address required')
      return
    }

    // Check if user confirmed TRC20 network
    if (!trc20Confirmed) {
      showToast('Please confirm this is a TRC20 network address')
      return
    }
    
    const db = getFirebaseDb()
    if (!db || !firebaseUser) return
    
    // Calculate amounts
    const grossAmount = currentUser!.coins / WITHDRAW_RATE
    const adminCommission = grossAmount * ADMIN_COMMISSION_RATE
    const netAmount = grossAmount - adminCommission
    
    try {
      // Create withdrawal request
      await addDoc(collection(db, 'withdrawals'), {
        uid: firebaseUser.uid,
        displayName: currentUser!.displayName,
        email: currentUser!.email,
        usdtWalletAddress,
        grossAmount: `$${grossAmount.toFixed(2)}`,
        adminCommission: `$${adminCommission.toFixed(2)}`,
        netAmount: `$${netAmount.toFixed(2)}`,
        coinsRedeemed: currentUser!.coins,
        status: 'pending',
        paymentMethod: 'usdt_trc20',
        timestamp: Timestamp.now(),
        hasVerificationPackage: true
      })
      
      // Reset user coins
      await updateDoc(doc(db, 'profiles', firebaseUser.uid), { coins: 0 })
      
      // Update platform earnings
      await setDoc(doc(db, 'platform', 'earnings'), {
        totalCommission: increment(adminCommission * WITHDRAW_RATE),
        totalWithdrawals: increment(1)
      }, { merge: true })
      
      setCurrentUser(prev => prev ? { ...prev, coins: 0 } : null)
      setUsdtWalletAddress('')
      setTrc20Confirmed(false)
      showToast(`Success! $${netAmount.toFixed(2)} will be sent to your TRC20 wallet (after $${adminCommission.toFixed(2)} fee)`)
    } catch {
      showToast('Error requesting withdrawal')
    }
  }

  const addManualCoins = async () => {
    if (!currentUser?.isAdmin) {
      showToast('Admin only')
      return
    }
    const amount = parseInt(manualCoinAmount)
    if (!amount || amount <= 0) {
      showToast('Enter valid amount')
      return
    }
    const db = getFirebaseDb()
    if (!db || !firebaseUser) return
    try {
      await updateDoc(doc(db, 'profiles', firebaseUser.uid), { coins: increment(amount) })
      setCurrentUser(prev => prev ? { ...prev, coins: prev.coins + amount } : null)
      setManualCoinAmount('')
      showToast(`✅ +${amount} coins added!`)
    } catch {
      showToast('Failed to add coins')
    }
  }

  const handleRegister = async () => {
    if (!authEmail || !authPass) {
      showToast('Fill all fields')
      return
    }
    const auth = getFirebaseAuth()
    const db = getFirebaseDb()
    if (!auth || !db) return
    try {
      const cred = await createUserWithEmailAndPassword(auth, authEmail, authPass)
      await setDoc(doc(db, 'profiles', cred.user.uid), {
        displayName: authEmail.split('@')[0],
        email: authEmail,
        coins: 1000, // Starting bonus: 1,000 coins ($0.10)
        bio: 'Hey there!',
        photoURL: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop',
        country: '',
        city: '',
        phone: '',
        age: 18,
        gender: 'Male',
        language: '',
        birthday: '',
        islive: false,
        lastBonus: Date.now(),
        followers: [],
        following: [],
        isOnline: true,
        lastSeen: Timestamp.now(),
        isPremium: false,
        isAdmin: false
      })
      showToast('Account created!')
    } catch (e: unknown) {
      const error = e as { message?: string }
      showToast(error.message || 'Registration failed')
    }
  }

  const handleLogin = async () => {
    if (!authEmail || !authPass) {
      showToast('Fill all fields')
      return
    }
    const auth = getFirebaseAuth()
    if (!auth) return
    try {
      await signInWithEmailAndPassword(auth, authEmail, authPass)
      showToast('Welcome!')
    } catch (e: unknown) {
      const error = e as { message?: string }
      showToast(error.message || 'Login failed')
    }
  }

  const handleLogout = async () => {
    const auth = getFirebaseAuth()
    const db = getFirebaseDb()
    if (auth && firebaseUser && db) {
      await updateDoc(doc(db, 'profiles', firebaseUser.uid), { isOnline: false, lastSeen: Timestamp.now() })
      await signOut(auth)
    }
    setCurrentScreen('home')
  }

  const toggleFollow = async (target: UserProfile) => {
    if (!firebaseUser || !currentUser) return
    const db = getFirebaseDb()
    if (!db) return
    try {
      const isFollowing = Array.isArray(currentUser.following) && currentUser.following.includes(target.uid)
      if (isFollowing) {
        await updateDoc(doc(db, 'profiles', firebaseUser.uid), { 
          following: arrayRemove(target.uid),
          lastSeen: Timestamp.now()
        })
        await updateDoc(doc(db, 'profiles', target.uid), { 
          followers: arrayRemove(firebaseUser.uid),
          lastSeen: Timestamp.now()
        })
        // Update local state
        setCurrentUser(prev => prev ? { 
          ...prev, 
          following: (prev.following || []).filter(id => id !== target.uid)
        } : null)
        showToast('Unfollowed')
      } else {
        await updateDoc(doc(db, 'profiles', firebaseUser.uid), { 
          following: arrayUnion(target.uid),
          lastSeen: Timestamp.now()
        })
        await updateDoc(doc(db, 'profiles', target.uid), { 
          followers: arrayUnion(firebaseUser.uid),
          lastSeen: Timestamp.now()
        })
        // Update local state
        setCurrentUser(prev => prev ? { 
          ...prev, 
          following: [...(prev.following || []), target.uid]
        } : null)
        showToast('Following!')
      }
    } catch (error) {
      console.error('Follow error:', error)
      showToast('Failed to follow')
    }
  }

  const isUserOnline = (user: UserProfile): boolean => {
    return user.isOnline || (user.lastSeen && user.lastSeen.toMillis() > Date.now() - 300000)
  }

  const joinLive = async (hostUid: string) => {
    if (!AGORA_APP_ID || !window.AgoraRTC) {
      showToast('Video service not ready')
      return
    }
    setIsConnecting(true)
    setConnectionError('')
    setRemoteVideoTrack(null)
    try {
      const client = window.AgoraRTC.createClient({ mode: 'live', codec: 'vp8' })
      await client.setClientRole('audience')
      await client.join(AGORA_APP_ID, hostUid, null, null)
      agoraClientRef.current = client
      client.on('user-published', async (user: AgoraRemoteUser, mediaType: string) => {
        await client.subscribe(user, mediaType)
        if (mediaType === 'video' && user.videoTrack) {
          setRemoteVideoTrack(user.videoTrack)
          setTimeout(() => user.videoTrack?.play('remote-player'), 200)
        }
        if (mediaType === 'audio' && user.audioTrack) {
          user.audioTrack.play('')
        }
      })
      client.on('user-unpublished', (user: AgoraRemoteUser, mediaType: string) => {
        if (mediaType === 'video') setRemoteVideoTrack(null)
      })
      setIsConnecting(false)
      showToast('Connected!')
    } catch (e: unknown) {
      setIsConnecting(false)
      const error = e as { message?: string }
      setConnectionError(error.message || 'Connection failed')
      showToast('Failed to connect')
    }
  }

  const startLive = async () => {
    if (!AGORA_APP_ID || !firebaseUser || !window.AgoraRTC) {
      showToast('Video service not ready')
      return
    }
    
    // Request permissions first
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      stream.getTracks().forEach(track => track.stop()) // Stop the test stream
    } catch (permError: unknown) {
      const err = permError as { name?: string }
      if (err.name === 'NotAllowedError') {
        showToast('Camera and Microphone access denied. Please enable in browser settings.')
        return
      }
      if (err.name === 'NotFoundError') {
        showToast('Camera or Microphone not found. Please connect a device.')
        return
      }
      showToast('Failed to access camera/microphone')
      return
    }

    setIsHostLive(true)
    setShowLiveScreen(true)
    setViewers(0)
    setTotalGifts(0)
    setChatMessages([])
    setIsConnecting(true)
    setConnectionError('')
    setMicEnabled(true)
    setCamEnabled(true)
    
    try {
      const client = window.AgoraRTC.createClient({ mode: 'live', codec: 'vp8' })
      await client.setClientRole('host')
      await client.join(AGORA_APP_ID, firebaseUser.uid, null, firebaseUser.uid)
      
      const tracks = await window.AgoraRTC.createMicrophoneAndCameraTracks()
      await client.publish(tracks)
      
      setTimeout(() => tracks[1].play('local-player'), 100)
      
      agoraClientRef.current = client
      setLocalTracks(tracks)
      setIsConnecting(false)
      
      const db = getFirebaseDb()
      if (db) await updateDoc(doc(db, 'profiles', firebaseUser.uid), { islive: true })
      
      showToast('🔴 You are now LIVE!')
    } catch (error: unknown) {
      console.error('Live stream error:', error)
      setShowLiveScreen(false)
      setIsHostLive(false)
      setIsConnecting(false)
      const err = error as { message?: string }
      setConnectionError(err.message || 'Failed to start live stream')
      showToast('Live Stream Failed - Please try again')
    }
  }

  const exitLive = () => {
    setShowExitModal(true)
  }

  const confirmExitLive = async () => {
    setShowExitModal(false)
    try {
      if (agoraClientRef.current) {
        await agoraClientRef.current.leave()
        agoraClientRef.current = null
      }
      localTracks.forEach(t => t.close())
      if (isHostLive && firebaseUser) {
        const db = getFirebaseDb()
        if (db) await updateDoc(doc(db, 'profiles', firebaseUser.uid), { islive: false })
      }
      setShowLiveScreen(false)
      setIsHostLive(false)
      setCurrentHost(null)
      setCurrentHostId('')
      setLocalTracks([])
      setRemoteVideoTrack(null)
      setChatMessages([])
      setIsConnecting(false)
      showToast('Left')
    } catch {
      setShowLiveScreen(false)
      setIsHostLive(false)
    }
  }

  const toggleMic = () => {
    if (localTracks[0]) {
      localTracks[0].setEnabled(!micEnabled)
      setMicEnabled(!micEnabled)
    }
  }

  const toggleCam = () => {
    if (localTracks[1]) {
      localTracks[1].setEnabled(!camEnabled)
      setCamEnabled(!camEnabled)
    }
  }

  const sendGift = async (gift: GiftItem) => {
    if (!firebaseUser || !currentUser || isHostLive || !currentHostId) {
      setShowGiftPanel(false)
      return
    }
    const db = getFirebaseDb()
    if (!db || currentUser.coins < gift.cost) {
      showToast('Not enough coins')
      setShowGiftPanel(false)
      return
    }
    try {
      await updateDoc(doc(db, 'profiles', firebaseUser.uid), { coins: increment(-gift.cost) })
      await updateDoc(doc(db, 'profiles', currentHostId), { coins: increment(gift.cost) })
      setCurrentUser(prev => prev ? { ...prev, coins: prev.coins - gift.cost } : null)
      setTotalGifts(prev => prev + gift.cost)
      
      // Add gift animation to chat
      const giftMessage: ChatMessage = {
        id: Date.now().toString(),
        text: `${gift.emoji} ${gift.name}`,
        sender: firebaseUser.uid,
        senderName: currentUser.displayName,
        senderPhoto: currentUser.photoURL,
        timestamp: Date.now()
      }
      setChatMessages(prev => [...prev, giftMessage])
      
      showToast(`Sent ${gift.emoji} ${gift.name}!`)
    } catch {
      showToast('Failed to send gift')
    }
    setShowGiftPanel(false)
  }

  const uploadPhoto = async (file: File) => {
    if (!file || !firebaseUser) return
    const { cloudinaryCloudName, cloudinaryUploadPreset } = config
    if (!cloudinaryCloudName || !cloudinaryUploadPreset) return
    setUploadingImage(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('upload_preset', cloudinaryUploadPreset)
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/upload`, {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      const db = getFirebaseDb()
      if (db) {
        await updateDoc(doc(db, 'profiles', firebaseUser.uid), { photoURL: data.secure_url })
        setCurrentUser(prev => prev ? { ...prev, photoURL: data.secure_url } : null)
        showToast('Updated!')
      }
    } catch {
      showToast('Upload failed')
    } finally {
      setUploadingImage(false)
    }
  }

  const startPremiumVideoCall = async (user: UserProfile) => {
    if (user.gender !== 'Female') {
      showToast('Female only')
      return
    }
    if ((currentUser?.coins || 0) < PREMIUM_VIDEO_CALL_RATE) {
      showToast(`Need ${PREMIUM_VIDEO_CALL_RATE} coins`)
      return
    }
    if (!AGORA_APP_ID || !window.AgoraRTC) {
      showToast('Video service not ready')
      return
    }
    setPremiumVideoCallUser(user)
    setShowPremiumVideoCall(true)
    setVideoCallDuration(0)
    setVideoCallActive(false)
    setVideoCallConnecting(true)
    setPremiumRemoteVideoTrack(null)
  }

  const acceptPremiumVideoCall = async () => {
    if (!premiumVideoCallUser || !firebaseUser || !AGORA_APP_ID || !window.AgoraRTC) return
    setVideoCallConnecting(true)
    try {
      const channelName = `premium_${firebaseUser.uid}_${premiumVideoCallUser.uid}_${Date.now()}`
      const client = window.AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' })
      await client.join(AGORA_APP_ID, channelName, null, firebaseUser.uid)
      const tracks = await window.AgoraRTC.createMicrophoneAndCameraTracks()
      await client.publish(tracks)
      setTimeout(() => tracks[1].play('premium-local-player'), 100)
      client.on('user-published', async (user: AgoraRemoteUser, mediaType: string) => {
        await client.subscribe(user, mediaType)
        if (mediaType === 'video' && user.videoTrack) {
          setPremiumRemoteVideoTrack(user.videoTrack)
          setTimeout(() => user.videoTrack?.play('premium-remote-player'), 100)
        }
        if (mediaType === 'audio' && user.audioTrack) {
          user.audioTrack.play('')
        }
      })
      client.on('user-unpublished', (user: AgoraRemoteUser, mediaType: string) => {
        if (mediaType === 'video') setPremiumRemoteVideoTrack(null)
      })
      premiumVideoClientRef.current = client
      setPremiumLocalTracks(tracks)
      setVideoCallActive(true)
      setVideoCallConnecting(false)
      videoCallTimerRef.current = setInterval(() => {
        setVideoCallDuration(prev => {
          const newDur = prev + 1
          if (newDur % 60 === 0 && firebaseUser && premiumVideoCallUser) {
            // Deduct coins directly
            const db = getFirebaseDb()
            if (db) {
              updateDoc(doc(db, 'profiles', firebaseUser.uid), { coins: increment(-PREMIUM_VIDEO_CALL_RATE) })
              updateDoc(doc(db, 'profiles', premiumVideoCallUser.uid), { coins: increment(Math.floor(PREMIUM_VIDEO_CALL_RATE * 0.9)) })
              setCurrentUser(prev => prev ? { ...prev, coins: prev.coins - PREMIUM_VIDEO_CALL_RATE } : null)
              showToast(`${PREMIUM_VIDEO_CALL_RATE} coins deducted`)
            }
          }
          return newDur
        })
      }, 1000)
      showToast('Call started!')
    } catch {
      setVideoCallConnecting(false)
      showToast('Failed to start call')
    }
  }

  const endPremiumVideoCall = async () => {
    if (videoCallTimerRef.current) clearInterval(videoCallTimerRef.current)
    const db = getFirebaseDb()
    const mins = Math.ceil(videoCallDuration / 60)
    if (mins > 0 && firebaseUser && premiumVideoCallUser && db) {
      await updateDoc(doc(db, 'profiles', firebaseUser.uid), { coins: increment(-mins * PREMIUM_VIDEO_CALL_RATE) })
      await updateDoc(doc(db, 'profiles', premiumVideoCallUser.uid), { coins: increment(Math.floor(mins * PREMIUM_VIDEO_CALL_RATE * 0.9)) })
    }
    if (premiumVideoClientRef.current) {
      try {
        await premiumVideoClientRef.current.leave()
      } catch {
        // Ignore leave errors
      }
    }
    premiumLocalTracks.forEach(t => t.close())
    setShowPremiumVideoCall(false)
    setPremiumVideoCallUser(null)
    setVideoCallDuration(0)
    setVideoCallActive(false)
    setVideoCallConnecting(false)
    setPremiumLocalTracks([])
    setPremiumRemoteVideoTrack(null)
    showToast('Call ended')
  }

  const saveProfile = async () => {
    if (!firebaseUser) return
    const db = getFirebaseDb()
    if (!db) return
    await updateDoc(doc(db, 'profiles', firebaseUser.uid), {
      displayName: editName,
      bio: editBio,
      age: parseInt(editAge) || 18,
      country: editCountry,
      city: editCity,
      phone: editPhone,
      gender: editGender,
      birthday: editBirthday,
      language: editLang
    })
    setCurrentUser(prev => prev ? {
      ...prev,
      displayName: editName,
      bio: editBio,
      age: parseInt(editAge) || 18
    } : null)
    showToast('Saved!')
  }

  const sendPrivateMessage = async () => {
    if (!privateMessageInput.trim() || !currentUser || !firebaseUser || !chatRecipient) return
    if (currentUser.coins < PREMIUM_MESSAGE_COST) {
      showToast('Need 10 coins')
      return
    }
    const db = getFirebaseDb()
    if (!db) return

    const msg: ChatMessage = {
      id: Date.now().toString(),
      text: privateMessageInput,
      sender: firebaseUser.uid,
      senderName: currentUser.displayName,
      senderPhoto: currentUser.photoURL,
      timestamp: Date.now()
    }

    try {
      // Create a unique chat ID for the conversation
      const chatId = [firebaseUser.uid, chatRecipient.uid].sort().join('_')
      await setDoc(doc(db, 'privateChats', chatId, 'messages', msg.id), msg)

      // Deduct coins from sender
      await updateDoc(doc(db, 'profiles', firebaseUser.uid), { coins: increment(-PREMIUM_MESSAGE_COST) })

      // Add coins to recipient (girl gets 90%)
      await updateDoc(doc(db, 'profiles', chatRecipient.uid), { coins: increment(9) })

      setCurrentUser(prev => prev ? { ...prev, coins: prev.coins - PREMIUM_MESSAGE_COST } : null)
      setPrivateMessages(prev => [...prev, msg])
      setPrivateMessageInput('')
      showToast('Message sent! -10💎')
    } catch {
      showToast('Failed to send')
    }
  }

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !currentUser || !firebaseUser) return
    const chatId = currentHostId || firebaseUser?.uid
    if (!chatId) return
    const db = getFirebaseDb()
    if (!db) return
    const msg: ChatMessage = {
      id: Date.now().toString(),
      text: chatInput,
      sender: firebaseUser?.uid || '',
      senderName: currentUser.displayName,
      senderPhoto: currentUser.photoURL,
      timestamp: Date.now()
    }
    try {
      await setDoc(doc(db, 'livechats', chatId, 'messages', msg.id), msg)
      setChatInput('')
    } catch {
      setChatMessages(prev => [...prev, msg])
      setChatInput('')
    }
  }

  const updateWithdrawalStatus = async (id: string, status: string) => {
    const db = getFirebaseDb()
    if (!db) return
    try {
      await updateDoc(doc(db, 'withdrawals', id), { status, processedAt: Timestamp.now() })
      showToast(`Withdrawal ${status}`)
    } catch {
      showToast('Failed to update')
    }
  }

  const liveUsers = users.filter(u => u.islive)
  const otherUsers = users.filter(u => !u.islive)
  const firebaseReady = mounted && isFirebaseAvailable()
  const formatDuration = (s: number): string => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  // Default avatar placeholder
  const getAvatar = (user: UserProfile | null): string => {
    if (!user) return ''
    if (user.photoURL) return user.photoURL
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=random&color=fff&size=150`
  }

  // Loading state
  if (!mounted || loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #831843, #581c87, #312e81)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '4rem', fontWeight: 'bold', color: '#dc2626' }}>18+</h1>
          <p style={{ color: 'rgba(255,255,255,0.7)' }}>Loading...</p>
        </div>
      </div>
    )
  }

  // Firebase not configured state
  if (!firebaseReady) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        background: 'linear-gradient(135deg, #831843, #581c87, #312e81)'
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.1)',
          backdropFilter: 'blur(10px)',
          borderRadius: '1.5rem',
          padding: '2rem',
          textAlign: 'center',
          maxWidth: '28rem'
        }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'white' }}>18+ Sl</h1>
          <p style={{ color: '#ef4444', fontWeight: 'bold', marginTop: '1rem' }}>Firebase not configured</p>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            Please set up your Firebase environment variables in .env.local
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1.5rem',
              padding: '0.75rem 2rem',
              background: 'linear-gradient(to right, #ec4899, #8b5cf6)',
              borderRadius: '9999px',
              color: 'white',
              border: 'none',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Auth state (not logged in)
  if (!isAuthenticated) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        background: 'linear-gradient(135deg, #831843, #581c87, #312e81)'
      }}>
        <div style={{ width: '100%', maxWidth: '24rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h1 style={{ fontSize: '4rem', fontWeight: 'bold', color: 'white' }}>18+</h1>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(10px)',
            borderRadius: '1.5rem',
            padding: '1.5rem',
            border: '1px solid rgba(255,255,255,0.2)'
          }}>
            <div style={{
              display: 'flex',
              marginBottom: '1.5rem',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '0.75rem',
              padding: '0.25rem'
            }}>
              <button
                onClick={() => setIsLoginMode(false)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  fontWeight: 'bold',
                  border: 'none',
                  background: !isLoginMode ? '#ec4899' : 'transparent',
                  color: !isLoginMode ? 'white' : 'rgba(255,255,255,0.7)',
                  cursor: 'pointer'
                }}
              >
                Register
              </button>
              <button
                onClick={() => setIsLoginMode(true)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  fontWeight: 'bold',
                  border: 'none',
                  background: isLoginMode ? '#ec4899' : 'transparent',
                  color: isLoginMode ? 'white' : 'rgba(255,255,255,0.7)',
                  cursor: 'pointer'
                }}
              >
                Login
              </button>
            </div>
            <input
              type="email"
              placeholder="Email"
              value={authEmail}
              onChange={e => setAuthEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '0.75rem',
                color: 'white',
                marginBottom: '1rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            <input
              type="password"
              placeholder="Password"
              value={authPass}
              onChange={e => setAuthPass(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '0.75rem',
                color: 'white',
                marginBottom: '1rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            <button
              onClick={isLoginMode ? handleLogin : handleRegister}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'linear-gradient(to right, #ec4899, #8b5cf6)',
                borderRadius: '0.75rem',
                fontWeight: 'bold',
                color: 'white',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              {isLoginMode ? 'Login' : 'Create Account'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Main app
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #831843, #581c87, #312e81)',
      paddingBottom: '80px'
    }}>
      {/* Toast notifications */}
      <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 9999 }}>
        {toasts.map(t => (
          <div
            key={t.id}
            style={{
              background: 'rgba(255,255,255,0.95)',
              padding: '0.75rem 1rem',
              borderRadius: '0.75rem',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* Home Screen */}
      {currentScreen === 'home' && (
        <div style={{ padding: '1rem' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 0',
            marginBottom: '1rem'
          }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white' }}>
              18+ <span style={{ color: '#ec4899' }}>Sl</span>
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {currentUser?.isAdmin && (
                <button
                  onClick={() => setShowAdminPanel(true)}
                  style={{
                    padding: '0.5rem',
                    background: 'rgba(234,179,8,0.2)',
                    borderRadius: '9999px',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <span style={{ fontSize: '1.25rem' }}>👑</span>
                </button>
              )}
              <button
                onClick={() => checkDailyBonus()}
                style={{
                  position: 'relative',
                  padding: '0.5rem',
                  background: dailyBonusData?.canClaim
                    ? 'linear-gradient(135deg, #ec4899, #8b5cf6)'
                    : 'rgba(255,255,255,0.1)',
                  borderRadius: '9999px',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>🎁</span>
                {dailyBonusData?.canClaim && (
                  <span style={{
                    position: 'absolute',
                    top: '-0.25rem',
                    right: '-0.25rem',
                    width: '0.75rem',
                    height: '0.75rem',
                    background: '#22c55e',
                    borderRadius: '9999px',
                    border: '2px solid #581c87'
                  }} />
                )}
              </button>
              <button
                onClick={() => setShowNotifications(true)}
                style={{
                  position: 'relative',
                  padding: '0.5rem',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '9999px',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>🔔</span>
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-0.25rem',
                    right: '-0.25rem',
                    width: '1.25rem',
                    height: '1.25rem',
                    background: '#ef4444',
                    borderRadius: '9999px',
                    color: 'white',
                    fontSize: '0.625rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold'
                  }}>
                    {unreadCount}
                  </span>
                )}
              </button>
              <div style={{
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '9999px',
                padding: '0.25rem 0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}>
                <span style={{ color: '#eab308' }}>💎</span>
                <span style={{ color: 'white', fontWeight: 'bold', fontSize: '0.875rem' }}>
                  {currentUser?.coins || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Daily Bonus Banner */}
          {dailyBonusData?.canClaim && (
            <div
              onClick={() => setShowDailyBonus(true)}
              style={{
                background: 'linear-gradient(135deg, rgba(236,72,153,0.2), rgba(139,92,246,0.2))',
                border: '1px solid rgba(236,72,153,0.3)',
                borderRadius: '1rem',
                padding: '0.75rem 1rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.5rem' }}>🎁</span>
                <div>
                  <p style={{ color: 'white', fontWeight: 'bold', fontSize: '0.875rem' }}>Daily Bonus!</p>
                  <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem' }}>Claim 💎 {DAILY_BONUS_AMOUNT} coins</p>
                </div>
              </div>
              <span style={{ color: '#22c55e', fontSize: '0.875rem', fontWeight: 'bold' }}>Claim →</span>
            </div>
          )}

          {/* Live Users */}
          {liveUsers.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ color: 'white', fontWeight: 'bold', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '0.5rem', height: '0.5rem', background: '#ef4444', borderRadius: '9999px' }} />
                Live Now
              </h3>
              <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto' }}>
                {liveUsers.map(u => (
                  <div
                    key={u.uid}
                    onClick={async () => {
                      setSelectedUser(null)
                      setShowUserModal(false)
                      setCurrentHost(u)
                      setCurrentHostId(u.uid)
                      setShowLiveScreen(true)
                      setViewers(Math.floor(Math.random() * 100) + 10)
                      setTotalGifts(0)
                      await joinLive(u.uid)
                    }}
                    style={{ flexShrink: 0, width: '6rem', cursor: 'pointer' }}
                  >
                    <div style={{ position: 'relative' }}>
                      <img
                        src={u.photoURL}
                        alt={u.displayName}
                        style={{
                          width: '6rem',
                          height: '6rem',
                          borderRadius: '1rem',
                          objectFit: 'cover',
                          border: '2px solid #ef4444'
                        }}
                      />
                      <div style={{
                        position: 'absolute',
                        bottom: '0.25rem',
                        left: '0.25rem',
                        background: '#ef4444',
                        color: 'white',
                        fontSize: '0.625rem',
                        fontWeight: 'bold',
                        padding: '0.125rem 0.5rem',
                        borderRadius: '9999px'
                      }}>
                        LIVE
                      </div>
                    </div>
                    <p style={{
                      color: 'white',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      marginTop: '0.25rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {u.displayName}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Go Live Button */}
          <button
            onClick={startLive}
            style={{
              width: '100%',
              padding: '1rem',
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              borderRadius: '1rem',
              fontWeight: 'bold',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            <span style={{ fontSize: '1.25rem' }}>📹</span>
            Go Live
          </button>

          {/* Users List */}
          <h3 style={{ color: 'white', fontWeight: 'bold', marginBottom: '0.75rem' }}>Users</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {otherUsers.map(u => (
              <div
                key={u.uid}
                onClick={() => {
                  setSelectedUser(u)
                  setShowUserModal(true)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  background: 'rgba(255,255,255,0.1)',
                  padding: '0.75rem',
                  borderRadius: '1rem',
                  cursor: 'pointer'
                }}
              >
                <div style={{ position: 'relative' }}>
                  <img
                    src={u.photoURL}
                    alt={u.displayName}
                    style={{ width: '3.5rem', height: '3.5rem', borderRadius: '9999px', objectFit: 'cover' }}
                  />
                  {isUserOnline(u) && (
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: '0.875rem',
                      height: '0.875rem',
                      background: '#22c55e',
                      borderRadius: '9999px',
                      border: '2px solid #581c87'
                    }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: 'white', fontWeight: 'bold' }}>{u.displayName}</p>
                  <p style={{
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: '0.875rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {u.bio || 'No bio'}
                  </p>
                </div>
                {u.gender === 'Female' && u.isPremium && (
                  <span style={{ color: '#eab308', fontSize: '1.25rem' }}>👑</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Wallet Screen */}
      {currentScreen === 'wallet' && (
        <div style={{ padding: '1rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white', marginBottom: '1.5rem' }}>💎 Wallet</h2>
          
          {/* Balance Card */}
          <div style={{
            background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
            borderRadius: '1.5rem',
            padding: '1.5rem',
            marginBottom: '1rem'
          }}>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Your Balance</p>
            <p style={{ color: 'white', fontSize: '2.5rem', fontWeight: 'bold' }}>💎 {currentUser?.coins?.toLocaleString() || 0}</p>
            <div style={{
              marginTop: '0.75rem',
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '0.75rem',
              padding: '0.75rem',
              textAlign: 'center'
            }}>
              <p style={{ color: '#22c55e', fontWeight: 'bold', fontSize: '1.25rem' }}>
                ${((currentUser?.coins || 0) / WITHDRAW_RATE).toFixed(2)}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.625rem' }}>({WITHDRAW_RATE} coins = $1)</p>
            </div>
          </div>

          {/* Verification Status Card */}
          <div style={{
            background: currentUser?.hasPurchasedVerificationPackage 
              ? 'rgba(34,197,94,0.2)' 
              : 'rgba(239,68,68,0.15)',
            borderRadius: '1rem',
            padding: '1rem',
            marginBottom: '1rem',
            border: currentUser?.hasPurchasedVerificationPackage 
              ? '1px solid rgba(34,197,94,0.4)' 
              : '1px solid rgba(239,68,68,0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ 
                fontSize: '1.5rem',
                background: currentUser?.hasPurchasedVerificationPackage ? '#22c55e' : '#ef4444',
                borderRadius: '9999px',
                width: '2.5rem',
                height: '2.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {currentUser?.hasPurchasedVerificationPackage ? '✅' : '🔒'}
              </div>
              <div>
                <p style={{ color: 'white', fontWeight: 'bold', fontSize: '0.9375rem' }}>
                  {currentUser?.hasPurchasedVerificationPackage ? 'Verified for Withdrawal' : 'Verification Required'}
                </p>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem' }}>
                  {currentUser?.hasPurchasedVerificationPackage 
                    ? 'You can withdraw once you reach $15' 
                    : 'Buy verification package to unlock withdrawals'}
                </p>
              </div>
            </div>
          </div>

          {/* Verification Package Purchase (if not purchased) */}
          {!currentUser?.hasPurchasedVerificationPackage && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(236,72,153,0.2))',
              borderRadius: '1rem',
              padding: '1.25rem',
              marginBottom: '1rem',
              border: '1px solid rgba(139,92,246,0.3)'
            }}>
              <h3 style={{ color: 'white', fontWeight: 'bold', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🛡️ Verification Package
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8125rem', marginBottom: '0.75rem', lineHeight: '1.5' }}>
                One-time purchase required to unlock withdrawals. This helps us verify your account and prevent fraud.
              </p>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '0.75rem',
                padding: '0.75rem 1rem',
                marginBottom: '0.75rem'
              }}>
                <div>
                  <p style={{ color: '#f472b6', fontWeight: 'bold', fontSize: '1.125rem' }}>💎 {VERIFICATION_PACKAGE_COST.toLocaleString()}</p>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>= ${VERIFICATION_PACKAGE_DOLLARS}</p>
                </div>
                <button
                  onClick={() => setShowVerificationModal(true)}
                  disabled={(currentUser?.coins || 0) < VERIFICATION_PACKAGE_COST}
                  style={{
                    padding: '0.625rem 1.25rem',
                    background: (currentUser?.coins || 0) >= VERIFICATION_PACKAGE_COST 
                      ? 'linear-gradient(135deg, #ec4899, #8b5cf6)' 
                      : '#4b5563',
                    borderRadius: '9999px',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '0.875rem',
                    border: 'none',
                    cursor: (currentUser?.coins || 0) >= VERIFICATION_PACKAGE_COST ? 'pointer' : 'not-allowed',
                    opacity: (currentUser?.coins || 0) >= VERIFICATION_PACKAGE_COST ? 1 : 0.6
                  }}
                >
                  {(currentUser?.coins || 0) >= VERIFICATION_PACKAGE_COST ? 'Purchase' : 'Need More Coins'}
                </button>
              </div>
            </div>
          )}

          {/* Withdraw Section */}
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '1rem',
            padding: '1rem',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{ color: 'white', fontWeight: 'bold', marginBottom: '0.5rem' }}>💰 Withdraw (USDT TRC20)</h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', marginBottom: '0.75rem' }}>
              Min: ${MIN_WITHDRAW_DOLLARS} ({MIN_WITHDRAW_COINS.toLocaleString()} coins) • {ADMIN_COMMISSION_RATE * 100}% service fee
            </p>
            
            {/* USDT TRC20 Wallet Address Input */}
            <input
              type="text"
              placeholder="Enter your TRC20 Wallet Address here"
              value={usdtWalletAddress}
              onChange={e => setUsdtWalletAddress(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '0.75rem',
                color: 'white',
                marginBottom: '0.5rem',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'monospace'
              }}
            />
            
            {/* TRC20 Network Warning */}
            <div style={{
              background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '0.5rem',
              padding: '0.5rem 0.75rem',
              marginBottom: '0.75rem'
            }}>
              <p style={{ color: '#fca5a5', fontSize: '0.6875rem', lineHeight: '1.4' }}>
                ⚠️ Please ensure you send funds via the TRC20 network to avoid loss of funds.
              </p>
            </div>
            
            {/* TRC20 Confirmation Checkbox */}
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.75rem',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={trc20Confirmed}
                onChange={e => setTrc20Confirmed(e.target.checked)}
                style={{
                  width: '1.25rem',
                  height: '1.25rem',
                  accentColor: '#22c55e'
                }}
              />
              <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.8125rem' }}>
                I confirm that this is a TRC20 network address.
              </span>
            </label>
            
            {/* Withdrawal Summary */}
            {(() => {
              const coins = currentUser?.coins || 0
              const hasEnoughCoins = coins >= MIN_WITHDRAW_COINS
              const isVerified = currentUser?.hasPurchasedVerificationPackage
              const canActuallyWithdraw = hasEnoughCoins && isVerified
              const grossAmount = coins / WITHDRAW_RATE
              const adminFee = grossAmount * ADMIN_COMMISSION_RATE
              const netAmount = grossAmount - adminFee

              // Determine button state
              const getButtonState = () => {
                if (!hasEnoughCoins) {
                  return {
                    text: `🔒 Need $${MIN_WITHDRAW_DOLLARS} (${MIN_WITHDRAW_COINS.toLocaleString()} coins)`,
                    disabled: true,
                    bg: '#4b5563'
                  }
                }
                if (!isVerified) {
                  return {
                    text: '🔒 Unlock Withdrawal',
                    disabled: false,
                    bg: 'linear-gradient(135deg, #ec4899, #8b5cf6)'
                  }
                }
                return {
                  text: '💸 Request Withdrawal',
                  disabled: false,
                  bg: '#22c55e'
                }
              }
              const buttonState = getButtonState()

              return (
                <>
                  {/* Show summary if can withdraw OR has enough coins but needs verification */}
                  {(canActuallyWithdraw || (hasEnoughCoins && !isVerified)) && (
                    <div style={{
                      background: canActuallyWithdraw ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)',
                      padding: '0.875rem',
                      borderRadius: '0.75rem',
                      marginBottom: '0.75rem',
                      border: canActuallyWithdraw ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(234,179,8,0.3)'
                    }}>
                      <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginBottom: '0.5rem' }}>Withdrawal Summary:</p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8125rem' }}>Coins:</span>
                        <span style={{ color: 'white', fontSize: '0.875rem' }}>💎 {coins.toLocaleString()}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8125rem' }}>Gross Amount:</span>
                        <span style={{ color: 'white', fontSize: '0.875rem' }}>${grossAmount.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span style={{ color: '#ef4444', fontSize: '0.8125rem' }}>Service Fee (10%):</span>
                        <span style={{ color: '#ef4444', fontSize: '0.875rem' }}>-${adminFee.toFixed(2)}</span>
                      </div>
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '0.5rem', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#22c55e', fontSize: '0.875rem', fontWeight: 'bold' }}>You Receive:</span>
                        <span style={{ color: '#22c55e', fontSize: '1rem', fontWeight: 'bold' }}>${netAmount.toFixed(2)}</span>
                      </div>
                      {!isVerified && hasEnoughCoins && (
                        <div style={{
                          marginTop: '0.75rem',
                          padding: '0.5rem',
                          background: 'rgba(239,68,68,0.2)',
                          borderRadius: '0.5rem',
                          border: '1px solid rgba(239,68,68,0.3)'
                        }}>
                          <p style={{ color: '#fca5a5', fontSize: '0.75rem', textAlign: 'center' }}>
                            ⚠️ Purchase Verification Package to unlock withdrawal
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    onClick={requestWithdrawal}
                    disabled={buttonState.disabled}
                    style={{
                      width: '100%',
                      padding: '0.875rem',
                      background: buttonState.bg,
                      borderRadius: '0.75rem',
                      fontWeight: 'bold',
                      color: 'white',
                      border: 'none',
                      cursor: buttonState.disabled ? 'not-allowed' : 'pointer',
                      opacity: buttonState.disabled ? 0.7 : 1,
                      fontSize: '0.9375rem'
                    }}
                  >
                    {buttonState.text}
                  </button>
                </>
              )
            })()}
          </div>

          {/* First Time Offer */}
          {!currentUser?.hasUsedFirstTimeOffer && (
            <div style={{ marginBottom: '1.5rem' }}>
              <span style={{
                background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                color: 'white',
                fontSize: '0.75rem',
                padding: '0.25rem 0.75rem',
                borderRadius: '9999px',
                fontWeight: 'bold'
              }}>
                🎉 FIRST TIME OFFER
              </span>
              <button
                onClick={() => setSelectedPackage(FIRST_TIME_OFFER)}
                style={{
                  width: '100%',
                  marginTop: '0.75rem',
                  padding: '1rem',
                  borderRadius: '1rem',
                  border: selectedPackage?.isOffer ? '3px solid #22c55e' : '2px solid rgba(245,158,11,0.5)',
                  background: selectedPackage?.isOffer
                    ? 'rgba(34,197,94,0.2)'
                    : 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(239,68,68,0.2))',
                  color: 'white',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', textDecoration: 'line-through' }}>
                  💎 {FIRST_TIME_OFFER.originalCoins?.toLocaleString()}
                </p>
                <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fef3c7' }}>
                  💎 {FIRST_TIME_OFFER.coins.toLocaleString()}
                </p>
                <p style={{ fontSize: '1rem', fontWeight: 'bold', color: '#22c55e' }}>${FIRST_TIME_OFFER.price}</p>
              </button>
            </div>
          )}

          {/* Top Up Packages */}
          <h3 style={{ color: 'white', fontWeight: 'bold', marginBottom: '1rem' }}>Top Up</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {TOP_UP_PACKAGES.map((p, i) => (
              <button
                key={i}
                onClick={() => setSelectedPackage(p)}
                style={{
                  padding: '1rem',
                  borderRadius: '1rem',
                  border: 'none',
                  background: selectedPackage === p
                    ? '#ec4899'
                    : p.isVIP
                      ? 'linear-gradient(135deg, #eab308, #f97316)'
                      : 'rgba(255,255,255,0.1)',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                <p style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>💎 {p.coins}</p>
                <p style={{ fontSize: '0.875rem' }}>${p.price}</p>
              </button>
            ))}
          </div>

          {/* Admin Manual Coin Addition - For Testing */}
          {currentUser?.isAdmin && (
            <div style={{
              background: 'rgba(34,197,94,0.2)',
              borderRadius: '1rem',
              padding: '1rem',
              marginBottom: '1rem',
              border: '2px solid rgba(34,197,94,0.5)'
            }}>
              <p style={{ color: '#22c55e', fontWeight: 'bold', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                🔧 Admin: Manual Coin Addition
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="number"
                  placeholder="Coin amount"
                  value={manualCoinAmount}
                  onChange={e => setManualCoinAmount(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    borderRadius: '0.5rem',
                    border: 'none',
                    background: 'rgba(255,255,255,0.9)',
                    color: '#1f2937'
                  }}
                />
                <button
                  onClick={addManualCoins}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#22c55e',
                    borderRadius: '0.5rem',
                    border: 'none',
                    color: 'white',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          )}

          {/* OxaPay USDT TRC20 Payment Section */}
          {selectedPackage && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(16,185,129,0.2))',
              borderRadius: '1rem',
              padding: '1.25rem',
              marginBottom: '1.5rem',
              border: '1px solid rgba(34,197,94,0.3)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '1.5rem' }}>💎</span>
                <div>
                  <p style={{ color: 'white', fontWeight: 'bold', fontSize: '1.125rem' }}>
                    {selectedPackage.coins.toLocaleString()} Coins
                  </p>
                  <p style={{ color: '#22c55e', fontWeight: 'bold' }}>${selectedPackage.price.toFixed(2)}</p>
                </div>
              </div>
              
              {/* Payment Method */}
              <div style={{
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '0.75rem',
                padding: '1rem',
                marginBottom: '0.75rem'
              }}>
                <p style={{ color: '#22c55e', fontWeight: 'bold', fontSize: '0.9375rem', marginBottom: '0.5rem' }}>
                  💳 Payment Method: USDT (TRC20 Only)
                </p>
                <div style={{
                  background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: '0.5rem',
                  padding: '0.5rem 0.75rem'
                }}>
                  <p style={{ color: '#fca5a5', fontSize: '0.6875rem', lineHeight: '1.4' }}>
                    ⚠️ Please ensure you send funds via the TRC20 network to avoid loss of funds.
                  </p>
                </div>
              </div>
              
              {/* Pay Button */}
              <button
                onClick={() => processOxaPayPayment(selectedPackage)}
                style={{
                  width: '100%',
                  padding: '1rem',
                  background: 'linear-gradient(135deg, #22c55e, #10b981)',
                  borderRadius: '0.75rem',
                  border: 'none',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                <span>💰</span>
                Pay ${selectedPackage.price.toFixed(2)} USDT (TRC20)
              </button>
              
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.6875rem', textAlign: 'center', marginTop: '0.5rem' }}>
                Powered by OxaPay • Secure Crypto Payment
              </p>
            </div>
          )}
        </div>
      )}

      {/* Free Coins Screen - 10 Independent Ad Slots */}
      {currentScreen === 'freecoins' && (
        <div style={{ padding: '1rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white', marginBottom: '0.5rem', textAlign: 'center' }}>
            🎁 Free Coins
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem', textAlign: 'center', marginBottom: '1.5rem' }}>
            Watch 3 ads per slot to earn 💎 {AD_REWARD_COINS} coins!
          </p>

          {/* Progress Summary */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(249,115,22,0.2), rgba(239,68,68,0.15))',
            borderRadius: '1rem',
            padding: '1rem',
            marginBottom: '1.5rem',
            border: '1px solid rgba(249,115,22,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem' }}>Completed Slots</p>
                <p style={{ color: 'white', fontWeight: 'bold', fontSize: '1.25rem' }}>
                  {Object.values(adSlotStatus).filter(s => s === 'completed').length} / 10
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem' }}>Total Earned Today</p>
                <p style={{ color: '#22c55e', fontWeight: 'bold', fontSize: '1.25rem' }}>
                  💎 {Object.values(adSlotStatus).filter(s => s === 'completed').length * AD_REWARD_COINS}
                </p>
              </div>
            </div>
          </div>

          {/* 10 Ad Slots */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(slotNum => {
              const status = adSlotStatus[slotNum]
              const isCompleted = status === 'completed'
              const isWatching = status === 'watching'

              return (
                <button
                  key={slotNum}
                  onClick={() => !isCompleted && !isWatching && startSlotAdWatch(slotNum)}
                  disabled={isCompleted || isWatching}
                  className={`ad-slot-button ${isCompleted ? 'ad-slot-completed' : ''}`}
                  style={{
                    padding: '1rem',
                    borderRadius: '1rem',
                    border: 'none',
                    background: isCompleted
                      ? 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(22,163,74,0.15))'
                      : isWatching
                      ? 'linear-gradient(135deg, rgba(234,179,8,0.2), rgba(245,158,11,0.15))'
                      : 'linear-gradient(135deg, rgba(249,115,22,0.2), rgba(239,68,68,0.15))',
                    cursor: isCompleted ? 'not-allowed' : 'pointer',
                    textAlign: 'center',
                    opacity: isCompleted ? 0.7 : 1,
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>
                    {isCompleted ? '✅' : isWatching ? '⏳' : '📺'}
                  </div>
                  <p style={{ color: 'white', fontWeight: 'bold', fontSize: '0.875rem' }}>
                    Slot {slotNum}
                  </p>
                  <p style={{
                    color: isCompleted ? '#22c55e' : isWatching ? '#eab308' : 'rgba(255,255,255,0.7)',
                    fontSize: '0.75rem'
                  }}>
                    {isCompleted ? 'Completed' : isWatching ? 'Watching...' : '3 Ads • 💎50'}
                  </p>
                </button>
              )
            })}
          </div>

          {/* Info Box */}
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '1rem',
            padding: '1rem',
            marginTop: '1.5rem',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8125rem', lineHeight: '1.5' }}>
              💡 <strong style={{ color: 'white' }}>How it works:</strong> Each slot plays 3 consecutive ads. After watching all 3 ads, you'll receive 💎 {AD_REWARD_COINS} coins. Complete all 10 slots to earn 💎 {AD_REWARD_COINS * 10} coins daily!
            </p>
          </div>

          {/* Total Potential */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(22,163,74,0.1))',
            borderRadius: '1rem',
            padding: '1rem',
            marginTop: '1rem',
            textAlign: 'center',
            border: '1px solid rgba(34,197,94,0.3)'
          }}>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem' }}>Total Potential Today</p>
            <p style={{ color: '#22c55e', fontWeight: 'bold', fontSize: '1.5rem' }}>
              💎 {AD_REWARD_COINS * 10} coins
            </p>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.6875rem' }}>
              = ${((AD_REWARD_COINS * 10) / WITHDRAW_RATE).toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Profile Screen */}
      {currentScreen === 'profile' && (
        <div style={{ padding: '1rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white', marginBottom: '1.5rem', textAlign: 'center' }}>Profile</h2>
          
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem', position: 'relative' }}>
            <img
              src={currentUser?.photoURL}
              alt="Profile"
              style={{
                width: '7rem',
                height: '7rem',
                borderRadius: '9999px',
                border: '4px solid #ec4899',
                objectFit: 'cover'
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                position: 'absolute',
                bottom: 0,
                right: 'calc(50% - 4rem)',
                width: '2.5rem',
                height: '2.5rem',
                background: '#ec4899',
                borderRadius: '9999px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              📷
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={e => e.target.files?.[0] && uploadPhoto(e.target.files[0])}
              style={{ display: 'none' }}
            />
          </div>

          <input
            type="text"
            placeholder="Name"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '0.75rem',
              color: 'white',
              marginBottom: '0.75rem',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          <textarea
            placeholder="Bio"
            value={editBio}
            onChange={e => setEditBio(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '0.75rem',
              color: 'white',
              marginBottom: '0.75rem',
              outline: 'none',
              resize: 'none',
              height: '5rem',
              boxSizing: 'border-box'
            }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <input
              type="number"
              placeholder="Age"
              value={editAge}
              onChange={e => setEditAge(e.target.value)}
              style={{
                padding: '0.75rem',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '0.75rem',
                color: 'white',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box'
              }}
            />
            <select
              value={editGender}
              onChange={e => setEditGender(e.target.value)}
              style={{
                padding: '0.75rem',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '0.75rem',
                color: 'white',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box'
              }}
            >
              <option value="Male" style={{ background: '#1f2937' }}>Male</option>
              <option value="Female" style={{ background: '#1f2937' }}>Female</option>
            </select>
          </div>
          <input
            type="text"
            placeholder="Country"
            value={editCountry}
            onChange={e => setEditCountry(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '0.75rem',
              color: 'white',
              marginBottom: '0.75rem',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          <input
            type="text"
            placeholder="City"
            value={editCity}
            onChange={e => setEditCity(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '0.75rem',
              color: 'white',
              marginBottom: '0.75rem',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          <button
            onClick={saveProfile}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'linear-gradient(to right, #ec4899, #8b5cf6)',
              borderRadius: '0.75rem',
              fontWeight: 'bold',
              color: 'white',
              border: 'none',
              marginBottom: '0.75rem',
              cursor: 'pointer'
            }}
          >
            Save
          </button>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'rgba(239,68,68,0.2)',
              border: '1px solid #ef4444',
              borderRadius: '0.75rem',
              fontWeight: 'bold',
              color: '#ef4444',
              cursor: 'pointer'
            }}
          >
            Logout
          </button>
        </div>
      )}

      {/* Premium Screen */}
      {currentScreen === 'premium' && (
        <div style={{ padding: '1rem', minHeight: 'calc(100vh - 120px)' }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'white', marginBottom: '1.5rem', textAlign: 'center' }}>
            👑 Premium Services
          </h2>
          
          {/* Tab Navigation */}
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            marginBottom: '1.5rem',
            background: 'rgba(255,255,255,0.05)',
            padding: '0.25rem',
            borderRadius: '1rem'
          }}>
            <button
              onClick={() => setPremiumTab('message')}
              style={{
                flex: 1,
                padding: '1rem',
                background: premiumTab === 'message' 
                  ? 'linear-gradient(135deg, #ec4899, #8b5cf6)' 
                  : 'transparent',
                border: 'none',
                borderRadius: '0.75rem',
                color: 'white',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              💬 Message
            </button>
            <button
              onClick={() => setPremiumTab('video')}
              style={{
                flex: 1,
                padding: '1rem',
                background: premiumTab === 'video' 
                  ? 'linear-gradient(135deg, #eab308, #f97316)' 
                  : 'transparent',
                border: 'none',
                borderRadius: '0.75rem',
                color: 'white',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              📹 Video Call
            </button>
          </div>
          
          {/* Message Tab */}
          {premiumTab === 'message' && (
            <div>
              <div style={{
                background: 'linear-gradient(135deg, rgba(236,72,153,0.2), rgba(139,92,246,0.2))',
                borderRadius: '1rem',
                padding: '1rem',
                marginBottom: '1.5rem',
                border: '1px solid rgba(236,72,153,0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}>
                <span style={{ fontSize: '2rem' }}>💬</span>
                <div>
                  <p style={{ color: '#fef3c7', fontWeight: 'bold' }}>Private Messaging</p>
                  <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem' }}>💎 10 coins per message</p>
                </div>
              </div>
              
              <h3 style={{ color: 'white', fontWeight: 'bold', marginBottom: '0.75rem' }}>💬 Chat with Hosts</h3>
              {users.filter(u => u.gender === 'Female').length === 0 ? (
                <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', padding: '2rem' }}>No hosts available</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {users.filter(u => u.gender === 'Female').map(u => (
                    <div
                      key={u.uid}
                      onClick={() => {
                        setChatRecipient(u)
                        setShowChatModal(true)
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
                        padding: '1rem',
                        borderRadius: '1rem',
                        cursor: 'pointer',
                        border: '1px solid rgba(255,255,255,0.1)',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      <div style={{ position: 'relative' }}>
                        <img
                          src={getAvatar(u)}
                          alt={u.displayName}
                          style={{ width: '3.5rem', height: '3.5rem', borderRadius: '9999px', objectFit: 'cover', border: '2px solid #ec4899' }}
                        />
                        {isUserOnline(u) && (
                          <div style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            width: '0.875rem',
                            height: '0.875rem',
                            background: '#22c55e',
                            borderRadius: '9999px',
                            border: '2px solid #581c87'
                          }} />
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ color: 'white', fontWeight: 'bold' }}>{u.displayName}</p>
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>
                          {isUserOnline(u) ? '🟢 Online' : '⚫ Offline'}
                        </p>
                      </div>
                      <div style={{
                        background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                        padding: '0.5rem 1rem',
                        borderRadius: '9999px',
                        color: 'white',
                        fontSize: '0.75rem',
                        fontWeight: 'bold'
                      }}>
                        💬 Chat
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Video Call Tab */}
          {premiumTab === 'video' && (
            <div>
              <div style={{
                background: 'linear-gradient(135deg, rgba(234,179,8,0.2), rgba(239,68,68,0.2))',
                borderRadius: '1rem',
                padding: '1rem',
                marginBottom: '1.5rem',
                border: '1px solid rgba(234,179,8,0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}>
                <span style={{ fontSize: '2rem' }}>📹</span>
                <div>
                  <p style={{ color: '#fef3c7', fontWeight: 'bold' }}>Premium Video Call</p>
                  <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem' }}>💎 {PREMIUM_VIDEO_CALL_RATE} coins/min</p>
                </div>
              </div>
              
              <h3 style={{ color: 'white', fontWeight: 'bold', marginBottom: '0.75rem' }}>📹 Video Call Hosts</h3>
              {users.filter(u => u.gender === 'Female').length === 0 ? (
                <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', padding: '2rem' }}>No hosts available</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {users.filter(u => u.gender === 'Female').map(u => (
                    <div
                      key={u.uid}
                      onClick={() => startPremiumVideoCall(u)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        background: 'rgba(255,255,255,0.1)',
                        padding: '1rem',
                        borderRadius: '1rem',
                        cursor: 'pointer',
                        border: '1px solid rgba(255,255,255,0.1)'
                      }}
                    >
                      <div style={{ position: 'relative' }}>
                        <img
                          src={getAvatar(u)}
                          alt={u.displayName}
                          style={{ width: '3.5rem', height: '3.5rem', borderRadius: '9999px', objectFit: 'cover', border: '2px solid #eab308' }}
                        />
                        {isUserOnline(u) && (
                          <div style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            width: '0.875rem',
                            height: '0.875rem',
                            background: '#22c55e',
                            borderRadius: '9999px',
                            border: '2px solid #581c87'
                          }} />
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ color: 'white', fontWeight: 'bold' }}>{u.displayName}</p>
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>
                          {isUserOnline(u) ? '🟢 Online' : '⚫ Offline'}
                        </p>
                      </div>
                      <div style={{
                        background: 'linear-gradient(135deg, #eab308, #f97316)',
                        padding: '0.5rem 1rem',
                        borderRadius: '9999px',
                        color: 'white',
                        fontSize: '0.75rem',
                        fontWeight: 'bold'
                      }}>
                        📹 Call
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Live Screen - Fullscreen */}
      {showLiveScreen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: '#000',
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Video fills entire screen */}
          <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%' }}>
            {isHostLive ? (
              <div id="local-player" style={{ width: '100%', height: '100%' }} />
            ) : (
              <div id="remote-player" style={{ width: '100%', height: '100%' }}>
                {isConnecting && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0,0,0,0.8)'
                  }}>
                    <p style={{ color: 'white' }}>Connecting...</p>
                  </div>
                )}
                {connectionError && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <p style={{ color: '#ef4444' }}>{connectionError}</p>
                  </div>
                )}
                {!remoteVideoTrack && !isConnecting && !connectionError && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <p style={{ color: 'white' }}>Waiting for host...</p>
                  </div>
                )}
              </div>
            )}

            {/* Host info - Top Left Overlay - Premium Design with Glassmorphism */}
            <div className="host-pill" style={{
              position: 'absolute',
              top: '1rem',
              left: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.5rem 1rem',
              borderRadius: '9999px',
              background: 'rgba(0, 0, 0, 0.45)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
            }}>
              <div style={{ position: 'relative' }}>
                <img
                  src={isHostLive ? getAvatar(currentUser) : getAvatar(currentHost)}
                  alt=""
                  style={{ 
                    width: '2.375rem', 
                    height: '2.375rem', 
                    borderRadius: '9999px', 
                    border: '2px solid rgba(236, 72, 153, 0.8)',
                    objectFit: 'cover',
                    boxShadow: '0 2px 8px rgba(236, 72, 153, 0.3)'
                  }}
                />
                <div 
                  className="online-indicator"
                  style={{
                    position: 'absolute',
                    bottom: '-2px',
                    right: '-2px',
                    width: '0.75rem',
                    height: '0.75rem',
                    background: '#22c55e',
                    borderRadius: '9999px',
                    border: '2px solid rgba(0, 0, 0, 0.6)'
                  }}
                />
              </div>
              <span style={{ 
                color: 'white', 
                fontWeight: '600', 
                fontSize: '0.9375rem', 
                letterSpacing: '-0.015em',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)'
              }}>
                {isHostLive ? currentUser?.displayName : currentHost?.displayName}
              </span>
              {isHostLive && (
                <span 
                  className="live-badge" 
                  style={{ 
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)', 
                    color: 'white', 
                    fontSize: '0.5625rem', 
                    padding: '0.25rem 0.625rem', 
                    borderRadius: '0.375rem', 
                    fontWeight: '700',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)'
                  }}
                >LIVE</span>
              )}
            </div>

            {/* Exit button - Top Right - Premium Design */}
            <button
              onClick={exitLive}
              className="glass-dark"
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'rgba(239, 68, 68, 0.85)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '9999px',
                width: '2.875rem',
                height: '2.875rem',
                cursor: 'pointer',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>

            {/* Viewers count - Premium Design with Eye Icon */}
            {!isHostLive && (
              <div 
                className="viewers-badge" 
                style={{
                  position: 'absolute',
                  top: '1rem',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  padding: '0.5rem 1rem',
                  borderRadius: '9999px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: 'rgba(0, 0, 0, 0.5)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255, 255, 255, 0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                <span style={{ 
                  color: 'rgba(255, 255, 255, 0.95)', 
                  fontWeight: '500', 
                  fontSize: '0.8125rem',
                  letterSpacing: '-0.01em'
                }}>{viewers}</span>
              </div>
            )}

            {/* Host controls - Bottom Center - Premium Design */}
            {isHostLive && (
              <div style={{
                position: 'absolute',
                bottom: '5.5rem',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: '0.875rem',
                padding: '0.5rem',
                background: 'rgba(0,0,0,0.4)',
                borderRadius: '9999px',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}>
                <button
                  onClick={toggleMic}
                  style={{
                    width: '3.25rem',
                    height: '3.25rem',
                    borderRadius: '9999px',
                    border: micEnabled ? '1px solid rgba(255,255,255,0.2)' : 'none',
                    background: micEnabled ? 'rgba(255,255,255,0.15)' : 'linear-gradient(135deg, #ef4444, #dc2626)',
                    cursor: 'pointer',
                    fontSize: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {micEnabled ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                      <line x1="12" y1="19" x2="12" y2="23"></line>
                      <line x1="8" y1="23" x2="16" y2="23"></line>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
                      <line x1="12" y1="19" x2="12" y2="23"></line>
                      <line x1="8" y1="23" x2="16" y2="23"></line>
                    </svg>
                  )}
                </button>
                <button
                  onClick={toggleCam}
                  style={{
                    width: '3.25rem',
                    height: '3.25rem',
                    borderRadius: '9999px',
                    border: camEnabled ? '1px solid rgba(255,255,255,0.2)' : 'none',
                    background: camEnabled ? 'rgba(255,255,255,0.15)' : 'linear-gradient(135deg, #ef4444, #dc2626)',
                    cursor: 'pointer',
                    fontSize: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {camEnabled ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 7l-7 5 7 5V7z"></path>
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  )}
                </button>
                <button
                  onClick={exitLive}
                  style={{
                    width: '3.25rem',
                    height: '3.25rem',
                    borderRadius: '9999px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    cursor: 'pointer',
                    fontSize: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 15px rgba(239,68,68,0.4)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"></path>
                    <line x1="23" y1="1" x2="1" y2="23"></line>
                  </svg>
                </button>
              </div>
            )}

            {/* Gift button for viewers - Premium Design */}
            {!isHostLive && currentHostId && (
              <button
                onClick={() => setShowGiftPanel(!showGiftPanel)}
                style={{
                  position: 'absolute',
                  bottom: '5.5rem',
                  right: '1rem',
                  background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                  border: 'none',
                  borderRadius: '9999px',
                  padding: '0.75rem 1.25rem',
                  cursor: 'pointer',
                  color: 'white',
                  fontWeight: '600',
                  fontSize: '0.875rem',
                  boxShadow: '0 4px 20px rgba(236,72,153,0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  letterSpacing: '-0.01em',
                  transition: 'all 0.2s ease'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 12 20 22 4 22 4 12"></polyline>
                  <rect x="2" y="7" width="20" height="5"></rect>
                  <line x1="12" y1="22" x2="12" y2="7"></line>
                  <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path>
                  <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path>
                </svg>
                Gift
              </button>
            )}

            {/* Chat Overlay - Bottom Transparent Scrolling Chat */}
            <div style={{
              position: 'absolute',
              left: '1rem',
              right: '1rem',
              bottom: '1rem',
              maxWidth: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              pointerEvents: 'none'
            }}>
              {/* Chat messages area - transparent bottom-to-top scrolling */}
              <div 
                className="chat-scroll"
                style={{ 
                  maxHeight: '12rem',
                  overflow: 'auto',
                  padding: '0.5rem',
                  background: 'transparent',
                  borderRadius: '1rem',
                  pointerEvents: 'auto',
                  display: 'flex',
                  flexDirection: 'column-reverse',
                  gap: '0.375rem'
              }}>
                {[...chatMessages].reverse().map((m, index) => (
                  <div 
                    key={m.id} 
                    className="message-enter glass-chat-bubble"
                    style={{ 
                      display: 'flex', 
                      alignItems: 'flex-start', 
                      gap: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      background: 'rgba(0, 0, 0, 0.35)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '0.875rem',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
                  }}>
                    <img
                      src={m.senderPhoto}
                      alt=""
                      style={{ 
                        width: '1.5rem', 
                        height: '1.5rem', 
                        borderRadius: '9999px',
                        border: '1.5px solid rgba(236, 72, 153, 0.5)',
                        flexShrink: 0
                      }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ 
                        color: '#f472b6', 
                        fontSize: '0.625rem', 
                        fontWeight: '600',
                        letterSpacing: '0.01em',
                        display: 'block',
                        marginBottom: '0.125rem'
                      }}>{m.senderName}</span>
                      <p style={{ 
                        color: 'rgba(255, 255, 255, 0.95)', 
                        fontSize: '0.75rem',
                        lineHeight: '1.3',
                        wordBreak: 'break-word'
                      }}>{m.text}</p>
                    </div>
                  </div>
                ))}
              </div>
              {/* Message input - Premium floating pill design */}
              <div style={{ 
                display: 'flex', 
                gap: '0.5rem',
                alignItems: 'center',
                pointerEvents: 'auto',
                padding: '0.25rem'
              }}>
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && sendChatMessage()}
                  placeholder="Type a message..."
                  className="glass-input"
                  style={{
                    flex: 1,
                    padding: '0.75rem 1rem',
                    background: 'rgba(0, 0, 0, 0.45)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '9999px',
                    color: 'white',
                    outline: 'none',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    fontSize: '0.8125rem',
                    fontWeight: '400',
                    letterSpacing: '-0.01em',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                    transition: 'all 0.2s ease'
                  }}
                />
                <button
                  onClick={sendChatMessage}
                  className="btn-primary"
                  style={{
                    background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                    border: 'none',
                    borderRadius: '9999px',
                    width: '2.5rem',
                    height: '2.5rem',
                    cursor: 'pointer',
                    color: 'white',
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 16px rgba(236, 72, 153, 0.4)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Gift panel - Horizontal Scrolling Overlay with Glassmorphism */}
          {showGiftPanel && (
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              padding: '1rem',
              borderTopLeftRadius: '1.5rem',
              borderTopRightRadius: '1.5rem',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderTop: '1px solid rgba(255, 255, 255, 0.15)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ color: 'white', fontWeight: 'bold', fontSize: '1rem' }}>🎁 Send Romantic Gift</h3>
                <button onClick={() => setShowGiftPanel(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', fontSize: '1rem', cursor: 'pointer', borderRadius: '50%', width: '2rem', height: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
              {/* Horizontal scrolling gifts */}
              <div style={{ 
                display: 'flex', 
                gap: '0.75rem', 
                overflowX: 'auto', 
                paddingBottom: '0.5rem',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
              className="chat-scroll"
              >
                {GIFTS.map((g, i) => (
                  <button
                    key={i}
                    onClick={() => sendGift(g)}
                    disabled={(currentUser?.coins || 0) < g.cost}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0.75rem 1rem',
                      minWidth: '5rem',
                      background: (currentUser?.coins || 0) >= g.cost 
                        ? 'linear-gradient(135deg, rgba(249, 115, 22, 0.2), rgba(239, 68, 68, 0.15))' 
                        : 'rgba(255, 255, 255, 0.05)',
                      border: (currentUser?.coins || 0) >= g.cost 
                        ? '1px solid rgba(249, 115, 22, 0.4)' 
                        : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '1rem',
                      cursor: (currentUser?.coins || 0) >= g.cost ? 'pointer' : 'not-allowed',
                      opacity: (currentUser?.coins || 0) >= g.cost ? 1 : 0.5,
                      transition: 'all 0.2s ease',
                      flexShrink: 0
                    }}
                  >
                    <span style={{ fontSize: '1.75rem' }}>{g.emoji}</span>
                    <span style={{ color: 'white', fontSize: '0.6875rem', marginTop: '0.25rem', fontWeight: '500', textAlign: 'center', maxWidth: '4rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                    <span style={{ color: '#eab308', fontSize: '0.75rem', fontWeight: 'bold', marginTop: '0.125rem' }}>💎 {g.cost}</span>
                  </button>
                ))}
              </div>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.6875rem', textAlign: 'center', marginTop: '0.5rem' }}>
                Your balance: 💎 {currentUser?.coins?.toLocaleString() || 0}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Verification Package Purchase Modal */}
      {showVerificationModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 11000,
          padding: '1rem'
        }}>
          <div className="glass-modal" style={{
            background: 'linear-gradient(145deg, rgba(30,30,46,0.98), rgba(45,31,61,0.98))',
            borderRadius: '1.5rem',
            padding: '1.75rem',
            width: '100%',
            maxWidth: '22rem',
            textAlign: 'center',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 32px 64px rgba(0,0,0,0.5)'
          }}>
            {/* Icon */}
            <div style={{
              width: '4rem',
              height: '4rem',
              background: 'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(236,72,153,0.3))',
              borderRadius: '9999px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              border: '2px solid rgba(139,92,246,0.4)'
            }}>
              <span style={{ fontSize: '2rem' }}>🛡️</span>
            </div>
            
            {/* Title */}
            <h3 style={{ 
              color: 'white', 
              fontSize: '1.25rem', 
              fontWeight: '700', 
              marginBottom: '0.5rem',
              letterSpacing: '-0.02em'
            }}>
              Verification Package
            </h3>
            
            {/* Description */}
            <p style={{ 
              color: 'rgba(255,255,255,0.6)', 
              fontSize: '0.8125rem', 
              marginBottom: '1.25rem',
              lineHeight: '1.6'
            }}>
              Purchase this one-time verification package to unlock withdrawals. This helps us verify your account and prevent fraud.
            </p>

            {/* Package Details */}
            <div style={{
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '1rem',
              padding: '1rem',
              marginBottom: '1.25rem',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem' }}>Cost:</span>
                <span style={{ color: '#f472b6', fontSize: '1.125rem', fontWeight: 'bold' }}>💎 {VERIFICATION_PACKAGE_COST.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem' }}>Value:</span>
                <span style={{ color: '#22c55e', fontSize: '1rem', fontWeight: '600' }}>${VERIFICATION_PACKAGE_DOLLARS}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem' }}>Your Balance:</span>
                <span style={{ color: 'white', fontSize: '1rem' }}>💎 {(currentUser?.coins || 0).toLocaleString()}</span>
              </div>
            </div>

            {/* Warning */}
            <div style={{
              background: 'rgba(234,179,8,0.15)',
              border: '1px solid rgba(234,179,8,0.3)',
              borderRadius: '0.75rem',
              padding: '0.75rem',
              marginBottom: '1.25rem'
            }}>
              <p style={{ color: '#fef3c7', fontSize: '0.75rem', lineHeight: '1.5' }}>
                ⚠️ After purchase, you'll need to earn back to ${MIN_WITHDRAW_DOLLARS} to withdraw.
              </p>
            </div>
            
            {/* Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setShowVerificationModal(false)}
                disabled={verificationPurchasing}
                style={{
                  flex: 1,
                  padding: '0.875rem 1rem',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '9999px',
                  color: 'white',
                  fontWeight: '600',
                  cursor: verificationPurchasing ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  opacity: verificationPurchasing ? 0.5 : 1,
                  transition: 'all 0.2s ease'
                }}
              >
                Cancel
              </button>
              <button
                onClick={purchaseVerificationPackage}
                disabled={verificationPurchasing || (currentUser?.coins || 0) < VERIFICATION_PACKAGE_COST}
                style={{
                  flex: 1,
                  padding: '0.875rem 1rem',
                  background: verificationPurchasing 
                    ? '#4b5563' 
                    : 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                  border: 'none',
                  borderRadius: '9999px',
                  color: 'white',
                  fontWeight: '700',
                  cursor: verificationPurchasing ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  boxShadow: '0 4px 15px rgba(236,72,153,0.4)',
                  transition: 'all 0.2s ease'
                }}
              >
                {verificationPurchasing ? 'Processing...' : 'Purchase Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Premium Exit Confirmation Modal */}
      {showExitModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 11000,
          padding: '1rem'
        }}>
          <div style={{
            background: 'linear-gradient(145deg, rgba(30,30,46,0.98), rgba(45,31,61,0.98))',
            borderRadius: '1.25rem',
            padding: '1.75rem',
            width: '100%',
            maxWidth: '20rem',
            textAlign: 'center',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(20px)'
          }}>
            {/* Icon */}
            <div style={{
              width: '3.5rem',
              height: '3.5rem',
              background: 'rgba(239,68,68,0.15)',
              borderRadius: '9999px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              border: '1px solid rgba(239,68,68,0.3)'
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"></path>
                <line x1="23" y1="1" x2="1" y2="23"></line>
              </svg>
            </div>
            
            {/* Title */}
            <h3 style={{ 
              color: 'white', 
              fontSize: '1.125rem', 
              fontWeight: '600', 
              marginBottom: '0.375rem',
              letterSpacing: '-0.02em'
            }}>
              End Session?
            </h3>
            
            {/* Subtitle */}
            <p style={{ 
              color: 'rgba(255,255,255,0.5)', 
              fontSize: '0.8125rem', 
              marginBottom: '1.5rem',
              lineHeight: '1.5',
              letterSpacing: '-0.005em'
            }}>
              Are you sure you want to stop your live stream?
            </p>
            
            {/* Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setShowExitModal(false)}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '9999px',
                  color: 'white',
                  fontWeight: '500',
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                  letterSpacing: '-0.01em',
                  transition: 'all 0.2s ease'
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmExitLive}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  border: 'none',
                  borderRadius: '9999px',
                  color: 'white',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                  letterSpacing: '-0.01em',
                  boxShadow: '0 4px 15px rgba(239,68,68,0.4)',
                  transition: 'all 0.2s ease'
                }}
              >
                End Live
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Premium Video Call Screen */}
      {showPremiumVideoCall && premiumVideoCallUser && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: '#000',
          zIndex: 9700,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div id="premium-remote-player" style={{ flex: 1, position: 'relative' }}>
            {!videoCallActive && !videoCallConnecting && (
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: '1rem'
              }}>
                <img
                  src={premiumVideoCallUser.photoURL}
                  alt=""
                  style={{ width: '6rem', height: '6rem', borderRadius: '9999px', border: '3px solid #ec4899' }}
                />
                <p style={{ color: 'white', fontWeight: 'bold', fontSize: '1.25rem' }}>{premiumVideoCallUser.displayName}</p>
                <button
                  onClick={acceptPremiumVideoCall}
                  style={{
                    padding: '1rem 2rem',
                    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                    borderRadius: '9999px',
                    color: 'white',
                    fontWeight: 'bold',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  📹 Start Call
                </button>
                <button
                  onClick={endPremiumVideoCall}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'rgba(239,68,68,0.2)',
                    border: '1px solid #ef4444',
                    borderRadius: '9999px',
                    color: '#ef4444',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
            {videoCallConnecting && (
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <p style={{ color: 'white' }}>Connecting...</p>
              </div>
            )}
          </div>

          {videoCallActive && (
            <div
              id="premium-local-player"
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                width: '6rem',
                height: '8rem',
                borderRadius: '0.75rem',
                overflow: 'hidden',
                border: '2px solid #ec4899'
              }}
            />
          )}

          {videoCallActive && (
            <div style={{
              position: 'absolute',
              top: '1rem',
              left: '1rem',
              background: 'rgba(0,0,0,0.5)',
              padding: '0.5rem 1rem',
              borderRadius: '9999px'
            }}>
              <p style={{ color: 'white', fontWeight: 'bold' }}>{formatDuration(videoCallDuration)}</p>
            </div>
          )}

          {videoCallActive && (
            <div style={{
              position: 'absolute',
              bottom: '2rem',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: '1rem'
            }}>
              <button
                onClick={() => {
                  if (premiumLocalTracks[0]) {
                    premiumLocalTracks[0].setEnabled(!premiumVideoMicEnabled)
                    setPremiumVideoMicEnabled(!premiumVideoMicEnabled)
                  }
                }}
                style={{
                  width: '3.5rem',
                  height: '3.5rem',
                  borderRadius: '9999px',
                  border: 'none',
                  background: premiumVideoMicEnabled ? 'rgba(255,255,255,0.2)' : '#ef4444',
                  cursor: 'pointer',
                  fontSize: '1.5rem'
                }}
              >
                {premiumVideoMicEnabled ? '🎤' : '🔇'}
              </button>
              <button
                onClick={endPremiumVideoCall}
                style={{
                  width: '3.5rem',
                  height: '3.5rem',
                  borderRadius: '9999px',
                  border: 'none',
                  background: '#ef4444',
                  cursor: 'pointer',
                  fontSize: '1.5rem'
                }}
              >
                📞
              </button>
              <button
                onClick={() => {
                  if (premiumLocalTracks[1]) {
                    premiumLocalTracks[1].setEnabled(!premiumVideoCamEnabled)
                    setPremiumVideoCamEnabled(!premiumVideoCamEnabled)
                  }
                }}
                style={{
                  width: '3.5rem',
                  height: '3.5rem',
                  borderRadius: '9999px',
                  border: 'none',
                  background: premiumVideoCamEnabled ? 'rgba(255,255,255,0.2)' : '#ef4444',
                  cursor: 'pointer',
                  fontSize: '1.5rem'
                }}
              >
                {premiumVideoCamEnabled ? '📹' : '📵'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* User Modal */}
      {showUserModal && selectedUser && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9000,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center'
        }}>
          <div
            onClick={() => setShowUserModal(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }}
          />
          <div style={{
            width: '100%',
            maxWidth: '28rem',
            background: 'linear-gradient(135deg, #581c87, #312e81)',
            borderRadius: '1.5rem 1.5rem 0 0',
            padding: '1.5rem',
            position: 'relative',
            zIndex: 10
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <img
                src={selectedUser.photoURL}
                alt={selectedUser.displayName}
                style={{
                  width: '6rem',
                  height: '6rem',
                  borderRadius: '9999px',
                  border: '3px solid #ec4899',
                  objectFit: 'cover'
                }}
              />
            </div>
            <h3 style={{ textAlign: 'center', color: 'white', fontWeight: 'bold', fontSize: '1.25rem', marginBottom: '0.25rem' }}>
              {selectedUser.displayName}
            </h3>
            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', marginBottom: '1rem' }}>
              {selectedUser.bio || 'No bio'}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '1rem' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: 'white', fontWeight: 'bold' }}>{selectedUser.followers?.length || 0}</p>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>Followers</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: 'white', fontWeight: 'bold' }}>{selectedUser.following?.length || 0}</p>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>Following</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => toggleFollow(selectedUser)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: Array.isArray(currentUser?.following) && currentUser.following.includes(selectedUser.uid) ? 'rgba(255,255,255,0.1)' : '#ec4899',
                  borderRadius: '9999px',
                  fontWeight: 'bold',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                {Array.isArray(currentUser?.following) && currentUser.following.includes(selectedUser.uid) ? 'Unfollow' : 'Follow'}
              </button>
              {selectedUser.gender === 'Female' && (
                <button
                  onClick={() => {
                    setShowUserModal(false)
                    startPremiumVideoCall(selectedUser)
                  }}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: 'linear-gradient(135deg, #eab308, #f97316)',
                    borderRadius: '9999px',
                    fontWeight: 'bold',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  📹 Call
                </button>
              )}
            </div>
            <button
              onClick={() => setShowUserModal(false)}
              style={{
                width: '100%',
                marginTop: '1rem',
                padding: '0.75rem',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '9999px',
                color: 'white',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Notifications Modal */}
      {showNotifications && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9000,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center'
        }}>
          <div
            onClick={() => setShowNotifications(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }}
          />
          <div style={{
            width: '100%',
            maxWidth: '28rem',
            background: 'linear-gradient(135deg, #581c87, #312e81)',
            borderRadius: '1.5rem 1.5rem 0 0',
            padding: '1.5rem',
            position: 'relative',
            zIndex: 10,
            maxHeight: '70vh',
            overflow: 'auto'
          }}>
            <h3 style={{ color: 'white', fontWeight: 'bold', marginBottom: '1rem' }}>🔔 Notifications</h3>
            {notifications.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', padding: '2rem' }}>None</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {notifications.map(n => (
                  <div
                    key={n.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      background: n.read ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)',
                      padding: '0.75rem',
                      borderRadius: '0.75rem'
                    }}
                  >
                    {n.fromPhoto && (
                      <img src={n.fromPhoto} alt="" style={{ width: '2.5rem', height: '2.5rem', borderRadius: '9999px' }} />
                    )}
                    <p style={{ color: 'white', fontSize: '0.875rem' }}>{n.message}</p>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowNotifications(false)}
              style={{
                width: '100%',
                marginTop: '1rem',
                padding: '0.75rem',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '9999px',
                color: 'white',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Login Interstitial Ad Modal - No Skip */}
      {showLoginInterstitial && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.98)'
        }}>
          <div style={{ textAlign: 'center', padding: '2rem', maxWidth: '24rem' }}>
            {/* Ad Content */}
            <div style={{
              width: '300px',
              height: '250px',
              background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
              borderRadius: '1rem',
              margin: '0 auto 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid rgba(249,115,22,0.3)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
            }}>
              <div>
                <p style={{ color: '#f97316', fontSize: '0.75rem', marginBottom: '0.5rem' }}>ADVERTISEMENT</p>
                <div className="spinner" style={{ 
                  width: '50px', 
                  height: '50px', 
                  border: '4px solid rgba(255,255,255,0.2)', 
                  borderTopColor: '#f97316',
                  borderRadius: '50%',
                  margin: '0 auto 1rem'
                }}></div>
                <p style={{ color: 'white', fontSize: '1rem', fontWeight: 'bold' }}>
                  Welcome to 18+ Live!
                </p>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                  Premium Adult Streaming
                </p>
              </div>
            </div>
            
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem', marginBottom: '1rem' }}>
              Please wait while the ad plays...
            </p>
            
            {/* Auto-close timer */}
            <LoginInterstitialTimer onComplete={closeLoginInterstitial} />
          </div>
        </div>
      )}

      {/* Free Coins Ad Watching Modal */}
      {showFreeCoinsModal && currentAdSlot !== null && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.95)'
        }}>
          <div style={{ 
            textAlign: 'center', 
            padding: '2rem', 
            maxWidth: '24rem',
            width: '100%'
          }}>
            {/* Ad Progress Header */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(249,115,22,0.3), rgba(239,68,68,0.2))',
              borderRadius: '1rem',
              padding: '1rem',
              marginBottom: '1.5rem',
              border: '1px solid rgba(249,115,22,0.4)'
            }}>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                Slot {currentAdSlot} of 10
              </p>
              <h3 style={{ color: 'white', fontSize: '1.5rem', fontWeight: 'bold' }}>
                Ad {currentAdInSlot} of 3
              </h3>
            </div>

            {/* Ad Progress Dots */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              {[1, 2, 3].map(num => (
                <div
                  key={num}
                  style={{
                    width: '2.5rem',
                    height: '2.5rem',
                    borderRadius: '9999px',
                    background: num < currentAdInSlot 
                      ? '#22c55e' 
                      : num === currentAdInSlot 
                        ? 'linear-gradient(135deg, #f97316, #ef4444)'
                        : 'rgba(255,255,255,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '0.875rem',
                    border: num === currentAdInSlot ? '3px solid rgba(255,255,255,0.3)' : 'none'
                  }}
                >
                  {num < currentAdInSlot ? '✓' : num}
                </div>
              ))}
            </div>

            {/* Ad Watching Animation */}
            {adLoading && (
              <div className="ad-watching" style={{ marginBottom: '1.5rem' }}>
                <div style={{
                  width: '120px',
                  height: '120px',
                  margin: '0 auto',
                  background: 'linear-gradient(135deg, #f97316, #ef4444)',
                  borderRadius: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 32px rgba(249,115,22,0.4)'
                }}>
                  <span style={{ fontSize: '3rem' }}>📺</span>
                </div>
                <p style={{ color: 'white', marginTop: '1rem', fontWeight: 'bold' }}>
                  Watching Ad {currentAdInSlot}...
                </p>
              </div>
            )}

            {/* Progress Bar */}
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '9999px',
              height: '0.75rem',
              marginBottom: '1rem',
              overflow: 'hidden'
            }}>
              <div style={{
                background: 'linear-gradient(90deg, #f97316, #ef4444)',
                height: '100%',
                width: `${adProgress}%`,
                borderRadius: '9999px',
                transition: 'width 0.3s ease'
              }} />
            </div>

            {/* Ad Completed State */}
            {adCompleted && currentAdInSlot < 3 && (
              <div style={{ marginBottom: '1rem' }}>
                <p style={{ color: '#22c55e', fontWeight: 'bold', marginBottom: '1rem' }}>
                  ✅ Ad {currentAdInSlot} Complete!
                </p>
                <button
                  onClick={nextAdInSlot}
                  style={{
                    padding: '1rem 2rem',
                    background: 'linear-gradient(135deg, #f97316, #ef4444)',
                    borderRadius: '9999px',
                    color: 'white',
                    border: 'none',
                    fontWeight: 'bold',
                    fontSize: '1rem',
                    cursor: 'pointer'
                  }}
                >
                  Watch Ad {currentAdInSlot + 1} →
                </button>
              </div>
            )}

            {/* Final Completion */}
            {adCompleted && currentAdInSlot === 3 && (
              <div>
                <p style={{ color: '#22c55e', fontWeight: 'bold', fontSize: '1.25rem', marginBottom: '0.5rem' }}>
                  🎉 Slot Complete!
                </p>
                <p style={{ color: 'white', fontSize: '1.5rem', fontWeight: 'bold' }}>
                  +💎 {AD_REWARD_COINS} coins
                </p>
              </div>
            )}

            {/* Cancel Button */}
            {!adCompleted && (
              <button
                onClick={cancelSlotAd}
                style={{
                  marginTop: '1rem',
                  padding: '0.5rem 1.5rem',
                  background: 'transparent',
                  borderRadius: '9999px',
                  color: 'rgba(255,255,255,0.5)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                Cancel (no reward)
              </button>
            )}
          </div>
        </div>
      )}

      {/* Daily Bonus Modal - Requires Ad Watch */}
      {showDailyBonus && dailyBonusData?.canClaim && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div
            onClick={() => setShowDailyBonus(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }}
          />
          <div style={{
            width: '100%',
            maxWidth: '24rem',
            background: 'white',
            borderRadius: '1.5rem',
            overflow: 'hidden',
            position: 'relative',
            zIndex: 10
          }}>
            <div style={{ background: 'linear-gradient(135deg, #ec4899, #8b5cf6)', padding: '1.5rem', textAlign: 'center' }}>
              <span style={{ fontSize: '3rem' }}>🎁</span>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white', marginTop: '0.5rem' }}>Daily Bonus!</h2>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <div style={{
                background: '#fdf2f8',
                borderRadius: '1rem',
                padding: '1.5rem',
                textAlign: 'center',
                marginBottom: '1rem',
                border: '2px solid #fbcfe8'
              }}>
                <p style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#ec4899' }}>💎 {DAILY_BONUS_AMOUNT}</p>
                <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.5rem' }}>coins</p>
              </div>
              
              {/* Ad Required Notice */}
              <div style={{
                background: '#fef3c7',
                borderRadius: '0.75rem',
                padding: '0.75rem',
                marginBottom: '1rem',
                textAlign: 'center'
              }}>
                <p style={{ color: '#92400e', fontSize: '0.875rem', fontWeight: '500' }}>
                  📺 Watch a short ad to claim your bonus!
                </p>
              </div>
              
              <button
                onClick={() => {
                  setShowDailyBonus(false)
                  setTimeout(() => startAdWatch('dailyBonus'), 100)
                }}
                style={{
                  width: '100%',
                  padding: '1rem',
                  background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                  borderRadius: '1rem',
                  fontWeight: 'bold',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                📺 Watch Ad to Claim!
              </button>
              
              <button
                onClick={() => setShowDailyBonus(false)}
                style={{
                  width: '100%',
                  marginTop: '0.75rem',
                  padding: '0.75rem',
                  background: 'transparent',
                  borderRadius: '1rem',
                  fontWeight: '500',
                  color: '#6b7280',
                  border: '1px solid #e5e7eb',
                  cursor: 'pointer'
                }}
              >
                Skip for today
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Panel Modal - Full Permissions */}
      {showAdminPanel && currentUser?.isAdmin && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9800,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div
            onClick={() => setShowAdminPanel(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }}
          />
          <div style={{
            width: '100%',
            maxWidth: '36rem',
            background: 'white',
            borderRadius: '1.5rem',
            overflow: 'hidden',
            position: 'relative',
            zIndex: 10,
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ background: 'linear-gradient(135deg, #eab308, #f97316)', padding: '1.5rem', textAlign: 'center' }}>
              <span style={{ fontSize: '2rem' }}>👑</span>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white', marginTop: '0.5rem' }}>Admin Panel</h2>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.875rem' }}>Full Control Access</p>
            </div>
            <div style={{ padding: '1.5rem' }}>
              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{ background: '#fef3c7', borderRadius: '1rem', padding: '1rem', textAlign: 'center' }}>
                  <p style={{ color: '#92400e', fontSize: '0.75rem' }}>Platform Earnings</p>
                  <p style={{ color: '#92400e', fontSize: '1.25rem', fontWeight: 'bold' }}>💎 {platformEarnings.totalCommission}</p>
                </div>
                <div style={{ background: '#dbeafe', borderRadius: '1rem', padding: '1rem', textAlign: 'center' }}>
                  <p style={{ color: '#1e40af', fontSize: '0.75rem' }}>Total Users</p>
                  <p style={{ color: '#1e40af', fontSize: '1.25rem', fontWeight: 'bold' }}>👥 {users.length + 1}</p>
                </div>
              </div>

              {/* Tab Navigation */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', overflowX: 'auto' }}>
                {['users', 'withdrawals', 'live'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setAdminTab(tab)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: adminTab === tab ? '#ec4899' : '#f3f4f6',
                      border: 'none',
                      borderRadius: '9999px',
                      color: adminTab === tab ? 'white' : '#374151',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '0.875rem',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {tab === 'users' ? '👥 Users' : tab === 'withdrawals' ? '💰 Withdrawals' : '📺 Live'}
                  </button>
                ))}
              </div>

              {/* Users Tab */}
              {adminTab === 'users' && (
                <div style={{ maxHeight: '20rem', overflow: 'auto' }}>
                  {users.map(u => (
                    <div
                      key={u.uid}
                      style={{
                        background: '#f9fafb',
                        borderRadius: '0.75rem',
                        padding: '0.75rem',
                        marginBottom: '0.5rem',
                        border: '1px solid #e5e7eb'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <img src={u.photoURL} alt="" style={{ width: '2rem', height: '2rem', borderRadius: '9999px' }} />
                        <div style={{ flex: 1 }}>
                          <p style={{ color: '#1f2937', fontWeight: 'bold', fontSize: '0.875rem' }}>{u.displayName}</p>
                          <p style={{ color: '#6b7280', fontSize: '0.625rem' }}>💎 {u.coins} coins</p>
                        </div>
                        {u.islive && <span style={{ background: '#ef4444', color: 'white', fontSize: '0.625rem', padding: '0.125rem 0.5rem', borderRadius: '9999px' }}>LIVE</span>}
                        {u.isPremium && <span style={{ background: '#eab308', color: 'white', fontSize: '0.625rem', padding: '0.125rem 0.5rem', borderRadius: '9999px' }}>👑</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          onClick={async () => {
                            const db = getFirebaseDb()
                            if (db) {
                              await updateDoc(doc(db, 'profiles', u.uid), { coins: increment(1000) })
                              showToast(`Added 1000 coins to ${u.displayName}`)
                            }
                          }}
                          style={{
                            padding: '0.25rem 0.5rem',
                            background: '#22c55e',
                            border: 'none',
                            borderRadius: '0.375rem',
                            color: 'white',
                            fontSize: '0.625rem',
                            cursor: 'pointer'
                          }}
                        >
                          +1000💎
                        </button>
                        <button
                          onClick={async () => {
                            const db = getFirebaseDb()
                            if (db) {
                              await updateDoc(doc(db, 'profiles', u.uid), { coins: increment(-1000) })
                              showToast(`Removed 1000 coins from ${u.displayName}`)
                            }
                          }}
                          style={{
                            padding: '0.25rem 0.5rem',
                            background: '#ef4444',
                            border: 'none',
                            borderRadius: '0.375rem',
                            color: 'white',
                            fontSize: '0.625rem',
                            cursor: 'pointer'
                          }}
                        >
                          -1000💎
                        </button>
                        <button
                          onClick={async () => {
                            const db = getFirebaseDb()
                            if (db) {
                              await updateDoc(doc(db, 'profiles', u.uid), { isPremium: !u.isPremium })
                              showToast(`${u.displayName} premium: ${!u.isPremium}`)
                            }
                          }}
                          style={{
                            padding: '0.25rem 0.5rem',
                            background: u.isPremium ? '#6b7280' : '#eab308',
                            border: 'none',
                            borderRadius: '0.375rem',
                            color: 'white',
                            fontSize: '0.625rem',
                            cursor: 'pointer'
                          }}
                        >
                          {u.isPremium ? 'Remove Premium' : 'Set Premium'}
                        </button>
                        <button
                          onClick={async () => {
                            const db = getFirebaseDb()
                            if (db) {
                              await updateDoc(doc(db, 'profiles', u.uid), { islive: false })
                              showToast(`Ended ${u.displayName}'s live`)
                            }
                          }}
                          style={{
                            padding: '0.25rem 0.5rem',
                            background: '#7c3aed',
                            border: 'none',
                            borderRadius: '0.375rem',
                            color: 'white',
                            fontSize: '0.625rem',
                            cursor: 'pointer'
                          }}
                        >
                          End Live
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Withdrawals Tab */}
              {adminTab === 'withdrawals' && (
                <div>
                  {withdrawalRequests.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#6b7280', padding: '1rem' }}>No withdrawal requests</p>
                  ) : (
                    <div style={{ maxHeight: '20rem', overflow: 'auto' }}>
                      {withdrawalRequests.map(r => (
                        <div
                          key={r.id}
                          style={{
                            background: '#f9fafb',
                            borderRadius: '0.75rem',
                            padding: '0.75rem',
                            marginBottom: '0.5rem',
                            border: '1px solid #e5e7eb'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <p style={{ color: '#1f2937', fontWeight: 'bold', fontSize: '0.875rem' }}>{r.displayName}</p>
                              <p style={{ color: '#22c55e', fontWeight: 'bold' }}>{r.amountInDollars}</p>
                              <p style={{ color: '#6b7280', fontSize: '0.625rem' }}>USDT (TRC20): {r.usdtWalletAddress?.slice(0, 8)}...{r.usdtWalletAddress?.slice(-6)}</p>
                            </div>
                            <span style={{
                              background: r.status === 'approved' ? '#22c55e' : r.status === 'rejected' ? '#ef4444' : '#eab308',
                              color: 'white',
                              fontSize: '0.625rem',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '9999px'
                            }}>
                              {r.status}
                            </span>
                          </div>
                          {r.status === 'pending' && (
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                              <button
                                onClick={() => updateWithdrawalStatus(r.id, 'approved')}
                                style={{
                                  flex: 1,
                                  padding: '0.5rem',
                                  background: '#22c55e',
                                  borderRadius: '0.5rem',
                                  color: 'white',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontSize: '0.75rem'
                                }}
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => updateWithdrawalStatus(r.id, 'rejected')}
                                style={{
                                  flex: 1,
                                  padding: '0.5rem',
                                  background: '#ef4444',
                                  borderRadius: '0.5rem',
                                  color: 'white',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontSize: '0.75rem'
                                }}
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Live Tab */}
              {adminTab === 'live' && (
                <div>
                  <h4 style={{ color: '#1f2937', fontWeight: 'bold', marginBottom: '0.75rem' }}>🔴 Live Streams</h4>
                  {liveUsers.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#6b7280', padding: '1rem' }}>No active live streams</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {liveUsers.map(u => (
                        <div
                          key={u.uid}
                          style={{
                            background: '#f9fafb',
                            borderRadius: '0.75rem',
                            padding: '0.75rem',
                            border: '1px solid #e5e7eb',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem'
                          }}
                        >
                          <img src={u.photoURL} alt="" style={{ width: '3rem', height: '3rem', borderRadius: '9999px' }} />
                          <div style={{ flex: 1 }}>
                            <p style={{ color: '#1f2937', fontWeight: 'bold' }}>{u.displayName}</p>
                            <p style={{ color: '#ef4444', fontSize: '0.75rem' }}>🔴 LIVE</p>
                          </div>
                          <button
                            onClick={async () => {
                              const db = getFirebaseDb()
                              if (db) {
                                await updateDoc(doc(db, 'profiles', u.uid), { islive: false })
                                showToast(`Ended ${u.displayName}'s live stream`)
                              }
                            }}
                            style={{
                              padding: '0.5rem 1rem',
                              background: '#ef4444',
                              border: 'none',
                              borderRadius: '0.5rem',
                              color: 'white',
                              cursor: 'pointer',
                              fontWeight: 'bold'
                            }}
                          >
                            End Stream
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() => setShowAdminPanel(false)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: '#f3f4f6',
                  borderRadius: '9999px',
                  color: '#374151',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  marginTop: '1rem'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Private Chat Modal */}
      {showChatModal && chatRecipient && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.9)',
          zIndex: 9500,
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '1rem',
            background: 'linear-gradient(135deg, #831843, #581c87)',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}>
            <button
              onClick={() => {
                setShowChatModal(false)
                setChatRecipient(null)
                setPrivateMessages([])
              }}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '9999px',
                width: '2.5rem',
                height: '2.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                cursor: 'pointer',
                fontSize: '1.25rem'
              }}
            >
              ←
            </button>
            <img
              src={getAvatar(chatRecipient)}
              alt={chatRecipient.displayName}
              style={{ width: '2.5rem', height: '2.5rem', borderRadius: '9999px', objectFit: 'cover', border: '2px solid #ec4899' }}
            />
            <div style={{ flex: 1 }}>
              <p style={{ color: 'white', fontWeight: 'bold' }}>{chatRecipient.displayName}</p>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem' }}>
                {isUserOnline(chatRecipient) ? '🟢 Online' : '⚫ Offline'} • 💎 {PREMIUM_MESSAGE_COST} coins/message
              </p>
            </div>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            {privateMessages.length === 0 && (
              <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', padding: '2rem' }}>
                <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💬</p>
                <p>Send a message to start chatting</p>
                <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Each message costs {PREMIUM_MESSAGE_COST} coins</p>
              </div>
            )}
            {privateMessages.map(msg => (
              <div
                key={msg.id}
                style={{
                  alignSelf: msg.sender === firebaseUser?.uid ? 'flex-end' : 'flex-start',
                  maxWidth: '80%',
                  background: msg.sender === firebaseUser?.uid
                    ? 'linear-gradient(135deg, #ec4899, #8b5cf6)'
                    : 'rgba(255,255,255,0.1)',
                  padding: '0.75rem 1rem',
                  borderRadius: '1rem',
                  borderBottomRightRadius: msg.sender === firebaseUser?.uid ? '0.25rem' : '1rem',
                  borderBottomLeftRadius: msg.sender === firebaseUser?.uid ? '1rem' : '0.25rem'
                }}
              >
                <p style={{ color: 'white', fontSize: '0.875rem' }}>{msg.text}</p>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.625rem', marginTop: '0.25rem' }}>
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </p>
              </div>
            ))}
          </div>

          {/* Input */}
          <div style={{
            padding: '1rem',
            background: 'rgba(88,28,135,0.95)',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'center'
          }}>
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '9999px',
              padding: '0.25rem 0.75rem',
              fontSize: '0.75rem',
              color: '#eab308',
              fontWeight: 'bold'
            }}>
              💎 {currentUser?.coins || 0}
            </div>
            <input
              type="text"
              value={privateMessageInput}
              onChange={(e) => setPrivateMessageInput(e.target.value)}
              placeholder="Type a message..."
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '9999px',
                padding: '0.75rem 1rem',
                color: 'white',
                fontSize: '0.875rem',
                outline: 'none'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  sendPrivateMessage()
                }
              }}
            />
            <button
              onClick={sendPrivateMessage}
              disabled={!privateMessageInput.trim() || (currentUser?.coins || 0) < PREMIUM_MESSAGE_COST}
              style={{
                background: privateMessageInput.trim() && (currentUser?.coins || 0) >= PREMIUM_MESSAGE_COST
                  ? 'linear-gradient(135deg, #ec4899, #8b5cf6)'
                  : 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '9999px',
                width: '3rem',
                height: '3rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                cursor: privateMessageInput.trim() && (currentUser?.coins || 0) >= PREMIUM_MESSAGE_COST ? 'pointer' : 'not-allowed',
                fontSize: '1.25rem'
              }}
            >
              ➤
            </button>
          </div>
        </div>
      )}

      {/* Verification Package Purchase Modal */}
      {showVerificationModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9900,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div
            onClick={() => setShowVerificationModal(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)' }}
          />
          <div style={{
            width: '100%',
            maxWidth: '24rem',
            background: 'linear-gradient(135deg, #581c87, #312e81)',
            borderRadius: '1.5rem',
            overflow: 'hidden',
            position: 'relative',
            zIndex: 10
          }}>
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
              padding: '1.5rem',
              textAlign: 'center'
            }}>
              <div style={{
                width: '4rem',
                height: '4rem',
                background: 'rgba(255,255,255,0.2)',
                borderRadius: '9999px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
                marginBottom: '0.75rem'
              }}>
                <span style={{ fontSize: '2rem' }}>🛡️</span>
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white' }}>Verification Package</h2>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.875rem', marginTop: '0.25rem' }}>Unlock Withdrawals</p>
            </div>

            {/* Content */}
            <div style={{ padding: '1.5rem' }}>
              {/* Price Card */}
              <div style={{
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '1rem',
                padding: '1.25rem',
                marginBottom: '1rem',
                textAlign: 'center',
                border: '1px solid rgba(255,255,255,0.2)'
              }}>
                <p style={{ color: '#f472b6', fontSize: '2rem', fontWeight: 'bold' }}>
                  💎 {VERIFICATION_PACKAGE_COST.toLocaleString()}
                </p>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem' }}>= ${VERIFICATION_PACKAGE_DOLLARS}.00</p>
              </div>

              {/* Features */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <span style={{ color: '#22c55e', fontSize: '1.25rem' }}>✅</span>
                  <p style={{ color: 'white', fontSize: '0.875rem' }}>One-time purchase</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <span style={{ color: '#22c55e', fontSize: '1.25rem' }}>✅</span>
                  <p style={{ color: 'white', fontSize: '0.875rem' }}>Unlock withdrawal feature</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <span style={{ color: '#22c55e', fontSize: '1.25rem' }}>✅</span>
                  <p style={{ color: 'white', fontSize: '0.875rem' }}>Account verification badge</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ color: '#eab308', fontSize: '1.25rem' }}>ℹ️</span>
                  <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem' }}>Deducted from your balance</p>
                </div>
              </div>

              {/* Balance Check */}
              <div style={{
                background: (currentUser?.coins || 0) >= VERIFICATION_PACKAGE_COST
                  ? 'rgba(34,197,94,0.2)'
                  : 'rgba(239,68,68,0.2)',
                borderRadius: '0.75rem',
                padding: '0.75rem',
                marginBottom: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem' }}>Your Balance:</span>
                <span style={{
                  color: (currentUser?.coins || 0) >= VERIFICATION_PACKAGE_COST ? '#22c55e' : '#ef4444',
                  fontWeight: 'bold'
                }}>
                  💎 {currentUser?.coins?.toLocaleString() || 0}
                </span>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => setShowVerificationModal(false)}
                  disabled={verificationPurchasing}
                  style={{
                    flex: 1,
                    padding: '0.875rem',
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: '9999px',
                    color: 'white',
                    fontWeight: '600',
                    border: 'none',
                    cursor: verificationPurchasing ? 'not-allowed' : 'pointer',
                    opacity: verificationPurchasing ? 0.5 : 1
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={purchaseVerificationPackage}
                  disabled={(currentUser?.coins || 0) < VERIFICATION_PACKAGE_COST || verificationPurchasing}
                  style={{
                    flex: 1,
                    padding: '0.875rem',
                    background: (currentUser?.coins || 0) >= VERIFICATION_PACKAGE_COST && !verificationPurchasing
                      ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                      : '#4b5563',
                    borderRadius: '9999px',
                    color: 'white',
                    fontWeight: '600',
                    border: 'none',
                    cursor: (currentUser?.coins || 0) >= VERIFICATION_PACKAGE_COST && !verificationPurchasing
                      ? 'pointer'
                      : 'not-allowed',
                    opacity: (currentUser?.coins || 0) >= VERIFICATION_PACKAGE_COST ? 1 : 0.6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                >
                  {verificationPurchasing ? (
                    <>
                      <span style={{ animation: 'pulse 1s infinite' }}>⏳</span>
                      Processing...
                    </>
                  ) : (currentUser?.coins || 0) >= VERIFICATION_PACKAGE_COST ? (
                    '✓ Purchase Now'
                  ) : (
                    'Insufficient Balance'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Withdrawal Blocked Modal - For Verification Requirement */}
      {showWithdrawalBlockedModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9850,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div
            onClick={() => setShowWithdrawalBlockedModal(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)' }}
          />
          <div style={{
            width: '100%',
            maxWidth: '20rem',
            background: 'linear-gradient(135deg, #7f1d1d, #991b1b)',
            borderRadius: '1.5rem',
            overflow: 'hidden',
            position: 'relative',
            zIndex: 10
          }}>
            <div style={{ padding: '1.5rem', textAlign: 'center' }}>
              <div style={{
                width: '4rem',
                height: '4rem',
                background: 'rgba(255,255,255,0.2)',
                borderRadius: '9999px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
                marginBottom: '1rem'
              }}>
                <span style={{ fontSize: '2rem' }}>🔒</span>
              </div>
              <h3 style={{ color: 'white', fontWeight: 'bold', fontSize: '1.125rem', marginBottom: '0.5rem' }}>
                Verification Required
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                To unlock withdrawals, please purchase the $1 Verification Package using your earned coins.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => setShowWithdrawalBlockedModal(false)}
                  style={{
                    flex: 1,
                    padding: '0.875rem',
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: '9999px',
                    color: 'white',
                    fontWeight: '600',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowWithdrawalBlockedModal(false)
                    setShowVerificationModal(true)
                  }}
                  style={{
                    flex: 1,
                    padding: '0.875rem',
                    background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                    borderRadius: '9999px',
                    color: 'white',
                    fontWeight: '600',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  🛡️ Get Verified
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ad Modal for Daily Bonus & Earn Coins */}
      {showAdModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.98)'
        }}>
          <div style={{ 
            textAlign: 'center', 
            padding: '2rem', 
            maxWidth: '24rem',
            width: '100%'
          }}>
            {/* Ad Content */}
            <div style={{
              width: '300px',
              height: '250px',
              background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
              borderRadius: '1rem',
              margin: '0 auto 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid rgba(249,115,22,0.3)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
            }}>
              <div>
                <p style={{ color: '#f97316', fontSize: '0.75rem', marginBottom: '0.5rem' }}>ADVERTISEMENT</p>
                <div className="spinner" style={{ 
                  width: '50px', 
                  height: '50px', 
                  border: '4px solid rgba(255,255,255,0.2)', 
                  borderTopColor: '#f97316',
                  borderRadius: '50%',
                  margin: '0 auto 1rem'
                }}></div>
                <p style={{ color: 'white', fontSize: '1rem', fontWeight: 'bold' }}>
                  {adLoading ? 'Watching Ad...' : 'Ad Complete!'}
                </p>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '9999px',
              height: '0.75rem',
              marginBottom: '1rem',
              overflow: 'hidden'
            }}>
              <div style={{
                background: 'linear-gradient(90deg, #f97316, #ef4444)',
                height: '100%',
                width: `${adProgress}%`,
                borderRadius: '9999px',
                transition: 'width 0.3s ease'
              }} />
            </div>

            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem', marginBottom: '1rem' }}>
              {adLoading ? `Please wait... ${Math.ceil((100 - adProgress) / (100 / AD_WATCH_DURATION))}s remaining` : `🎉 You earned 💎 ${adReward} coins!`}
            </p>

            {/* Claim Button (shown after ad completes) */}
            {adCompleted && (
              <button
                onClick={completeAdWatch}
                style={{
                  padding: '1rem 2rem',
                  background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                  borderRadius: '9999px',
                  color: 'white',
                  border: 'none',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  cursor: 'pointer'
                }}
              >
                🎁 Claim Reward!
              </button>
            )}

            {/* Skip Button (shown during ad) */}
            {!adCompleted && (
              <button
                onClick={skipAd}
                style={{
                  marginTop: '1rem',
                  padding: '0.5rem 1.5rem',
                  background: 'transparent',
                  borderRadius: '9999px',
                  color: 'rgba(255,255,255,0.5)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                Skip (no reward)
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'rgba(88,28,135,0.95)',
        backdropFilter: 'blur(10px)',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        padding: '0.5rem',
        display: 'flex',
        justifyContent: 'space-around',
        zIndex: 8000
      }}>
        {[
          { id: 'home', icon: '🏠', label: 'Home' },
          { id: 'freecoins', icon: '🎁', label: 'Free' },
          { id: 'wallet', icon: '💎', label: 'Wallet' },
          { id: 'premium', icon: '👑', label: 'Premium' },
          { id: 'profile', icon: '👤', label: 'Profile' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setCurrentScreen(t.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '0.5rem 0.75rem',
              background: currentScreen === t.id ? 'rgba(249,115,22,0.3)' : 'rgba(255,255,255,0.1)',
              borderRadius: '1rem',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <span style={{ fontSize: '1.125rem' }}>{t.icon}</span>
            <span style={{ fontSize: '0.5rem', color: 'white', fontWeight: currentScreen === t.id ? 'bold' : 'normal' }}>
              {t.label}
            </span>
          </button>
        ))}
      </div>

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1 }
          50% { opacity: 0.5 }
        }
      `}</style>
    </div>
  )
}
