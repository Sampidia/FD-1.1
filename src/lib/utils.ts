import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

export function formatCurrency(amount: number, currency = 'NGN'): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currency,
  }).format(amount)
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
}

export function generateResultId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `RESULT-${timestamp}-${random}`.toUpperCase()
}

export function validateFile(file: File, allowedTypes: string[], maxSize: number): { valid: boolean; error?: string } {
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: `File type not supported. Allowed: ${allowedTypes.join(', ')}` }
  }

  if (file.size > maxSize) {
    return { valid: false, error: `File size too large. Max: ${maxSize / (1024 * 1024)}MB` }
  }

  return { valid: true }
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function processImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function cleanupTempFiles(tempFiles: string[]): Promise<void> {
  // In a real implementation, this would clean up temp files from storage
  return Promise.resolve()
}