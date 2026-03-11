'use client'

// React Imports
import { useEffect, useState } from 'react'
import type { SyntheticEvent } from 'react'

// Next Imports
import { useSession } from 'next-auth/react'

// MUI Imports
import Grid from '@mui/material/Grid'
import Tab from '@mui/material/Tab'
import TabContext from '@mui/lab/TabContext'
import TabPanel from '@mui/lab/TabPanel'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Chip from '@mui/material/Chip'
import InputAdornment from '@mui/material/InputAdornment'
import IconButton from '@mui/material/IconButton'
import Avatar from '@mui/material/Avatar'
import LinearProgress from '@mui/material/LinearProgress'

// Component Imports
import CustomTabList from '@core/components/mui/TabList'

// Service Imports
import api from '@/services/api'

interface UserData {
  id: number
  name: string
  email: string
  role: string
  is_active: boolean
  created_at: string
  updated_at: string
}

interface DashboardStats {
  subscribers: { total: number; active: number }
  campaigns: { total: number; sent: number }
  lists: { total: number }
}

const UserProfile = () => {
  useSession()

  // States
  const [activeTab, setActiveTab] = useState('account')
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<UserData | null>(null)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Profile edit states
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  // Password change states
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError('')

      const [profileRes, statsRes] = await Promise.allSettled([
        api.get('/profile'),
        api.get('/dashboard/stats')
      ])

      if (profileRes.status === 'fulfilled') {
        const userData = profileRes.value.data?.data

        if (userData) {
          setUser(userData)
          setEditName(userData.name || '')
          setEditEmail(userData.email || '')
        }
      }

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value.data?.data || statsRes.value.data)
      }
    } catch {
      setError('Failed to load profile data')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProfile = async () => {
    try {
      setSavingProfile(true)
      setError('')
      setSuccess('')

      if (!editName.trim()) {
        setError('Name is required')

        return
      }

      if (!editEmail.trim()) {
        setError('Email is required')

        return
      }

      const res = await api.put('/profile', { name: editName.trim(), email: editEmail.trim() })
      const updatedUser = res.data?.data

      if (updatedUser) {
        setUser(updatedUser)
        setEditName(updatedUser.name || '')
        setEditEmail(updatedUser.email || '')
      }

      setSuccess('Profile updated successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async () => {
    try {
      setSavingPassword(true)
      setError('')
      setSuccess('')

      if (!currentPassword) {
        setError('Current password is required')

        return
      }

      if (!newPassword) {
        setError('New password is required')

        return
      }

      if (newPassword.length < 8) {
        setError('New password must be at least 8 characters')

        return
      }

      if (newPassword !== confirmPassword) {
        setError('New passwords do not match')

        return
      }

      await api.put('/profile', {
        name: user?.name || editName,
        email: user?.email || editEmail,
        password: newPassword,
        current_password: currentPassword
      })

      setSuccess('Password changed successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to change password')
    } finally {
      setSavingPassword(false)
    }
  }

  const handleTabChange = (_event: SyntheticEvent, value: string) => {
    setActiveTab(value)
    setError('')
    setSuccess('')
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch {
      return dateString
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  if (loading) {
    return (
      <Box className='flex justify-center items-center min-bs-[400px]'>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Grid container spacing={6}>
      {/* Profile Header */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardContent className='flex gap-6 flex-col items-center sm:flex-row sm:items-end pt-12 pb-6'>
            <Avatar
              sx={{
                width: 100,
                height: 100,
                fontSize: '2.5rem',
                bgcolor: 'primary.main',
                fontWeight: 600
              }}
            >
              {user ? getInitials(user.name) : 'U'}
            </Avatar>
            <div className='flex flex-col items-center sm:items-start gap-2 flex-1'>
              <Typography variant='h4'>{user?.name || 'User'}</Typography>
              <div className='flex flex-wrap gap-4 justify-center sm:justify-start'>
                <div className='flex items-center gap-1.5'>
                  <i className='tabler-mail text-textSecondary' />
                  <Typography color='text.secondary'>{user?.email}</Typography>
                </div>
                <div className='flex items-center gap-1.5'>
                  <i className='tabler-shield text-textSecondary' />
                  <Chip
                    label={user?.role?.charAt(0).toUpperCase() + (user?.role?.slice(1) || '')}
                    size='small'
                    color='primary'
                    variant='tonal'
                  />
                </div>
                <div className='flex items-center gap-1.5'>
                  <i className='tabler-calendar text-textSecondary' />
                  <Typography color='text.secondary'>
                    Joined {user?.created_at ? formatDate(user.created_at) : 'N/A'}
                  </Typography>
                </div>
                <Chip
                  label={user?.is_active ? 'Active' : 'Inactive'}
                  size='small'
                  color={user?.is_active ? 'success' : 'error'}
                  variant='tonal'
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </Grid>

      {/* Alerts */}
      {error && (
        <Grid size={{ xs: 12 }}>
          <Alert severity='error' onClose={() => setError('')}>
            {error}
          </Alert>
        </Grid>
      )}
      {success && (
        <Grid size={{ xs: 12 }}>
          <Alert severity='success' onClose={() => setSuccess('')}>
            {success}
          </Alert>
        </Grid>
      )}

      {/* Tabs */}
      <Grid size={{ xs: 12 }} className='flex flex-col gap-6'>
        <TabContext value={activeTab}>
          <CustomTabList onChange={handleTabChange} variant='scrollable' pill='true'>
            <Tab
              label={
                <div className='flex items-center gap-1.5'>
                  <i className='tabler-user text-lg' />
                  Account
                </div>
              }
              value='account'
            />
            <Tab
              label={
                <div className='flex items-center gap-1.5'>
                  <i className='tabler-lock text-lg' />
                  Security
                </div>
              }
              value='security'
            />
            <Tab
              label={
                <div className='flex items-center gap-1.5'>
                  <i className='tabler-chart-bar text-lg' />
                  Overview
                </div>
              }
              value='overview'
            />
          </CustomTabList>

          {/* Account Tab */}
          <TabPanel value='account' className='p-0'>
            <Grid container spacing={6}>
              {/* Profile Information Card */}
              <Grid size={{ xs: 12, md: 7 }}>
                <Card>
                  <CardHeader title='Profile Information' subheader='Update your account details' />
                  <CardContent className='flex flex-col gap-6'>
                    <Grid container spacing={4}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          fullWidth
                          label='Full Name'
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          slotProps={{
                            input: {
                              startAdornment: (
                                <InputAdornment position='start'>
                                  <i className='tabler-user' />
                                </InputAdornment>
                              )
                            }
                          }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          fullWidth
                          label='Email Address'
                          type='email'
                          value={editEmail}
                          onChange={e => setEditEmail(e.target.value)}
                          slotProps={{
                            input: {
                              startAdornment: (
                                <InputAdornment position='start'>
                                  <i className='tabler-mail' />
                                </InputAdornment>
                              )
                            }
                          }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField fullWidth label='Role' value={user?.role || ''} disabled />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          fullWidth
                          label='Member Since'
                          value={user?.created_at ? formatDate(user.created_at) : ''}
                          disabled
                        />
                      </Grid>
                    </Grid>
                    <Divider />
                    <div className='flex gap-4'>
                      <Button variant='contained' onClick={handleSaveProfile} disabled={savingProfile}>
                        {savingProfile ? 'Saving...' : 'Save Changes'}
                      </Button>
                      <Button
                        variant='tonal'
                        color='secondary'
                        onClick={() => {
                          setEditName(user?.name || '')
                          setEditEmail(user?.email || '')
                        }}
                      >
                        Reset
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Grid>

              {/* Account Details Sidebar */}
              <Grid size={{ xs: 12, md: 5 }}>
                <Card>
                  <CardHeader title='Account Details' />
                  <CardContent className='flex flex-col gap-4'>
                    <div className='flex items-center gap-3'>
                      <div className='flex items-center justify-center rounded-lg p-2 bg-primaryLighter'>
                        <i className='tabler-id text-primary text-xl' />
                      </div>
                      <div>
                        <Typography variant='body2' color='text.disabled'>
                          Account ID
                        </Typography>
                        <Typography className='font-medium'>#{user?.id}</Typography>
                      </div>
                    </div>
                    <Divider />
                    <div className='flex items-center gap-3'>
                      <div className='flex items-center justify-center rounded-lg p-2 bg-primaryLighter'>
                        <i className='tabler-user text-primary text-xl' />
                      </div>
                      <div>
                        <Typography variant='body2' color='text.disabled'>
                          Full Name
                        </Typography>
                        <Typography className='font-medium'>{user?.name}</Typography>
                      </div>
                    </div>
                    <Divider />
                    <div className='flex items-center gap-3'>
                      <div className='flex items-center justify-center rounded-lg p-2 bg-primaryLighter'>
                        <i className='tabler-mail text-primary text-xl' />
                      </div>
                      <div>
                        <Typography variant='body2' color='text.disabled'>
                          Email
                        </Typography>
                        <Typography className='font-medium'>{user?.email}</Typography>
                      </div>
                    </div>
                    <Divider />
                    <div className='flex items-center gap-3'>
                      <div className='flex items-center justify-center rounded-lg p-2 bg-primaryLighter'>
                        <i className='tabler-shield-check text-primary text-xl' />
                      </div>
                      <div>
                        <Typography variant='body2' color='text.disabled'>
                          Role
                        </Typography>
                        <Chip
                          label={user?.role?.charAt(0).toUpperCase() + (user?.role?.slice(1) || '')}
                          size='small'
                          color='primary'
                          variant='tonal'
                        />
                      </div>
                    </div>
                    <Divider />
                    <div className='flex items-center gap-3'>
                      <div className='flex items-center justify-center rounded-lg p-2 bg-primaryLighter'>
                        <i className='tabler-circle-check text-primary text-xl' />
                      </div>
                      <div>
                        <Typography variant='body2' color='text.disabled'>
                          Status
                        </Typography>
                        <Chip
                          label={user?.is_active ? 'Active' : 'Inactive'}
                          size='small'
                          color={user?.is_active ? 'success' : 'error'}
                          variant='tonal'
                        />
                      </div>
                    </div>
                    <Divider />
                    <div className='flex items-center gap-3'>
                      <div className='flex items-center justify-center rounded-lg p-2 bg-primaryLighter'>
                        <i className='tabler-calendar text-primary text-xl' />
                      </div>
                      <div>
                        <Typography variant='body2' color='text.disabled'>
                          Joined
                        </Typography>
                        <Typography className='font-medium'>
                          {user?.created_at ? formatDate(user.created_at) : 'N/A'}
                        </Typography>
                      </div>
                    </div>
                    <Divider />
                    <div className='flex items-center gap-3'>
                      <div className='flex items-center justify-center rounded-lg p-2 bg-primaryLighter'>
                        <i className='tabler-refresh text-primary text-xl' />
                      </div>
                      <div>
                        <Typography variant='body2' color='text.disabled'>
                          Last Updated
                        </Typography>
                        <Typography className='font-medium'>
                          {user?.updated_at ? formatDate(user.updated_at) : 'N/A'}
                        </Typography>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </TabPanel>

          {/* Security Tab */}
          <TabPanel value='security' className='p-0'>
            <Grid container spacing={6}>
              <Grid size={{ xs: 12, md: 7 }}>
                <Card>
                  <CardHeader title='Change Password' subheader='Ensure your account is using a strong password' />
                  <CardContent className='flex flex-col gap-6'>
                    <TextField
                      fullWidth
                      label='Current Password'
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position='start'>
                              <i className='tabler-lock' />
                            </InputAdornment>
                          ),
                          endAdornment: (
                            <InputAdornment position='end'>
                              <IconButton
                                edge='end'
                                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                onMouseDown={e => e.preventDefault()}
                              >
                                <i className={showCurrentPassword ? 'tabler-eye-off' : 'tabler-eye'} />
                              </IconButton>
                            </InputAdornment>
                          )
                        }
                      }}
                    />
                    <TextField
                      fullWidth
                      label='New Password'
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      helperText='Must be at least 8 characters'
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position='start'>
                              <i className='tabler-lock-plus' />
                            </InputAdornment>
                          ),
                          endAdornment: (
                            <InputAdornment position='end'>
                              <IconButton
                                edge='end'
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                onMouseDown={e => e.preventDefault()}
                              >
                                <i className={showNewPassword ? 'tabler-eye-off' : 'tabler-eye'} />
                              </IconButton>
                            </InputAdornment>
                          )
                        }
                      }}
                    />
                    <TextField
                      fullWidth
                      label='Confirm New Password'
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      error={confirmPassword !== '' && confirmPassword !== newPassword}
                      helperText={
                        confirmPassword !== '' && confirmPassword !== newPassword ? 'Passwords do not match' : ''
                      }
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position='start'>
                              <i className='tabler-lock-check' />
                            </InputAdornment>
                          ),
                          endAdornment: (
                            <InputAdornment position='end'>
                              <IconButton
                                edge='end'
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                onMouseDown={e => e.preventDefault()}
                              >
                                <i className={showConfirmPassword ? 'tabler-eye-off' : 'tabler-eye'} />
                              </IconButton>
                            </InputAdornment>
                          )
                        }
                      }}
                    />
                    <Divider />
                    <div className='flex gap-4'>
                      <Button variant='contained' onClick={handleChangePassword} disabled={savingPassword}>
                        {savingPassword ? 'Updating...' : 'Update Password'}
                      </Button>
                      <Button
                        variant='tonal'
                        color='secondary'
                        onClick={() => {
                          setCurrentPassword('')
                          setNewPassword('')
                          setConfirmPassword('')
                        }}
                      >
                        Reset
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Grid>

              {/* Security Tips */}
              <Grid size={{ xs: 12, md: 5 }}>
                <Card>
                  <CardHeader title='Security Tips' />
                  <CardContent className='flex flex-col gap-4'>
                    <div className='flex items-start gap-3'>
                      <i className='tabler-check text-success mt-1' />
                      <Typography variant='body2'>Use a strong password with at least 8 characters</Typography>
                    </div>
                    <div className='flex items-start gap-3'>
                      <i className='tabler-check text-success mt-1' />
                      <Typography variant='body2'>Include uppercase, lowercase, numbers, and symbols</Typography>
                    </div>
                    <div className='flex items-start gap-3'>
                      <i className='tabler-check text-success mt-1' />
                      <Typography variant='body2'>Avoid using the same password across multiple sites</Typography>
                    </div>
                    <div className='flex items-start gap-3'>
                      <i className='tabler-check text-success mt-1' />
                      <Typography variant='body2'>Change your password regularly for better security</Typography>
                    </div>
                    <div className='flex items-start gap-3'>
                      <i className='tabler-check text-success mt-1' />
                      <Typography variant='body2'>Never share your password with anyone</Typography>
                    </div>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </TabPanel>

          {/* Overview Tab */}
          <TabPanel value='overview' className='p-0'>
            <Grid container spacing={6}>
              {/* Stats Cards */}
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Card>
                  <CardContent className='flex flex-col items-center gap-2 text-center'>
                    <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
                      <i className='tabler-users text-2xl' />
                    </Avatar>
                    <Typography variant='h4'>{stats?.subscribers?.total ?? 0}</Typography>
                    <Typography color='text.secondary'>Total Subscribers</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Card>
                  <CardContent className='flex flex-col items-center gap-2 text-center'>
                    <Avatar sx={{ bgcolor: 'success.main', width: 48, height: 48 }}>
                      <i className='tabler-user-check text-2xl' />
                    </Avatar>
                    <Typography variant='h4'>{stats?.subscribers?.active ?? 0}</Typography>
                    <Typography color='text.secondary'>Active Subscribers</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Card>
                  <CardContent className='flex flex-col items-center gap-2 text-center'>
                    <Avatar sx={{ bgcolor: 'info.main', width: 48, height: 48 }}>
                      <i className='tabler-send text-2xl' />
                    </Avatar>
                    <Typography variant='h4'>{stats?.campaigns?.total ?? 0}</Typography>
                    <Typography color='text.secondary'>Campaigns</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Card>
                  <CardContent className='flex flex-col items-center gap-2 text-center'>
                    <Avatar sx={{ bgcolor: 'warning.main', width: 48, height: 48 }}>
                      <i className='tabler-list text-2xl' />
                    </Avatar>
                    <Typography variant='h4'>{stats?.lists?.total ?? 0}</Typography>
                    <Typography color='text.secondary'>Mailing Lists</Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Account Activity */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Card>
                  <CardHeader title='Account Information' />
                  <CardContent className='flex flex-col gap-4'>
                    <div className='flex justify-between items-center'>
                      <Typography color='text.secondary'>Account ID</Typography>
                      <Typography className='font-medium'>#{user?.id}</Typography>
                    </div>
                    <Divider />
                    <div className='flex justify-between items-center'>
                      <Typography color='text.secondary'>Account Status</Typography>
                      <Chip
                        label={user?.is_active ? 'Active' : 'Inactive'}
                        size='small'
                        color={user?.is_active ? 'success' : 'error'}
                        variant='tonal'
                      />
                    </div>
                    <Divider />
                    <div className='flex justify-between items-center'>
                      <Typography color='text.secondary'>Role</Typography>
                      <Chip
                        label={user?.role?.charAt(0).toUpperCase() + (user?.role?.slice(1) || '')}
                        size='small'
                        color='primary'
                        variant='tonal'
                      />
                    </div>
                    <Divider />
                    <div className='flex justify-between items-center'>
                      <Typography color='text.secondary'>Account Created</Typography>
                      <Typography className='font-medium'>
                        {user?.created_at ? formatDate(user.created_at) : 'N/A'}
                      </Typography>
                    </div>
                    <Divider />
                    <div className='flex justify-between items-center'>
                      <Typography color='text.secondary'>Last Profile Update</Typography>
                      <Typography className='font-medium'>
                        {user?.updated_at ? formatDate(user.updated_at) : 'N/A'}
                      </Typography>
                    </div>
                  </CardContent>
                </Card>
              </Grid>

              {/* Platform Summary */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Card>
                  <CardHeader title='Platform Usage' />
                  <CardContent className='flex flex-col gap-5'>
                    <div>
                      <div className='flex justify-between items-center mbe-2'>
                        <Typography>Subscribers</Typography>
                        <Typography className='font-medium'>{stats?.subscribers?.total ?? 0}</Typography>
                      </div>
                      <LinearProgress variant='determinate' value={Math.min((stats?.subscribers?.total ?? 0) / 10, 100)} color='primary' />
                    </div>
                    <div>
                      <div className='flex justify-between items-center mbe-2'>
                        <Typography>Campaigns Sent</Typography>
                        <Typography className='font-medium'>{stats?.campaigns?.sent ?? stats?.campaigns?.total ?? 0}</Typography>
                      </div>
                      <LinearProgress variant='determinate' value={Math.min((stats?.campaigns?.total ?? 0) / 5, 100)} color='success' />
                    </div>
                    <div>
                      <div className='flex justify-between items-center mbe-2'>
                        <Typography>Mailing Lists</Typography>
                        <Typography className='font-medium'>{stats?.lists?.total ?? 0}</Typography>
                      </div>
                      <LinearProgress variant='determinate' value={Math.min((stats?.lists?.total ?? 0) / 5, 100)} color='info' />
                    </div>
                    <div>
                      <div className='flex justify-between items-center mbe-2'>
                        <Typography>Active Subscribers</Typography>
                        <Typography className='font-medium'>
                          {stats?.subscribers?.total
                            ? `${Math.round(((stats?.subscribers?.active ?? 0) / stats.subscribers.total) * 100)}%`
                            : '0%'}
                        </Typography>
                      </div>
                      <LinearProgress
                        variant='determinate'
                        value={
                          stats?.subscribers?.total
                            ? ((stats?.subscribers?.active ?? 0) / stats.subscribers.total) * 100
                            : 0
                        }
                        color='warning'
                      />
                    </div>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </TabPanel>
        </TabContext>
      </Grid>
    </Grid>
  )
}

export default UserProfile
