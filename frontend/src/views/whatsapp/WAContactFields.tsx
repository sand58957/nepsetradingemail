'use client'

import { useState, useEffect } from 'react'

// MUI Imports
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'

// Service Imports
import whatsappService from '@/services/whatsapp'

const WAContactFields = () => {
  const [fields, setFields] = useState<{ field: string; count: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchFields = async () => {
      setLoading(true)

      try {
        const response = await whatsappService.getContactFields()

        setFields(response.data || [])
      } catch {
        console.error('Failed to fetch fields')
      } finally {
        setLoading(false)
      }
    }

    fetchFields()
  }, [])

  if (loading) {
    return (
      <div className='flex justify-center items-center py-16'>
        <CircularProgress size={28} />
        <Typography className='ml-3' color='text.secondary'>Loading fields...</Typography>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader
        title='Custom Fields'
        subheader='Attribute fields available on your WhatsApp contacts for template personalization'
      />
      <CardContent>
        <Alert severity='info' className='mb-4'>
          Custom fields are automatically detected from contact attributes. You can set attributes when
          creating/editing contacts or via CSV import. Use these fields as template variables in your campaigns.
        </Alert>

        {/* Built-in Fields */}
        <Typography variant='subtitle2' className='mb-2'>Built-in Fields</Typography>
        <TableContainer className='mb-6'>
          <Table size='small'>
            <TableHead>
              <TableRow>
                <TableCell>Field</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Template Variable</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell><Typography variant='body2' className='font-medium'>phone</Typography></TableCell>
                <TableCell><Chip label='TEXT' size='small' variant='outlined' /></TableCell>
                <TableCell><code className='text-xs'>{'{{phone}}'}</code></TableCell>
              </TableRow>
              <TableRow>
                <TableCell><Typography variant='body2' className='font-medium'>name</Typography></TableCell>
                <TableCell><Chip label='TEXT' size='small' variant='outlined' /></TableCell>
                <TableCell><code className='text-xs'>{'{{name}}'}</code></TableCell>
              </TableRow>
              <TableRow>
                <TableCell><Typography variant='body2' className='font-medium'>email</Typography></TableCell>
                <TableCell><Chip label='TEXT' size='small' variant='outlined' /></TableCell>
                <TableCell><code className='text-xs'>{'{{email}}'}</code></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>

        {/* Custom Attribute Fields */}
        <Typography variant='subtitle2' className='mb-2'>Custom Attribute Fields</Typography>
        {fields.length === 0 ? (
          <div className='text-center py-6'>
            <i className='tabler-forms text-[40px] mb-2' style={{ color: 'var(--mui-palette-text-secondary)' }} />
            <Typography color='text.secondary' variant='body2'>
              No custom attribute fields found. Add attributes to contacts via edit or CSV import.
            </Typography>
          </div>
        ) : (
          <TableContainer>
            <Table size='small'>
              <TableHead>
                <TableRow>
                  <TableCell>Field Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell align='center'>Contacts Using</TableCell>
                  <TableCell>Template Variable</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {fields.map(f => (
                  <TableRow key={f.field}>
                    <TableCell>
                      <Typography variant='body2' className='font-medium'>{f.field}</Typography>
                    </TableCell>
                    <TableCell><Chip label='TEXT' size='small' variant='outlined' /></TableCell>
                    <TableCell align='center'>
                      <Typography variant='body2'>{f.count}</Typography>
                    </TableCell>
                    <TableCell>
                      <code className='text-xs'>{`{{${f.field}}}`}</code>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  )
}

export default WAContactFields
