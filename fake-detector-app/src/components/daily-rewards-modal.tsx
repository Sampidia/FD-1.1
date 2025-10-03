'use client'

import { useState } from "react"
import { Eye, X, Crown, Zap, Gift } from "lucide-react"
import { Button } from "@/components/ui/button"
import { showBasicPointAd, canEarnAdRewardToday } from "@/lib/mobile-admob"
import { useSession } from "next-auth/react"

interface DailyRewardsModalProps {
  isOpen: boolean
  onClose: () => void
  onPointsClaimed?: () => void
}

export function DailyRewardsModal({ isOpen, onClose, onPointsClaimed }: DailyRewardsModalProps) {
  const [isClaimingDaily, setIsClaimingDaily] = useState(false)
  const [isWatchingAd, setIsWatchingAd] = useState(false)
  const [dailyPointsClaimed, setDailyPointsClaimed] = useState(false)
  const [adRewardAvailable, setAdRewardAvailable] = useState(true)
  const { data: session } = useSession()

  const handleClaimDailyPoints = async () => {
    if (dailyPointsClaimed) return

    setIsClaimingDaily(true)
    try {
      const response = await fetch('/api/daily-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setDailyPointsClaimed(true)
          onPointsClaimed?.() // Notify parent component
          // Close modal after brief delay to show success
          setTimeout(() => onClose(), 1500)
        } else {
          console.error('Failed to claim points:', data.message)
        }
      } else {
        console.error('Error claiming daily points')
      }
    } catch (error) {
      console.error('Network error claiming points:', error)
    } finally {
      setIsClaimingDaily(false)
    }
  }

  const handleWatchAd = async () => {
    if (!adRewardAvailable) return

    setIsWatchingAd(true)

    try {
      const sessionUser = session?.user as any // Type assertion for extended session properties
      if (!sessionUser?.id) {
        throw new Error('User not authenticated')
      }

      console.log('🎬 Starting ad reward flow for user:', sessionUser.id)

      // Check if user can earn rewards today
      const canEarn = await canEarnAdRewardToday()
      if (!canEarn) {
        console.log('❌ Cannot earn ad reward today - limit reached')
        setAdRewardAvailable(false)
        return
      }

      // Call AdMob to show the ad
      const adResult = await showBasicPointAd(sessionUser.id)

      if (adResult.success) {
        console.log('✅ Ad completed successfully, points should be awarded')

        // Refresh status and notify parent
        await loadAdRewardStatus()
        onPointsClaimed?.()

        // Close modal after brief delay
        setTimeout(() => onClose(), 1500)
      } else {
        console.error('❌ Ad failed:', adResult.error)
      }
    } catch (error) {
      console.error('❌ Ad reward error:', error)
    } finally {
      setIsWatchingAd(false)
    }
  }

  const handleUpgradePlan = () => {
    onClose() // Close modal
    // Redirect to pricing page
    window.location.href = '/pricing'
  }

  const loadAdRewardStatus = async () => {
    try {
      const rewardStatus = await canEarnAdRewardToday()
      setAdRewardAvailable(rewardStatus)
    } catch (error) {
      console.error('Error checking ad reward status:', error)
      setAdRewardAvailable(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full text-center">
        <div className="mb-6">
          <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Gift className="w-6 h-6 text-yellow-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Get Free Points!
          </h3>
          <p className="text-gray-700 text-sm">
            Choose how you'd like to earn points today.
          </p>
        </div>

        <div className="flex flex-col gap-3 justify-center mb-6">
          {/* Daily Free Points Button */}
          <Button
            onClick={handleClaimDailyPoints}
            disabled={!dailyPointsClaimed && isClaimingDaily}
            className={`px-6 py-3 transition-all duration-200 ${
              dailyPointsClaimed
                ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg'
                : 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-105 shadow-lg'
            }`}
          >
            {dailyPointsClaimed ? (
              <span className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Daily Points Claimed! (+1 Point)
              </span>
            ) : isClaimingDaily ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Claiming...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Gift className="w-4 h-4" />
                Claim Daily Free Point (1/24h)
              </span>
            )}
          </Button>

          {/* Upgrade Plan Button */}
          <Button
            onClick={handleUpgradePlan}
            className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white px-6 py-3 hover:scale-105 shadow-lg transition-all duration-200"
          >
            <span className="flex items-center gap-2">
              <Crown className="w-4 h-4" />
              Upgrade Plan (Unlimited Points)
            </span>
          </Button>

          {/* Watch Ad to Earn Points Button */}
          <Button
            onClick={handleWatchAd}
            disabled={!adRewardAvailable || isWatchingAd}
            className={`px-6 py-3 transition-all duration-200 shadow-lg ${
              adRewardAvailable && !isWatchingAd
                ? 'bg-green-600 hover:bg-green-700 text-white hover:scale-105'
                : 'bg-gray-400 text-gray-200 cursor-not-allowed opacity-60'
            }`}
          >
            {isWatchingAd ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Loading Ad...
              </span>
            ) : !adRewardAvailable ? (
              <span className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Ad Limit Reached Today
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Watch Ad to Earn +1 Point
              </span>
            )}
          </Button>
        </div>

        {/* Exit Button */}
        <div className="flex justify-center">
          <Button
            onClick={onClose}
            variant="ghost"
            className="text-sm text-gray-600 hover:bg-gray-100"
          >
            Maybe Later
          </Button>
        </div>
      </div>
    </div>
  )
}
