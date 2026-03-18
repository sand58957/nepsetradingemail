'use client'

// React Imports
import { useState, useEffect, useCallback } from 'react'

// Next Imports
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

// MUI Imports
import useMediaQuery from '@mui/material/useMediaQuery'
import { styled, useTheme } from '@mui/material/styles'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import CircularProgress from '@mui/material/CircularProgress'

// Third-party Imports
import { signIn } from 'next-auth/react'
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google'
import { Controller, useForm } from 'react-hook-form'
import { valibotResolver } from '@hookform/resolvers/valibot'
import { email, object, minLength, string, pipe, nonEmpty } from 'valibot'
import type { SubmitHandler } from 'react-hook-form'
import type { InferInput } from 'valibot'
import classnames from 'classnames'

// Type Imports
import type { SystemMode } from '@core/types'
import type { Locale } from '@/configs/i18n'

// Component Imports
import Logo from '@components/layout/shared/Logo'
import CustomTextField from '@core/components/mui/TextField'

// Hook Imports
import { useImageVariant } from '@core/hooks/useImageVariant'
import { useSettings } from '@core/hooks/useSettings'

// Util Imports
import { getLocalizedUrl } from '@/utils/i18n'

// Styled Components
const LoginIllustration = styled('img')(({ theme }) => ({
  zIndex: 2,
  blockSize: 'auto',
  maxBlockSize: 680,
  maxInlineSize: '100%',
  margin: theme.spacing(12),
  [theme.breakpoints.down(1536)]: { maxBlockSize: 550 },
  [theme.breakpoints.down('lg')]: { maxBlockSize: 450 }
}))

const MaskImg = styled('img')({
  blockSize: 'auto',
  maxBlockSize: 355,
  inlineSize: '100%',
  position: 'absolute',
  insetBlockEnd: 0,
  zIndex: -1
})

type ErrorType = { message: string[] }
type FormData = InferInput<typeof schema>

const schema = object({
  email: pipe(string(), minLength(1, 'This field is required'), email('Email is invalid')),
  password: pipe(string(), nonEmpty('This field is required'), minLength(5, 'Password must be at least 5 characters long'))
})

const Login = ({ mode }: { mode: SystemMode }) => {
  // States
  const [isPasswordShown, setIsPasswordShown] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorState, setErrorState] = useState<ErrorType | null>(null)
  const [authTab, setAuthTab] = useState(0) // 0: email, 1: phone
  const [phone, setPhone] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpChannel, setOtpChannel] = useState<'sms' | 'whatsapp'>('sms')
  const [countdown, setCountdown] = useState(0)
  const [otpLoading, setOtpLoading] = useState(false)

  // Vars
  const darkImg = '/images/pages/auth-mask-dark.png'
  const lightImg = '/images/pages/auth-mask-light.png'

  // Hooks
  const router = useRouter()
  const searchParams = useSearchParams()
  const { lang: locale } = useParams()
  const { settings } = useSettings()
  const theme = useTheme()
  const hidden = useMediaQuery(theme.breakpoints.down('md'))
  const authBackground = useImageVariant(mode, lightImg, darkImg)
  const _mode = mode

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: valibotResolver(schema),
    defaultValues: { email: '', password: '' }
  })

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)

      return () => clearTimeout(timer)
    }
  }, [countdown])

  const handleRedirectAfterLogin = useCallback(async () => {
    const redirectTo = searchParams.get('redirectTo')

    if (redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//')) {
      router.replace(getLocalizedUrl(redirectTo, locale as Locale))
    } else {
      try {
        const sessionRes = await fetch('/api/auth/session')
        const session = await sessionRes.json()
        const role = session?.role || 'subscriber'

        if (role === 'subscriber') {
          router.replace(getLocalizedUrl('/portal', locale as Locale))
        } else if (!session?.accountId) {
          router.replace(getLocalizedUrl('/choose-account', locale as Locale))
        } else {
          router.replace(getLocalizedUrl('/dashboards/email-marketing', locale as Locale))
        }
      } catch {
        router.replace(getLocalizedUrl('/dashboards/email-marketing', locale as Locale))
      }
    }
  }, [searchParams, router, locale])

  // Email/Password submit
  const onSubmit: SubmitHandler<FormData> = async (data: FormData) => {
    setIsLoading(true)
    setErrorState(null)

    try {
      const res = await signIn('credentials', { email: data.email, password: data.password, redirect: false })

      if (res && res.ok && res.error === null) {
        await handleRedirectAfterLogin()
      } else {
        if (res?.error) {
          try {
            setErrorState(JSON.parse(res.error))
          } catch {
            setErrorState({ message: [res.error || 'Login failed. Please check your credentials.'] })
          }
        }
      }
    } catch {
      setErrorState({ message: ['An unexpected error occurred. Please try again.'] })
    } finally {
      setIsLoading(false)
    }
  }

  // Send OTP
  const handleSendOTP = async (channel: 'sms' | 'whatsapp') => {
    if (!phone || phone.length < 10) {
      setErrorState({ message: ['Please enter a valid 10-digit phone number'] })

      return
    }

    setOtpLoading(true)
    setErrorState(null)
    setOtpChannel(channel)

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://nepalfillings.com/api'

      const res = await fetch(`${apiUrl}/auth/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, channel })
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setOtpSent(true)
        setCountdown(60)
      } else {
        setErrorState({ message: [data.message || 'Failed to send OTP'] })
      }
    } catch {
      setErrorState({ message: ['Failed to send OTP. Please try again.'] })
    } finally {
      setOtpLoading(false)
    }
  }

  // Verify OTP
  const handleVerifyOTP = async () => {
    if (!otpCode || otpCode.length !== 6) {
      setErrorState({ message: ['Please enter the 6-digit verification code'] })

      return
    }

    setOtpLoading(true)
    setErrorState(null)

    try {
      const res = await signIn('otp-verify', { phone, code: otpCode, channel: otpChannel, redirect: false })

      if (res && res.ok && res.error === null) {
        await handleRedirectAfterLogin()
      } else {
        if (res?.error) {
          try {
            setErrorState(JSON.parse(res.error))
          } catch {
            setErrorState({ message: [res.error || 'OTP verification failed'] })
          }
        }
      }
    } catch {
      setErrorState({ message: ['Verification failed. Please try again.'] })
    } finally {
      setOtpLoading(false)
    }
  }

  // Google OAuth success
  const handleGoogleSuccess = async (credentialResponse: any) => {
    setIsLoading(true)
    setErrorState(null)

    try {
      const res = await signIn('google-auth', { idToken: credentialResponse.credential, redirect: false })

      if (res && res.ok && res.error === null) {
        await handleRedirectAfterLogin()
      } else {
        if (res?.error) {
          try {
            setErrorState(JSON.parse(res.error))
          } catch {
            setErrorState({ message: [res.error || 'Google login failed'] })
          }
        }
      }
    } catch {
      setErrorState({ message: ['Google login failed. Please try again.'] })
    } finally {
      setIsLoading(false)
    }
  }

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

  return (
    <div className='flex bs-full justify-center'>
      {/* Left side - Illustration */}
      <div
        className={classnames('flex bs-full items-center justify-center flex-1 min-bs-[100dvh] relative p-6 max-md:hidden', {
          'border-ie': settings.skin === 'bordered'
        })}
        style={_mode === 'dark' ? { background: 'linear-gradient(135deg, #0a0a18 0%, #12122a 40%, #1a1040 70%, #0f0f1a 100%)' } : undefined}
      >
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', width: 420, height: 420, borderRadius: '50%', border: '1px solid rgba(115, 103, 240, 0.15)', boxShadow: '0 0 60px rgba(115, 103, 240, 0.08), inset 0 0 60px rgba(115, 103, 240, 0.04)' }} />
          <div style={{ position: 'absolute', width: 560, height: 560, borderRadius: '50%', border: '1px dashed rgba(115, 103, 240, 0.08)' }} />
          <LoginIllustration src='/images/illustrations/characters/5.png' alt='character-illustration' />
          {[
            { icon: 'tabler-mail', label: 'Email', color: '#7367f0', glow: 'rgba(115,103,240,0.4)', top: '-5%', left: '15%' },
            { icon: 'tabler-message-2', label: 'SMS', color: '#28c76f', glow: 'rgba(40,199,111,0.4)', top: '5%', right: '-5%' },
            { icon: 'tabler-brand-whatsapp', label: 'WhatsApp', color: '#25D366', glow: 'rgba(37,211,102,0.4)', top: '42%', left: '-12%' },
            { icon: 'tabler-brand-telegram', label: 'Telegram', color: '#0088cc', glow: 'rgba(0,136,204,0.4)', top: '38%', right: '-8%' },
            { icon: 'tabler-brand-messenger', label: 'Messenger', color: '#0084ff', glow: 'rgba(0,132,255,0.4)', bottom: '12%', left: '5%' }
          ].map((ch, i) => (
            <div key={i} style={{ position: 'absolute', ...(ch.top ? { top: ch.top } : {}), ...(ch.bottom ? { bottom: ch.bottom } : {}), ...(ch.left ? { left: ch.left } : {}), ...(ch.right ? { right: ch.right } : {}), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: `linear-gradient(135deg, ${ch.color}22, ${ch.color}44)`, border: `1.5px solid ${ch.color}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 24px ${ch.glow}, 0 0 40px ${ch.color}15`, backdropFilter: 'blur(8px)' }}>
                <i className={ch.icon} style={{ fontSize: 26, color: ch.color }} />
              </div>
              <Typography variant='caption' style={{ fontWeight: 600, color: 'rgba(255,255,255,0.85)', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>{ch.label}</Typography>
            </div>
          ))}
        </div>
        {!hidden && <MaskImg alt='mask' src={authBackground} />}
      </div>

      {/* Right side - Login Form */}
      <div
        className='flex justify-center items-center bs-full bg-backgroundPaper !min-is-full p-6 md:!min-is-[unset] md:p-12 md:is-[480px]'
        style={_mode === 'dark' ? { background: 'rgba(22, 22, 38, 0.7)', backdropFilter: 'blur(16px)', borderInlineStart: '1px solid rgba(115, 103, 240, 0.1)' } : undefined}
      >
        <div className='absolute block-start-5 sm:block-start-[33px] inline-start-6 sm:inline-start-[38px] flex items-center gap-4'>
          <Link href='/front-pages/landing-page'>
            <Logo />
          </Link>
          <Typography
            component={Link}
            href='/front-pages/landing-page'
            color='primary.main'
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.85rem', fontWeight: 500, textDecoration: 'none', opacity: 0.8, '&:hover': { opacity: 1 } }}
          >
            <i className='tabler-arrow-left text-base' />
            Home
          </Typography>
        </div>

        <div className='flex flex-col gap-5 is-full sm:is-auto md:is-full sm:max-is-[400px] md:max-is-[unset] mbs-8 sm:mbs-11 md:mbs-0'>
          <div className='flex flex-col gap-1'>
            <Typography variant='h4'>Welcome to Nepal Fillings!</Typography>
            <Typography variant='body2' color='text.secondary'>Sign in to your account</Typography>
          </div>

          {/* Error display */}
          {errorState && (
            <Alert severity='error' onClose={() => setErrorState(null)}>
              {errorState.message.join(', ')}
            </Alert>
          )}

          {/* Auth method tabs */}
          <Tabs
            value={authTab}
            onChange={(_, v) => { setAuthTab(v); setErrorState(null) }}
            variant='fullWidth'
            sx={{ '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, minHeight: 40 } }}
          >
            <Tab icon={<i className='tabler-mail text-lg' />} iconPosition='start' label='Email' />
            <Tab icon={<i className='tabler-phone text-lg' />} iconPosition='start' label='Phone' />
          </Tabs>

          {/* Email/Password Tab */}
          {authTab === 0 && (
            <form noValidate autoComplete='off' action={() => {}} onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-5'>
              <Controller
                name='email'
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <CustomTextField
                    {...field}
                    autoFocus
                    fullWidth
                    type='email'
                    label='Email'
                    placeholder='Enter your email'
                    onChange={e => { field.onChange(e.target.value); errorState !== null && setErrorState(null) }}
                    {...((errors.email || errorState !== null) && { error: true, helperText: errors?.email?.message })}
                  />
                )}
              />
              <Controller
                name='password'
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <CustomTextField
                    {...field}
                    fullWidth
                    label='Password'
                    placeholder='Enter your password'
                    type={isPasswordShown ? 'text' : 'password'}
                    onChange={e => { field.onChange(e.target.value); errorState !== null && setErrorState(null) }}
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position='end'>
                            <IconButton edge='end' onClick={() => setIsPasswordShown(!isPasswordShown)} onMouseDown={e => e.preventDefault()}>
                              <i className={isPasswordShown ? 'tabler-eye' : 'tabler-eye-off'} />
                            </IconButton>
                          </InputAdornment>
                        )
                      }
                    }}
                    {...(errors.password && { error: true, helperText: errors.password.message })}
                  />
                )}
              />
              <Button fullWidth variant='contained' type='submit' disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          )}

          {/* Phone OTP Tab */}
          {authTab === 1 && (
            <div className='flex flex-col gap-4'>
              {!otpSent ? (
                <>
                  <CustomTextField
                    fullWidth
                    label='Phone Number'
                    placeholder='98XXXXXXXX'
                    value={phone}
                    onChange={e => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setErrorState(null) }}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position='start'>
                            <Typography variant='body2' sx={{ fontWeight: 600 }}>+977</Typography>
                          </InputAdornment>
                        )
                      }
                    }}
                  />
                  <div className='flex gap-3'>
                    <Button
                      fullWidth
                      variant='contained'
                      color='success'
                      startIcon={otpLoading ? <CircularProgress size={18} color='inherit' /> : <i className='tabler-message-2' />}
                      onClick={() => handleSendOTP('sms')}
                      disabled={otpLoading || phone.length < 10}
                    >
                      SMS OTP
                    </Button>
                    <Button
                      fullWidth
                      variant='contained'
                      sx={{ bgcolor: '#25D366', '&:hover': { bgcolor: '#1da851' } }}
                      startIcon={otpLoading ? <CircularProgress size={18} color='inherit' /> : <i className='tabler-brand-whatsapp' />}
                      onClick={() => handleSendOTP('whatsapp')}
                      disabled={otpLoading || phone.length < 10}
                    >
                      WhatsApp
                    </Button>
                  </div>
                  <Typography variant='caption' color='text.secondary' className='text-center'>
                    A 6-digit verification code will be sent to your phone
                  </Typography>
                </>
              ) : (
                <>
                  <Alert severity='success' icon={<i className={otpChannel === 'sms' ? 'tabler-message-2' : 'tabler-brand-whatsapp'} />}>
                    Code sent via {otpChannel === 'sms' ? 'SMS' : 'WhatsApp'} to +977 {phone}
                  </Alert>
                  <CustomTextField
                    fullWidth
                    label='Verification Code'
                    placeholder='Enter 6-digit code'
                    value={otpCode}
                    onChange={e => { setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setErrorState(null) }}
                    slotProps={{
                      input: {
                        style: { letterSpacing: '0.5em', textAlign: 'center', fontSize: '1.2rem', fontWeight: 700 }
                      }
                    }}
                  />
                  <Button
                    fullWidth
                    variant='contained'
                    onClick={handleVerifyOTP}
                    disabled={otpLoading || otpCode.length !== 6}
                    startIcon={otpLoading ? <CircularProgress size={18} color='inherit' /> : <i className='tabler-shield-check' />}
                  >
                    {otpLoading ? 'Verifying...' : 'Verify & Sign In'}
                  </Button>
                  <Box className='flex justify-between items-center'>
                    <Button size='small' onClick={() => { setOtpSent(false); setOtpCode('') }}>
                      <i className='tabler-arrow-left mie-1' /> Change Number
                    </Button>
                    {countdown > 0 ? (
                      <Typography variant='caption' color='text.secondary'>Resend in {countdown}s</Typography>
                    ) : (
                      <Button size='small' onClick={() => handleSendOTP(otpChannel)}>Resend Code</Button>
                    )}
                  </Box>
                </>
              )}
            </div>
          )}

          {/* Divider */}
          <Divider sx={{ '& .MuiDivider-wrapper': { px: 2 } }}>
            <Typography variant='caption' color='text.secondary'>or continue with</Typography>
          </Divider>

          {/* Google Sign In */}
          {googleClientId ? (
            <GoogleOAuthProvider clientId={googleClientId}>
              <Box className='flex justify-center'>
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setErrorState({ message: ['Google login failed'] })}
                  theme={_mode === 'dark' ? 'filled_black' : 'outline'}
                  size='large'
                  width='100%'
                  text='signin_with'
                  shape='pill'
                />
              </Box>
            </GoogleOAuthProvider>
          ) : (
            <Button
              fullWidth
              variant='outlined'
              disabled
              startIcon={<i className='tabler-brand-google' />}
              sx={{ borderRadius: '50px', textTransform: 'none' }}
            >
              Google Sign In (Not configured)
            </Button>
          )}

          {/* Register link */}
          <div className='flex justify-center items-center flex-wrap gap-2'>
            <Typography variant='body2'>New on our platform?</Typography>
            <Typography variant='body2' component={Link} href={getLocalizedUrl('/register', locale as Locale)} color='primary.main'>
              Create an account
            </Typography>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
