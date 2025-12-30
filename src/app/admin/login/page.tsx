'use client'

import { useSession, signIn } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { identifyAdmin } from '@/lib/analytics'
import { Button, VinylSpinner } from '@/components/ui'
import { ArrowLeftIcon } from '@/components/icons'

export default function AdminLoginPage() {
  const { data: session, status } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  // Redirect if already authenticated as admin
  useEffect(() => {
    if (session?.user) {
      if (session.user.isAdmin) {
        identifyAdmin(session.user)
        router.push('/admin')
      } else {
        setError('Access denied. Admin privileges required.')
      }
    }
  }, [session, router])

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSigningIn(true)
    setError('')

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Invalid email or password')
      }
    } catch (error) {
      console.error('Sign in error:', error)
      setError('An error occurred during sign in')
    } finally {
      setIsSigningIn(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <VinylSpinner size="md" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Background Effect */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/10 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-900/5 to-cyan-900/5" />
      </div>

      {/* Header */}
      <header className="relative z-10 p-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-text-muted hover:text-white transition-colors text-sm"
        >
          <ArrowLeftIcon size={16} />
          Back to Home
        </Link>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-block">
              <Image
                src="/images/logos/bottb-horizontal.png"
                alt="Battle of the Tech Bands"
                width={200}
                height={48}
                className="h-12 w-auto mx-auto mb-6"
                priority
              />
            </Link>
            <h1 className="font-semibold text-2xl mb-2 text-white">
              Welcome Back
            </h1>
            <p className="text-text-muted">
              Sign in to your account to continue
            </p>
          </div>

          {/* Login Card */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/5">
            {error && (
              <div className="bg-error/20 border border-error/50 text-error px-4 py-3 rounded-lg mb-6 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSignIn}>
              {/* Email */}
              <div className="mb-5">
                <label className="block text-[10px] tracking-widest uppercase text-text-muted mb-2">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-bg border border-white/10 rounded-lg text-white placeholder-gray-500 transition-all focus:outline-hidden focus:border-white/30 hover:border-white/20"
                  required
                  autoComplete="email"
                />
              </div>

              {/* Password */}
              <div className="mb-6">
                <label className="block text-[10px] tracking-widest uppercase text-text-muted mb-2">
                  Password
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-bg border border-white/10 rounded-lg text-white placeholder-gray-500 transition-all focus:outline-hidden focus:border-white/30 hover:border-white/20"
                  required
                  autoComplete="current-password"
                />
              </div>

              {/* Submit */}
              <Button
                type="submit"
                variant="filled"
                disabled={isSigningIn}
                className="w-full"
              >
                {isSigningIn ? (
                  <>
                    <VinylSpinner size="xxs" />
                    Signing In...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 p-6 text-center text-text-dim text-sm">
        © {new Date().getFullYear()} Battle of the Tech Bands
      </footer>
    </div>
  )
}
