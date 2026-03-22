import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "18+ LiveStream - Premium Adult Live Streaming Platform",
  description: "Professional adult live streaming platform with premium features",
  robots: "noindex, nofollow",
  // HilltopAds Verification Meta Tag
  verification: {
    other: {
      "0b080d94e722815b873e6820f1eba63bb4e96d8d": "0b080d94e722815b873e6820f1eba63bb4e96d8d",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* HilltopAds Verification - Updated */}
        <meta name="0b080d94e722815b873e6820f1eba63bb4e96d8d" content="0b080d94e722815b873e6820f1eba63bb4e96d8d" />
        
        {/* HilltopAds Multi-Video Ad Script */}
        <script
          data-cfasync="false"
          type="text/javascript"
          dangerouslySetInnerHTML={{
            __html: `
              (function(nmnsq){
                var d=document,
                    s=d.createElement('script'),
                    l=d.scripts[d.scripts.length-1];
                s.settings=nmnsq||{};
                s.src="//elaborate-analysis.com/brXgV.sQdbGJlq0_YVWeca/deXmj9gulZUUGlmk_P/TzYC4nOeDoQqyROJTbcLtANzjsgy4YN/DvMfwjMVQJ";
                s.async=true;
                s.referrerPolicy='no-referrer-when-downgrade';
                l.parentNode.insertBefore(s,l);
              })({})
            `,
          }}
        />
        
        {/* HilltopAds Interstitial Script */}
        <script
          data-cfasync="false"
          type="text/javascript"
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                // HilltopAds Interstitial Configuration
                window.hilltopads_interstitial_loaded = false;
                
                // Function to show interstitial
                window.showHilltopAdsInterstitial = function(callback) {
                  if (window.hilltopads_interstitial_loaded && window.adsbyexoclick) {
                    try {
                      // Trigger interstitial ad
                      var adContainer = document.getElementById('hilltopads-interstitial-container');
                      if (adContainer) {
                        adContainer.style.display = 'flex';
                        // Auto close after ad completes (simulated 5s for now)
                        setTimeout(function() {
                          adContainer.style.display = 'none';
                          if (callback) callback(true);
                        }, 5000);
                      }
                    } catch(e) {
                      console.log('Interstitial error:', e);
                      if (callback) callback(false);
                    }
                  } else {
                    // Ad not loaded, proceed without showing
                    if (callback) callback(false);
                  }
                };
                
                // Mark as loaded after script loads
                window.addEventListener('load', function() {
                  window.hilltopads_interstitial_loaded = true;
                });
                
                console.log('HilltopAds Interstitial initialized');
              })();
            `,
          }}
        />
        
        <style>{`
          * {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          
          /* HilltopAds Interstitial Container */
          #hilltopads-interstitial-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 99999;
            display: none;
            align-items: center;
            justify-content: center;
            background: rgba(0, 0, 0, 0.95);
          }
          
          /* Premium Live Badge Animation with Glow */
          @keyframes livePulse {
            0%, 100% { 
              box-shadow: 0 0 5px #ef4444, 0 0 10px #ef4444, 0 0 15px rgba(239, 68, 68, 0.5);
            }
            50% { 
              box-shadow: 0 0 8px #ef4444, 0 0 16px #ef4444, 0 0 24px rgba(239, 68, 68, 0.6), 0 0 32px rgba(239, 68, 68, 0.3);
            }
          }
          
          @keyframes shimmer {
            0% { background-position: -200% center; }
            100% { background-position: 200% center; }
          }
          
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          @keyframes slideInRight {
            from {
              opacity: 0;
              transform: translateX(20px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
          
          @keyframes pulse-ring {
            0% {
              transform: scale(0.95);
              box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
            }
            70% {
              transform: scale(1);
              box-shadow: 0 0 0 6px rgba(34, 197, 94, 0);
            }
            100% {
              transform: scale(0.95);
              box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
            }
          }
          
          @keyframes adPulse {
            0%, 100% { 
              transform: scale(1);
              opacity: 1;
            }
            50% { 
              transform: scale(1.05);
              opacity: 0.9;
            }
          }
          
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          
          .live-badge {
            animation: livePulse 2s ease-in-out infinite;
          }
          
          .chat-message {
            animation: fadeInUp 0.3s ease-out;
          }
          
          /* Modern Glassmorphism Classes - White/Orange/Red Theme */
          .glass-effect {
            background: rgba(255, 255, 255, 0.08);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.12);
          }
          
          .glass-dark {
            background: rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.08);
          }
          
          .glass-orange {
            background: linear-gradient(135deg, rgba(249, 115, 22, 0.15), rgba(239, 68, 68, 0.1));
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(249, 115, 22, 0.3);
          }
          
          .glass-chat-bubble {
            background: rgba(0, 0, 0, 0.35);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 12px;
          }
          
          .glass-input {
            background: rgba(0, 0, 0, 0.45);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1);
          }
          
          .glass-modal {
            background: linear-gradient(145deg, rgba(30, 30, 46, 0.97), rgba(45, 31, 61, 0.97));
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 32px 64px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05) inset;
          }
          
          /* Premium Button Styles - Orange/Red Theme */
          .btn-primary {
            background: linear-gradient(135deg, #f97316 0%, #ef4444 100%);
            border: none;
            box-shadow: 0 4px 16px rgba(249, 115, 22, 0.4);
            transition: all 0.2s ease;
          }
          
          .btn-primary:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 20px rgba(249, 115, 22, 0.5);
          }
          
          .btn-danger {
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            border: none;
            box-shadow: 0 4px 16px rgba(239, 68, 68, 0.4);
            transition: all 0.2s ease;
          }
          
          .btn-danger:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 20px rgba(239, 68, 68, 0.5);
          }
          
          /* Custom scrollbar for chat */
          .chat-scroll::-webkit-scrollbar {
            width: 4px;
          }
          .chat-scroll::-webkit-scrollbar-track {
            background: transparent;
          }
          .chat-scroll::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.15);
            border-radius: 4px;
          }
          .chat-scroll::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.25);
          }
          
          /* Online indicator pulse */
          .online-indicator {
            animation: pulse-ring 2s ease-out infinite;
          }
          
          /* Viewers badge style */
          .viewers-badge {
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1);
          }
          
          /* Host info pill */
          .host-pill {
            background: rgba(0, 0, 0, 0.45);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.12);
          }
          
          /* Message animation */
          .message-enter {
            animation: slideInRight 0.25s ease-out;
          }
          
          /* Ad watching animation */
          .ad-watching {
            animation: adPulse 1.5s ease-in-out infinite;
          }
          
          .spinner {
            animation: spin 1s linear infinite;
          }
          
          /* Ad slot styles */
          .ad-slot-button {
            background: linear-gradient(135deg, rgba(249, 115, 22, 0.2), rgba(239, 68, 68, 0.15));
            border: 1px solid rgba(249, 115, 22, 0.4);
            transition: all 0.2s ease;
          }
          
          .ad-slot-button:hover:not(:disabled) {
            background: linear-gradient(135deg, rgba(249, 115, 22, 0.3), rgba(239, 68, 68, 0.25));
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3);
          }
          
          .ad-slot-completed {
            background: linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(22, 163, 74, 0.15));
            border: 1px solid rgba(34, 197, 94, 0.4);
          }
        `}</style>
      </head>
      <body className={`${inter.variable} antialiased bg-background text-foreground`}>
        {/* HilltopAds Interstitial Container */}
        <div id="hilltopads-interstitial-container">
          <div style={{ textAlign: 'center', color: 'white', padding: '2rem' }}>
            <div className="spinner" style={{ 
              width: '40px', 
              height: '40px', 
              border: '3px solid rgba(255,255,255,0.3)', 
              borderTopColor: '#f97316',
              borderRadius: '50%',
              margin: '0 auto 1rem'
            }}></div>
            <p style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Loading Ad...</p>
            <p style={{ fontSize: '0.75rem', opacity: 0.7 }}>Please wait</p>
          </div>
        </div>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
