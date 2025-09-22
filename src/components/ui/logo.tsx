"use client"

import Image from "next/image"

interface LogoProps {
  width?: number
  height?: number
  className?: string
  showText?: boolean
}

export default function Logo({ width = 60, height = 60, className = "", showText = false }: LogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Replace /logo.png with your actual logo file */}
      <Image
        src="/logo.png"
        alt="Fake Products Detector Logo"
        width={width}
        height={height}
        className="object-contain rounded-full"
        priority
      />
      {showText && (
        <div className="flex flex-col">
          <span className="text-xl font-bold gradient-text">Fake Detector</span>
          <span className="text-sm text-muted-foreground">Verify Before You Buy</span>
        </div>
      )}
    </div>
  )
}