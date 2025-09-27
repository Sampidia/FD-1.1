// Debug script to test NextAuth configuration
import NextAuth from 'next-auth'
import { authOptions } from './src/lib/auth.js'

console.log('🔧 Testing NextAuth configuration...')

try {
  const authInstance = NextAuth(authOptions)
  console.log('✅ NextAuth instance created successfully')
  console.log('Available providers:')
  console.log(authOptions.providers.map(p => p.name || 'unnamed'))
} catch (error) {
  console.error('❌ NextAuth error:', error)
  process.exit(1)
}

console.log('🌐 Testing providers endpoint simulation...')
try {
  // Simulate what NextAuth does when calling /api/auth/providers
  const providers = authOptions.providers
  const providerConfig = providers.map(provider => ({
    id: provider.id,
    name: provider.name,
    type: provider.type,
    signinUrl: `/api/auth/signin/${provider.id}`,
    callbackUrl: `/api/auth/callback/${provider.id}`
  }))

  console.log('✅ Providers configuration:')
  console.log(JSON.stringify(providerConfig, null, 2))
} catch (error) {
  console.error('❌ Providers error:', error)
}
