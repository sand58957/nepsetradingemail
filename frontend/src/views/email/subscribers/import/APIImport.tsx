'use client'

import { useState, useEffect } from 'react'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Grid from '@mui/material/Grid'
import Autocomplete from '@mui/material/Autocomplete'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Divider from '@mui/material/Divider'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'

import type { List, ImportError } from '@/types/email'
import importService from '@/services/import'
import listService from '@/services/lists'

interface APIImportProps {
  onImportComplete?: () => void
}

const exampleJSON = `[
  {
    "email": "john@example.com",
    "name": "John Doe",
    "status": "enabled",
    "attribs": { "city": "New York", "company": "Acme Inc" }
  },
  {
    "email": "jane@example.com",
    "name": "Jane Smith"
  }
]`

const APIImport = ({ onImportComplete }: APIImportProps) => {
  const [jsonInput, setJsonInput] = useState('')
  const [selectedLists, setSelectedLists] = useState<List[]>([])
  const [availableLists, setAvailableLists] = useState<List[]>([])
  const [listsLoading, setListsLoading] = useState(false)
  const [overwrite, setOverwrite] = useState(true)
  const [importing, setImporting] = useState(false)

  const [result, setResult] = useState<{
    import_id: number
    total: number
    successful: number
    failed: number
    skipped: number
    errors: ImportError[]
  } | null>(null)

  const [error, setError] = useState('')
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' })
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const fetchLists = async () => {
      setListsLoading(true)

      try {
        const res = await listService.getAll({ per_page: 100 })

        setAvailableLists(res.data.results || [])
      } catch {
        // silently fail
      } finally {
        setListsLoading(false)
      }
    }

    fetchLists()
  }, [])

  const handleImport = async () => {
    setError('')
    setResult(null)

    // Validate JSON
    let subscribers

    try {
      subscribers = JSON.parse(jsonInput)

      if (!Array.isArray(subscribers)) {
        setError('Input must be a JSON array of subscriber objects')

        return
      }

      if (subscribers.length === 0) {
        setError('Array must contain at least one subscriber')

        return
      }
    } catch {
      setError('Invalid JSON format. Please check your input.')

      return
    }

    if (selectedLists.length === 0) {
      setError('Please select at least one list')

      return
    }

    setImporting(true)

    try {
      const res = await importService.importJSON({
        subscribers,
        list_ids: selectedLists.map(l => l.id),
        overwrite
      })

      setResult(res.data)
      onImportComplete?.()
      setSnackbar({
        open: true,
        message: `Import complete: ${res.data.successful} successful, ${res.data.failed} failed`,
        severity: res.data.failed > 0 ? 'error' : 'success'
      })
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Import failed')
      setSnackbar({ open: true, message: 'Import failed', severity: 'error' })
    } finally {
      setImporting(false)
    }
  }

  const handleCopyEndpoint = () => {
    navigator.clipboard.writeText('POST /api/import/json')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Box className='flex flex-col gap-6'>
      {/* API Documentation Card */}
      <Card variant='outlined'>
        <CardContent className='flex flex-col gap-3'>
          <Box className='flex items-center justify-between'>
            <Typography variant='h6'>
              <i className='tabler-book text-[20px] mr-2' style={{ verticalAlign: 'middle' }} />
              API Documentation
            </Typography>
          </Box>
          <Divider />
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant='subtitle2' className='mb-1'>
                Endpoint
              </Typography>
              <Box className='flex items-center gap-2'>
                <Paper
                  variant='outlined'
                  sx={{
                    px: 2,
                    py: 1,
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    flex: 1,
                    bgcolor: 'grey.50'
                  }}
                >
                  POST /api/import/json
                </Paper>
                <Tooltip title={copied ? 'Copied!' : 'Copy'}>
                  <IconButton size='small' onClick={handleCopyEndpoint}>
                    <i className={copied ? 'tabler-check' : 'tabler-copy'} />
                  </IconButton>
                </Tooltip>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant='subtitle2' className='mb-1'>
                Authentication
              </Typography>
              <Paper
                variant='outlined'
                sx={{ px: 2, py: 1, fontFamily: 'monospace', fontSize: '0.85rem', bgcolor: 'grey.50' }}
              >
                Authorization: Bearer {'<your-jwt-token>'}
              </Paper>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Typography variant='subtitle2' className='mb-1'>
                Example Request Body
              </Typography>
              <Paper
                variant='outlined'
                sx={{
                  p: 2,
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  bgcolor: 'grey.50',
                  whiteSpace: 'pre-wrap',
                  maxHeight: 200,
                  overflow: 'auto'
                }}
              >
                {`{
  "subscribers": ${exampleJSON},
  "list_ids": [1, 2],
  "overwrite": true
}`}
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Test Import Form */}
      <Card variant='outlined'>
        <CardContent className='flex flex-col gap-4'>
          <Typography variant='h6'>
            <i className='tabler-test-pipe text-[20px] mr-2' style={{ verticalAlign: 'middle' }} />
            Test Import
          </Typography>
          <Divider />

          <TextField
            label='Subscriber JSON Array'
            multiline
            rows={8}
            fullWidth
            value={jsonInput}
            onChange={e => setJsonInput(e.target.value)}
            placeholder={exampleJSON}
            sx={{
              '& .MuiInputBase-root': {
                fontFamily: 'monospace',
                fontSize: '0.85rem'
              }
            }}
          />

          <Button
            variant='text'
            size='small'
            onClick={() => setJsonInput(exampleJSON)}
            startIcon={<i className='tabler-code' />}
          >
            Load Example Data
          </Button>

          <Autocomplete
            multiple
            options={availableLists}
            loading={listsLoading}
            getOptionLabel={opt => opt.name}
            value={selectedLists}
            onChange={(_, val) => setSelectedLists(val)}
            renderTags={(value, getTagProps) =>
              value.map((opt, index) => <Chip label={opt.name} size='small' {...getTagProps({ index })} key={opt.id} />)
            }
            renderInput={params => (
              <TextField {...params} label='Assign to Lists' placeholder='Select lists...' />
            )}
          />

          <FormControlLabel
            control={<Switch checked={overwrite} onChange={e => setOverwrite(e.target.checked)} />}
            label='Overwrite existing subscribers'
          />

          {error && <Alert severity='error'>{error}</Alert>}

          <Button
            variant='contained'
            onClick={handleImport}
            disabled={importing || !jsonInput.trim()}
            startIcon={importing ? <CircularProgress size={18} /> : <i className='tabler-upload' />}
          >
            {importing ? 'Importing...' : 'Import Subscribers'}
          </Button>

          {/* Results */}
          {result && (
            <Box className='flex flex-col gap-3'>
              <Alert severity={result.failed > 0 ? 'warning' : 'success'}>
                Import completed: {result.successful} successful, {result.failed} failed, {result.skipped} skipped
              </Alert>

              <Grid container spacing={2}>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Box className='text-center p-3 rounded-lg' sx={{ bgcolor: 'action.hover' }}>
                    <Typography variant='h6' className='font-bold'>
                      {result.total}
                    </Typography>
                    <Typography variant='body2' color='text.secondary'>
                      Total
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Box className='text-center p-3 rounded-lg' sx={{ bgcolor: 'action.hover' }}>
                    <Typography variant='h6' className='font-bold' color='success.main'>
                      {result.successful}
                    </Typography>
                    <Typography variant='body2' color='text.secondary'>
                      Successful
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Box className='text-center p-3 rounded-lg' sx={{ bgcolor: 'action.hover' }}>
                    <Typography variant='h6' className='font-bold' color='error.main'>
                      {result.failed}
                    </Typography>
                    <Typography variant='body2' color='text.secondary'>
                      Failed
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Box className='text-center p-3 rounded-lg' sx={{ bgcolor: 'action.hover' }}>
                    <Typography variant='h6' className='font-bold' color='warning.main'>
                      {result.skipped}
                    </Typography>
                    <Typography variant='body2' color='text.secondary'>
                      Skipped
                    </Typography>
                  </Box>
                </Grid>
              </Grid>

              {result.errors && result.errors.length > 0 && (
                <Box>
                  <Typography variant='subtitle2' className='mb-1'>
                    Error Details
                  </Typography>
                  <TableContainer component={Paper} variant='outlined' sx={{ maxHeight: 200 }}>
                    <Table size='small'>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Error</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {result.errors.map((err, i) => (
                          <TableRow key={i}>
                            <TableCell>{err.email || '—'}</TableCell>
                            <TableCell>
                              <Typography variant='body2' color='error'>
                                {err.error}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default APIImport
