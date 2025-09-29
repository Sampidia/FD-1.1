"use client";

import { useState, useEffect } from "react";
import { X, Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Detect device type
    const userAgent = navigator.userAgent.toLowerCase();
    const isiOS = /iphone|ipad|ipod/.test(userAgent);
    const isAndroidDevice = /android/.test(userAgent);

    setIsIOS(isiOS);
    setIsAndroid(isAndroidDevice);

    // Check if already installed (Safari on iOS doesn't show install prompt if already installed)
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;
    if (isInStandaloneMode) return;

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);

      // Show prompt after user has done at least 3 scans
      const scansCompleted = parseInt(localStorage.getItem('scansCompleted') || '0');
      const dismissedBefore = localStorage.getItem('installPromptDismissed');

      if (scansCompleted >= 3 && !dismissedBefore) {
        // Delay showing to avoid annoyance on first visit
        setTimeout(() => {
          setShowPrompt(true);
        }, 10000); // 10 seconds after page load
      }
    };

    // Listen for successful installation
    const handleAppInstalled = () => {
      setShowPrompt(false);
      setDeferredPrompt(null);
      console.log('PWA was installed successfully!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;

      if (choice.outcome === 'accepted') {
        console.log('User accepted the install prompt');
        setShowPrompt(false);
      } else {
        console.log('User dismissed the install prompt');
        localStorage.setItem('installPromptDismissed', 'true');
        setShowPrompt(false);
      }

      setDeferredPrompt(null);
    } catch (error) {
      console.error('Error during installation:', error);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('installPromptDismissed', 'true');
  };

  const handleIOSInstall = () => {
    const message = "Tap the Share button and select 'Add to Home Screen'";
    alert(message);
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-4 animate-in slide-in-from-bottom-2">
        {/* iOS Instructions */}
        {isIOS && !deferredPrompt && (
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Smartphone className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-gray-900">Install ProductChecker</span>
            </div>

            <div className="bg-blue-50 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 text-sm text-blue-700 mb-2">
                <span className="flex-1">1. Tap the Share button</span>
                <span className="text-2xl">📤</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-blue-700">
                <span className="flex-1">2. Select "Add to Home Screen"</span>
                <span className="text-2xl">➕</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleIOSInstall} className="flex-1 bg-blue-600 hover:bg-blue-700">
                <Download className="w-4 h-4 mr-2" />
                Show Instructions
              </Button>
              <Button onClick={handleDismiss} variant="outline" className="px-3">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Android/Standard Browser Install */}
        {deferredPrompt && (
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Smartphone className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-gray-900">Install ProductChecker</span>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Get native app experience with offline access and better camera performance!
            </p>

            <div className="flex gap-2">
              <Button onClick={handleInstallClick} className="flex-1 bg-blue-600 hover:bg-blue-700">
                <Download className="w-4 h-4 mr-2" />
                Install App
              </Button>
              <Button onClick={handleDismiss} variant="outline" className="px-3">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Android Instructions (fallback) */}
        {isAndroid && !deferredPrompt && (
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Smartphone className="w-5 h-5 text-green-600" />
              <span className="font-semibold text-gray-900">Install ProductChecker</span>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Look for the install prompt at the bottom or in your browser menu.
            </p>

            <Button onClick={handleDismiss} variant="outline" className="w-full">
              Got it, thanks!
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
