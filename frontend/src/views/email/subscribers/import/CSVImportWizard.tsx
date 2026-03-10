'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

import { useDropzone } from 'react-dropzone'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stepper from '@mui/material/Stepper'
import Step from '@mui/material/Step'
import StepLabel from '@mui/material/StepLabel'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import Autocomplete from '@mui/material/Autocomplete'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import LinearProgress from '@mui/material/LinearProgress'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import CircularProgress from '@mui/material/CircularProgress'
import Snackbar from '@mui/material/Snackbar'

import type { List } from '@/types/email'
import importService from '@/services/import'
import listService from '@/services/lists'

interface CSVImportWizardProps {
  onImportComplete?: () => void
}

const steps = ['Upload File', 'Field Mapping', 'Configure', 'Import']

const listmonkFields = [
  { value: 'email', label: 'Email (required)' },
  { value: 'name', label: 'Name' },
  { value: 'attribs.city', label: 'Attribute: City' },
  { value: 'attribs.company', label: 'Attribute: Company' },
  { value: 'attribs.country', label: 'Attribute: Country' },
  { value: 'attribs.phone', label: 'Attribute: Phone' },
  { value: '', label: '— Skip this column —' }
]

const CSVImportWizard = ({ onImportComplete }: CSVImportWizardProps) => {
  const [activeStep, setActiveStep] = useState(0)
  const [file, setFile] = useState<File | null>(null)
  const [previewRows, setPreviewRows] = useState<string[][]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [fieldMapping, setFieldMapping] = useState<Record<number, string>>({})
  const [delimiter, setDelimiter] = useState(',')
  const [mode, setMode] = useState<'subscribe' | 'blocklist'>('subscribe')
  const [overwrite, setOverwrite] = useState(true)
  const [selectedLists, setSelectedLists] = useState<List[]>([])
  const [availableLists, setAvailableLists] = useState<List[]>([])
  const [listsLoading, setListsLoading] = useState(false)

  // Import state
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importStatus, setImportStatus] = useState<string>('')
  const [importComplete, setImportComplete] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)
  const [importLogs, setImportLogs] = useState<string>('')
  const [error, setError] = useState('')
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' })
  const [fileText, setFileText] = useState<string>('')

  // Refs for cleanup
  const importCompleteRef = useRef(false)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  // Fetch lists on mount
  useEffect(() => {
    const fetchLists = async () => {
      setListsLoading(true)

      try {
        const res = await listService.getAll({ per_page: 100 })

        setAvailableLists(res.data.results || [])
      } catch {
        setSnackbar({ open: true, message: 'Failed to load lists', severity: 'error' })
      } finally {
        setListsLoading(false)
      }
    }

    fetchLists()
  }, [])

  const parseCSV = useCallback(
    (text: string) => {
      const delim = delimiter
      const lines = text.split('\n').filter(l => l.trim())

      const parsed = lines.map(line => {
        const result: string[] = []
        let current = ''
        let inQuotes = false

        for (let i = 0; i < line.length; i++) {
          const char = line[i]

          if (char === '"') {
            inQuotes = !inQuotes
          } else if (char === delim && !inQuotes) {
            result.push(current.trim())
            current = ''
          } else {
            current += char
          }
        }

        result.push(current.trim())

        return result
      })

      return parsed
    },
    [delimiter]
  )

  const applyParsing = useCallback(
    (text: string) => {
      const parsed = parseCSV(text)

      if (parsed.length > 0) {
        setHeaders(parsed[0])
        setPreviewRows(parsed.slice(1, 6))

        // Auto-detect field mapping
        const mapping: Record<number, string> = {}

        parsed[0].forEach((header, idx) => {
          const h = header.toLowerCase().trim()

          if (h === 'email' || h === 'e-mail' || h === 'email_address') {
            mapping[idx] = 'email'
          } else if (h === 'name' || h === 'full_name' || h === 'fullname') {
            mapping[idx] = 'name'
          } else if (h === 'city') {
            mapping[idx] = 'attribs.city'
          } else if (h === 'company' || h === 'organization') {
            mapping[idx] = 'attribs.company'
          } else if (h === 'country') {
            mapping[idx] = 'attribs.country'
          } else if (h === 'phone' || h === 'telephone') {
            mapping[idx] = 'attribs.phone'
          } else {
            mapping[idx] = ''
          }
        })

        setFieldMapping(mapping)
      }
    },
    [parseCSV]
  )

  // Re-parse when delimiter changes and we have file text
  useEffect(() => {
    if (fileText) {
      applyParsing(fileText)
    }
  }, [delimiter, fileText, applyParsing])

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const f = acceptedFiles[0]

      if (!f) return
      setFile(f)

      const reader = new FileReader()

      reader.onload = e => {
        const text = e.target?.result as string

        setFileText(text)
        applyParsing(text)
      }

      reader.readAsText(f)
    },
    [applyParsing]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'text/plain': ['.txt'],
      'text/tab-separated-values': ['.tsv']
    },
    maxFiles: 1,
    multiple: false
  })

  const handleStartImport = async () => {
    if (!file) return

    setImporting(true)
    setImportStatus('Uploading...')
    setImportProgress(10)
    setError('')

    try {
      const params = {
        mode,
        delim: delimiter,
        lists: selectedLists.map(l => l.id),
        overwrite,
        field_mapping: fieldMapping
      }

      const importRes = await importService.importCSV(file, params)
      const historyId = importRes?.history_id

      setImportProgress(30)
      setImportStatus('Processing...')

      // Clear any previous intervals
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)

      // Poll for import status
      pollIntervalRef.current = setInterval(async () => {
        try {
          const statusRes = await importService.getImportStatus()
          const data = statusRes?.data

          if (data) {
            const total = data.total || 0
            const imported = data.imported || 0

            if (total > 0) {
              const progress = Math.min(30 + Math.round((imported / total) * 60), 90)

              setImportProgress(progress)
              setImportStatus(`Importing: ${imported} / ${total}`)
            }

            if (data.status === 'finished' || data.status === 'stopped') {
              if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
              pollIntervalRef.current = null
              setImportProgress(100)
              setImportComplete(true)
              importCompleteRef.current = true
              setImportStatus(data.status === 'finished' ? 'Import Complete' : 'Import Stopped')

              setImportResult({
                total: data.total,
                imported: data.imported,
                status: data.status
              })

              // Update import history with completion status
              if (historyId) {
                try {
                  await importService.updateHistory({
                    id: historyId,
                    status: data.status === 'finished' ? 'completed' : 'failed',
                    total: data.total || 0,
                    successful: data.imported || 0,
                    failed: 0,
                    skipped: 0
                  })
                } catch (_e) {
                  // non-critical
                }
              }

              // Fetch logs
              try {
                const logsRes = await importService.getImportLogs()

                setImportLogs(typeof logsRes === 'string' ? logsRes : JSON.stringify(logsRes?.data, null, 2))
              } catch (_e) {
                // ignore
              }

              onImportComplete?.()
              setImporting(false)
              setSnackbar({ open: true, message: 'Import completed successfully!', severity: 'success' })
            }
          }
        } catch (_e) {
          // Keep polling
        }
      }, 2000)

      // Timeout after 5 minutes
      timeoutRef.current = setTimeout(() => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
          pollIntervalRef.current = null
        }

        if (!importCompleteRef.current) {
          setImporting(false)
          setImportStatus('Import timed out — check import history')
        }
      }, 300000)
    } catch (err: any) {
      setImporting(false)
      setError(err?.response?.data?.message || 'Import failed')
      setSnackbar({ open: true, message: 'Import failed', severity: 'error' })
    }
  }

  const handleCancelImport = async () => {
    try {
      await importService.cancelImport()
      setImporting(false)
      setImportStatus('Import cancelled')
      setSnackbar({ open: true, message: 'Import cancelled', severity: 'success' })
    } catch {
      setSnackbar({ open: true, message: 'Failed to cancel import', severity: 'error' })
    }
  }

  const handleReset = () => {
    setActiveStep(0)
    setFile(null)
    setFileText('')
    setPreviewRows([])
    setHeaders([])
    setFieldMapping({})
    setImporting(false)
    setImportProgress(0)
    setImportStatus('')
    setImportComplete(false)
    importCompleteRef.current = false
    setImportResult(null)
    setImportLogs('')
    setError('')
  }

  const canProceed = () => {
    switch (activeStep) {
      case 0:
        return !!file

      case 1: {
        const mappedValues = Object.values(fieldMapping)

        return mappedValues.includes('email')
      }

      case 2:
        return selectedLists.length > 0 || mode === 'blocklist'
      default:
        return true
    }
  }

  // Step 1: File Upload
  const renderFileUpload = () => (
    <Box className='flex flex-col gap-4'>
      <FormControl size='small' sx={{ maxWidth: 200 }}>
        <InputLabel>Delimiter</InputLabel>
        <Select value={delimiter} label='Delimiter' onChange={e => setDelimiter(e.target.value)}>
          <MenuItem value=','>Comma (,)</MenuItem>
          <MenuItem value={'\t'}>Tab</MenuItem>
          <MenuItem value=';'>Semicolon (;)</MenuItem>
          <MenuItem value='|'>Pipe (|)</MenuItem>
        </Select>
      </FormControl>

      <Box
        {...getRootProps()}
        sx={{
          border: '2px dashed',
          borderColor: isDragActive ? 'primary.main' : 'divider',
          borderRadius: 2,
          p: 6,
          textAlign: 'center',
          cursor: 'pointer',
          backgroundColor: isDragActive ? 'action.hover' : 'transparent',
          transition: 'all 0.2s'
        }}
      >
        <input {...getInputProps()} />
        <i className='tabler-cloud-upload text-[48px]' style={{ color: 'var(--mui-palette-text-secondary)' }} />
        <Typography variant='h6' className='mt-2'>
          {isDragActive ? 'Drop your file here' : 'Drag & drop a CSV file here, or click to browse'}
        </Typography>
        <Typography variant='body2' color='text.secondary' className='mt-1'>
          Supports .csv, .tsv, and .txt files
        </Typography>
      </Box>

      {file && (
        <Alert severity='success' icon={<i className='tabler-file-check text-[20px]' />}>
          <Typography variant='body2'>
            <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB) — {previewRows.length} data rows previewed
          </Typography>
        </Alert>
      )}

      {file && previewRows.length > 0 && (
        <Box>
          <Typography variant='subtitle2' className='mb-2'>
            Preview (first 5 rows)
          </Typography>
          <TableContainer component={Paper} variant='outlined' sx={{ maxHeight: 300 }}>
            <Table size='small' stickyHeader>
              <TableHead>
                <TableRow>
                  {headers.map((h, i) => (
                    <TableCell key={i} sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {previewRows.map((row, ri) => (
                  <TableRow key={ri}>
                    {row.map((cell, ci) => (
                      <TableCell key={ci} sx={{ whiteSpace: 'nowrap' }}>
                        {cell}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Box>
  )

  // Step 2: Field Mapping
  const renderFieldMapping = () => (
    <Box className='flex flex-col gap-4'>
      <Alert severity='info'>
        Map your CSV columns to subscriber fields. The <strong>Email</strong> column is required.
      </Alert>

      <TableContainer component={Paper} variant='outlined'>
        <Table size='small'>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, width: '40%' }}>CSV Column</TableCell>
              <TableCell sx={{ fontWeight: 600, width: '40%' }}>Map to Field</TableCell>
              <TableCell sx={{ fontWeight: 600, width: '20%' }}>Sample</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {headers.map((header, idx) => (
              <TableRow key={idx}>
                <TableCell>
                  <Typography variant='body2' className='font-medium'>
                    {header}
                  </Typography>
                </TableCell>
                <TableCell>
                  <FormControl fullWidth size='small'>
                    <Select
                      value={fieldMapping[idx] ?? ''}
                      onChange={e => setFieldMapping(prev => ({ ...prev, [idx]: e.target.value as string }))}
                    >
                      {listmonkFields.map(f => (
                        <MenuItem key={f.value} value={f.value}>
                          {f.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </TableCell>
                <TableCell>
                  <Typography variant='body2' color='text.secondary'>
                    {previewRows[0]?.[idx] || '—'}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )

  // Step 3: Configuration
  const renderConfiguration = () => (
    <Box className='flex flex-col gap-4'>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <FormControl fullWidth>
            <InputLabel>Import Mode</InputLabel>
            <Select value={mode} label='Import Mode' onChange={e => setMode(e.target.value as 'subscribe' | 'blocklist')}>
              <MenuItem value='subscribe'>Subscribe — Add to lists</MenuItem>
              <MenuItem value='blocklist'>Blocklist — Block these emails</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12 }}>
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
              <TextField
                {...params}
                label='Assign to Lists'
                placeholder='Select lists...'
                helperText={mode === 'blocklist' ? 'Not required for blocklist mode' : 'Select one or more lists'}
              />
            )}
          />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <FormControlLabel
            control={<Switch checked={overwrite} onChange={e => setOverwrite(e.target.checked)} />}
            label='Overwrite existing subscribers (update name and attributes if email exists)'
          />
        </Grid>
      </Grid>
    </Box>
  )

  // Step 4: Review & Import
  const renderImport = () => (
    <Box className='flex flex-col gap-4'>
      {!importing && !importComplete && (
        <>
          <Alert severity='info'>
            Review your import configuration before starting.
          </Alert>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant='body2' color='text.secondary'>
                File
              </Typography>
              <Typography variant='body1' className='font-medium'>
                {file?.name}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant='body2' color='text.secondary'>
                Mode
              </Typography>
              <Typography variant='body1' className='font-medium'>
                {mode === 'subscribe' ? 'Subscribe' : 'Blocklist'}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant='body2' color='text.secondary'>
                Lists
              </Typography>
              <Box className='flex gap-1 flex-wrap mt-1'>
                {selectedLists.length > 0
                  ? selectedLists.map(l => <Chip key={l.id} label={l.name} size='small' />)
                  : <Typography variant='body2'>None</Typography>
                }
              </Box>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant='body2' color='text.secondary'>
                Overwrite
              </Typography>
              <Typography variant='body1' className='font-medium'>
                {overwrite ? 'Yes' : 'No'}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant='body2' color='text.secondary'>
                Mapped Fields
              </Typography>
              <Box className='flex gap-1 flex-wrap mt-1'>
                {Object.entries(fieldMapping)
                  .filter(([, v]) => v)
                  .map(([idx, val]) => (
                    <Chip
                      key={idx}
                      label={`${headers[Number(idx)]} → ${val}`}
                      size='small'
                      variant='outlined'
                    />
                  ))}
              </Box>
            </Grid>
          </Grid>
          <Button
            variant='contained'
            size='large'
            startIcon={<i className='tabler-upload' />}
            onClick={handleStartImport}
          >
            Start Import
          </Button>
        </>
      )}

      {importing && (
        <Box className='flex flex-col items-center gap-4 py-8'>
          <CircularProgress size={48} />
          <Typography variant='h6'>{importStatus}</Typography>
          <Box sx={{ width: '100%', maxWidth: 500 }}>
            <LinearProgress variant='determinate' value={importProgress} sx={{ height: 8, borderRadius: 4 }} />
          </Box>
          <Typography variant='body2' color='text.secondary'>
            {importProgress}% complete
          </Typography>
          <Button variant='outlined' color='error' onClick={handleCancelImport} startIcon={<i className='tabler-x' />}>
            Cancel Import
          </Button>
        </Box>
      )}

      {error && (
        <Alert severity='error'>
          {error}
        </Alert>
      )}

      {importComplete && importResult && (
        <Box className='flex flex-col gap-4'>
          <Alert severity='success'>
            Import completed! {importResult.imported ?? importResult.total} subscribers processed.
          </Alert>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Box className='text-center p-4 rounded-lg' sx={{ bgcolor: 'action.hover' }}>
                <Typography variant='h5' className='font-bold' color='primary'>
                  {importResult.total ?? 0}
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  Total
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Box className='text-center p-4 rounded-lg' sx={{ bgcolor: 'action.hover' }}>
                <Typography variant='h5' className='font-bold' color='success.main'>
                  {importResult.imported ?? 0}
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  Imported
                </Typography>
              </Box>
            </Grid>
          </Grid>

          {importLogs && (
            <Box>
              <Typography variant='subtitle2' className='mb-1'>
                Import Logs
              </Typography>
              <Paper
                variant='outlined'
                sx={{
                  p: 2,
                  maxHeight: 200,
                  overflow: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  bgcolor: 'grey.50',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {importLogs}
              </Paper>
            </Box>
          )}

          <Button variant='contained' onClick={handleReset} startIcon={<i className='tabler-refresh' />}>
            Import Another File
          </Button>
        </Box>
      )}
    </Box>
  )

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return renderFileUpload()
      case 1:
        return renderFieldMapping()
      case 2:
        return renderConfiguration()
      case 3:
        return renderImport()
      default:
        return null
    }
  }

  return (
    <Box className='flex flex-col gap-6'>
      <Stepper activeStep={activeStep} alternativeLabel>
        {steps.map(label => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Box>{renderStepContent()}</Box>

      {/* Navigation Buttons */}
      {!importing && !importComplete && (
        <Box className='flex justify-between'>
          <Button disabled={activeStep === 0} onClick={() => setActiveStep(prev => prev - 1)} variant='outlined'>
            Back
          </Button>
          {activeStep < steps.length - 1 && (
            <Button disabled={!canProceed()} onClick={() => setActiveStep(prev => prev + 1)} variant='contained'>
              Next
            </Button>
          )}
        </Box>
      )}

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

export default CSVImportWizard
