'use client'

// React Imports
import { useState, useEffect } from 'react'

// Next Imports
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'

// MUI Imports
import useMediaQuery from '@mui/material/useMediaQuery'
import { styled, useTheme } from '@mui/material/styles'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import InputAdornment from '@mui/material/InputAdornment'
import IconButton from '@mui/material/IconButton'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'

// Third-party Imports
import classnames from 'classnames'

// Type Imports
import type { SystemMode } from '@core/types'
import type { Locale } from '@/configs/i18n'

// Component Imports
import DirectionalIcon from '@components/DirectionalIcon'
import Logo from '@components/layout/shared/Logo'
import CustomTextField from '@core/components/mui/TextField'

// Hook Imports
import { useImageVariant } from '@core/hooks/useImageVariant'
import { useSettings } from '@core/hooks/useSettings'

// Util Imports
import { getLocalizedUrl } from '@/utils/i18n'

const MaskImg = styled('img')({
  blockSize: 'auto',
  maxBlockSize: 355,
  inlineSize: '100%',
  position: 'absolute',
  insetBlockEnd: 0,
  zIndex: -1
})

const ForgotPassword = ({ mode }: { mode: SystemMode }) => {
  const darkImg = '/images/pages/auth-mask-dark.png'
  const lightImg = '/images/pages/auth-mask-light.png'

  // Hooks
  const { lang: locale } = useParams()
  const router = useRouter()
  const { settings } = useSettings()
  const theme = useTheme()
  const hidden = useMediaQuery(theme.breakpoints.down('md'))
  const authBackground = useImageVariant(mode, lightImg, darkImg)
  const _mode = mode

  // States
  const [step, setStep] = useState<'request' | 'verify'>('request')
  const [channelTab, setChannelTab] = useState(0) // 0: email, 1: phone
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [otpChannel, setOtpChannel] = useState<'email' | 'sms' | 'whatsapp'>('email')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [countdown, setCountdown] = useState(0)

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)

      return () => clearTimeout(timer)
    }
  }, [countdown])

  // Send reset code
  const handleSendCode = async (channel: 'email' | 'sms' | 'whatsapp') => {
    const identifier = channel === 'email' ? email : phone

    if (!identifier) {
      setError(channel === 'email' ? 'Please enter your email' : 'Please enter your phone number')

      return
    }

    if (channel !== 'email' && phone.length < 10) {
      setError('Please enter a valid 10-digit phone number')

      return
    }

    setLoading(true)
    setError('')
    setOtpChannel(channel)

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://nepalfillings.com/api'

      const res = await fetch(`${apiUrl}/auth/password/reset-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, channel })
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setStep('verify')
        setCountdown(60)
        setSuccess(`Verification code sent via ${channel === 'email' ? 'Email' : channel === 'sms' ? 'SMS' : 'WhatsApp'}`)
      } else {
        setError(data.message || 'Failed to send reset code')
      }
    } catch {
      setError('Failed to send reset code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Verify OTP and reset password
  const handleResetPassword = async () => {
    if (otpCode.length !== 6) {
      setError('Please enter the 6-digit verification code')

      return
    }

    if (newPassword.length < 5) {
      setError('Password must be at least 5 characters')

      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')

      return
    }

    setLoading(true)
    setError('')

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://nepalfillings.com/api'
      const identifier = otpChannel === 'email' ? email : phone

      const res = await fetch(`${apiUrl}/auth/password/reset-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier,
          channel: otpChannel,
          code: otpCode,
          new_password: newPassword
        })
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setSuccess('Password reset successfully! Redirecting to login...')
        setTimeout(() => {
          router.push(getLocalizedUrl('/login', locale as Locale))
        }, 2000)
      } else {
        setError(data.message || 'Failed to reset password')
      }
    } catch {
      setError('Failed to reset password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='flex bs-full justify-center'>
      {/* Left side */}
      <div
        className={classnames('flex bs-full items-center justify-center flex-1 min-bs-[100dvh] relative p-6 max-md:hidden', {
          'border-ie': settings.skin === 'bordered'
        })}
        style={_mode === 'dark' ? { background: 'linear-gradient(135deg, #0a0a18 0%, #12122a 40%, #1a1040 70%, #0f0f1a 100%)' } : undefined}
      >
        <div style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
          <div style={{
            width: 120, height: 120, borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(115,103,240,0.2), rgba(115,103,240,0.05))',
            border: '2px solid rgba(115,103,240,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px'
          }}>
            <i className='tabler-lock-open' style={{ fontSize: 56, color: 'rgba(115,103,240,0.8)' }} />
          </div>
          <Typography variant='h4' style={{ color: '#fff', fontWeight: 700, marginBottom: 8 }}>
            Reset Your Password
          </Typography>
          <Typography style={{ color: 'rgba(255,255,255,0.6)', maxWidth: 350, margin: '0 auto' }}>
            Choose how you want to receive your verification code — via Email, SMS, or WhatsApp
          </Typography>
        </div>
        {!hidden && <MaskImg alt='mask' src={authBackground} />}
      </div>

      {/* Right side - Form */}
      <div
        className='flex justify-center items-center bs-full bg-backgroundPaper !min-is-full p-6 md:!min-is-[unset] md:p-12 md:is-[480px]'
        style={_mode === 'dark' ? { background: 'rgba(22, 22, 38, 0.7)', backdropFilter: 'blur(16px)', borderInlineStart: '1px solid rgba(115, 103, 240, 0.1)' } : undefined}
      >
        <div className='absolute block-start-5 sm:block-start-[33px] inline-start-6 sm:inline-start-[38px]'>
          <Link href='/'>
            <Logo />
          </Link>
        </div>

        <div className='flex flex-col gap-5 is-full sm:is-auto md:is-full sm:max-is-[400px] md:max-is-[unset] mbs-8 sm:mbs-11 md:mbs-0'>
          <div className='flex flex-col gap-1'>
            <Typography variant='h4'>
              {step === 'request' ? 'Forgot Password' : 'Reset Password'}
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              {step === 'request'
                ? 'Enter your email or phone to receive a verification code'
                : `Enter the code sent to ${otpChannel === 'email' ? email : '+977 ' + phone}`
              }
            </Typography>
          </div>

          {/* Error/Success alerts */}
          {error && <Alert severity='error' onClose={() => setError('')}>{error}</Alert>}
          {success && <Alert severity='success' onClose={() => setSuccess('')}>{success}</Alert>}

          {/* Step 1: Request Code */}
          {step === 'request' && (
            <>
              <Tabs
                value={channelTab}
                onChange={(_, v) => { setChannelTab(v); setError('') }}
                variant='fullWidth'
                sx={{ '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, minHeight: 40 } }}
              >
                <Tab icon={<i className='tabler-mail text-lg' />} iconPosition='start' label='Email' />
                <Tab icon={<i className='tabler-phone text-lg' />} iconPosition='start' label='Phone' />
              </Tabs>

              {channelTab === 0 ? (
                <div className='flex flex-col gap-4'>
                  <CustomTextField
                    fullWidth
                    autoFocus
                    type='email'
                    label='Email Address'
                    placeholder='Enter your registered email'
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError('') }}
                  />
                  <Button
                    fullWidth
                    variant='contained'
                    onClick={() => handleSendCode('email')}
                    disabled={loading || !email}
                    startIcon={loading ? <CircularProgress size={18} color='inherit' /> : <i className='tabler-mail-forward' />}
                  >
                    {loading ? 'Sending...' : 'Send Email OTP'}
                  </Button>
                </div>
              ) : (
                <div className='flex flex-col gap-4'>
                  <CustomTextField
                    fullWidth
                    label='Phone Number'
                    placeholder='98XXXXXXXX'
                    value={phone}
                    onChange={e => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setError('') }}
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
                      startIcon={loading ? <CircularProgress size={18} color='inherit' /> : <i className='tabler-message-2' />}
                      onClick={() => handleSendCode('sms')}
                      disabled={loading || phone.length < 10}
                    >
                      SMS OTP
                    </Button>
                    <Button
                      fullWidth
                      variant='contained'
                      sx={{ bgcolor: '#25D366', '&:hover': { bgcolor: '#1da851' } }}
                      startIcon={loading ? <CircularProgress size={18} color='inherit' /> : <i className='tabler-brand-whatsapp' />}
                      onClick={() => handleSendCode('whatsapp')}
                      disabled={loading || phone.length < 10}
                    >
                      WhatsApp
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Step 2: Verify & Reset */}
          {step === 'verify' && (
            <div className='flex flex-col gap-4'>
              <CustomTextField
                fullWidth
                label='Verification Code'
                placeholder='Enter 6-digit code'
                value={otpCode}
                onChange={e => { setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }}
                slotProps={{
                  input: {
                    style: { letterSpacing: '0.5em', textAlign: 'center', fontSize: '1.2rem', fontWeight: 700 }
                  }
                }}
              />
              <CustomTextField
                fullWidth
                label='New Password'
                placeholder='Enter new password'
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setError('') }}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position='end'>
                        <IconButton edge='end' onClick={() => setShowPassword(!showPassword)}>
                          <i className={showPassword ? 'tabler-eye' : 'tabler-eye-off'} />
                        </IconButton>
                      </InputAdornment>
                    )
                  }
                }}
              />
              <CustomTextField
                fullWidth
                label='Confirm Password'
                placeholder='Confirm new password'
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setError('') }}
              />
              <Button
                fullWidth
                variant='contained'
                onClick={handleResetPassword}
                disabled={loading || otpCode.length !== 6 || newPassword.length < 5}
                startIcon={loading ? <CircularProgress size={18} color='inherit' /> : <i className='tabler-lock-check' />}
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </Button>

              <Box className='flex justify-between items-center'>
                <Button size='small' onClick={() => { setStep('request'); setOtpCode(''); setSuccess('') }}>
                  <i className='tabler-arrow-left mie-1' /> Back
                </Button>
                {countdown > 0 ? (
                  <Typography variant='caption' color='text.secondary'>Resend in {countdown}s</Typography>
                ) : (
                  <Button size='small' onClick={() => handleSendCode(otpChannel)}>Resend Code</Button>
                )}
              </Box>
            </div>
          )}

          {/* Back to login */}
          <Typography className='flex justify-center items-center' color='primary.main'>
            <Link href={getLocalizedUrl('/login', locale as Locale)} className='flex items-center gap-1.5'>
              <DirectionalIcon ltrIconClass='tabler-chevron-left' rtlIconClass='tabler-chevron-right' className='text-xl' />
              <span>Back to login</span>
            </Link>
          </Typography>
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword
