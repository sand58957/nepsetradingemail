'use client'

// React Imports
import { useState, useRef } from 'react'

// MUI Imports
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import CircularProgress from '@mui/material/CircularProgress'
import LinearProgress from '@mui/material/LinearProgress'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'

// Service Imports
import whatsappService from '@/services/whatsapp'

const WAContactImport = () => {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null)

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]

    if (file) {
      if (!file.name.endsWith('.csv')) {
        setSnackbar({ open: true, message: 'Please select a CSV file', severity: 'error' })

        return
      }

      setSelectedFile(file)
      setImportResult(null)
    }
  }

  const handleImport = async () => {
    if (!selectedFile) {
      setSnackbar({ open: true, message: 'Please select a file first', severity: 'error' })

      return
    }

    setImporting(true)

    try {
      const formData = new FormData()

      formData.append('file', selectedFile)

      const response = await whatsappService.importContacts(formData)

      setImportResult(response.data)
      setSnackbar({
        open: true,
        message: `Imported ${response.data.imported} contacts (${response.data.skipped} skipped)`,
        severity: 'success'
      })
    } catch {
      setSnackbar({ open: true, message: 'Failed to import contacts', severity: 'error' })
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      <Grid container spacing={6}>
        {/* Upload Card */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardHeader title='Upload CSV File' />
            <CardContent>
              <div className='flex flex-col gap-4'>
                {/* Drop Zone */}
                <Box
                  className='flex flex-col items-center justify-center p-8 rounded-lg cursor-pointer'
                  sx={{
                    border: '2px dashed',
                    borderColor: selectedFile ? 'success.main' : 'divider',
                    backgroundColor: selectedFile ? 'success.lighter' : 'action.hover',
                    '&:hover': { borderColor: 'primary.main' }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <i className={`${selectedFile ? 'tabler-file-check' : 'tabler-cloud-upload'} text-[48px] mb-2`}
                    style={{ color: selectedFile ? 'var(--mui-palette-success-main)' : 'var(--mui-palette-text-secondary)' }}
                  />
                  {selectedFile ? (
                    <>
                      <Typography className='font-medium'>{selectedFile.name}</Typography>
                      <Typography variant='body2' color='text.secondary'>
                        {(selectedFile.size / 1024).toFixed(1)} KB — Click to change
                      </Typography>
                    </>
                  ) : (
                    <>
                      <Typography className='font-medium'>Click to select CSV file</Typography>
                      <Typography variant='body2' color='text.secondary'>
                        Supported format: .csv
                      </Typography>
                    </>
                  )}
                </Box>

                <input
                  ref={fileInputRef}
                  type='file'
                  accept='.csv'
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />

                {/* Progress */}
                {importing && (
                  <Box>
                    <LinearProgress />
                    <Typography variant='body2' color='text.secondary' className='mt-2'>
                      Importing contacts...
                    </Typography>
                  </Box>
                )}

                {/* Result */}
                {importResult && (
                  <Alert severity='success' className='mt-2'>
                    Successfully imported <strong>{importResult.imported}</strong> contacts.
                    {importResult.skipped > 0 && ` ${importResult.skipped} duplicates skipped.`}
                  </Alert>
                )}

                {/* Actions */}
                <div className='flex gap-3'>
                  <Button
                    variant='contained'
                    onClick={handleImport}
                    disabled={!selectedFile || importing}
                    startIcon={importing ? <CircularProgress size={18} /> : <i className='tabler-upload' />}
                  >
                    {importing ? 'Importing...' : 'Import Contacts'}
                  </Button>
                  {importResult && (
                    <Button
                      variant='outlined'
                      onClick={() => {
                        setSelectedFile(null)
                        setImportResult(null)
                      }}
                      startIcon={<i className='tabler-refresh' />}
                    >
                      Import More
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </Grid>

        {/* Instructions */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardHeader title='CSV Format' />
            <CardContent>
              <div className='flex flex-col gap-3'>
                <Alert severity='info'>
                  Your CSV file should have headers in the first row.
                </Alert>

                <Typography variant='subtitle2'>Required Columns:</Typography>
                <Typography variant='body2' color='text.secondary'>
                  <strong>phone</strong> — Phone number with country code (e.g. 9779812345678)
                </Typography>

                <Typography variant='subtitle2' className='mt-2'>Optional Columns:</Typography>
                <Typography variant='body2' color='text.secondary'>
                  <strong>name</strong> — Contact name
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  <strong>email</strong> — Email address
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  <strong>tags</strong> — Comma-separated tags
                </Typography>

                <Typography variant='subtitle2' className='mt-2'>Example:</Typography>
                <Box
                  className='p-3 rounded'
                  sx={{ backgroundColor: 'action.hover', fontFamily: 'monospace', fontSize: '0.75rem' }}
                >
                  phone,name,email,tags<br />
                  9779812345678,John Doe,john@test.com,&quot;vip,investor&quot;<br />
                  9779887654321,Jane Doe,jane@test.com,trader
                </Box>

                <Typography variant='caption' color='text.secondary' className='mt-2'>
                  Duplicate phone numbers will be skipped. Existing contacts will not be overwritten.
                </Typography>
              </div>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant='filled'
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  )
}

export default WAContactImport
