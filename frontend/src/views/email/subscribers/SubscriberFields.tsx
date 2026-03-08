'use client'

import { useState, useEffect } from 'react'

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Checkbox from '@mui/material/Checkbox'

import subscriberService from '@/services/subscribers'

interface FieldInfo {
  name: string
  type: string
  tag: string
}

const SubscriberFields = () => {
  const [fields, setFields] = useState<FieldInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchFields = async () => {
      setLoading(true)

      try {
        // Fetch a few subscribers to infer attribute fields
        const response = await subscriberService.getAll({ per_page: 20 })
        const subscribers = response.data?.results || []

        const fieldMap = new Map<string, string>()

        for (const sub of subscribers) {
          if (sub.attribs) {
            for (const [key, value] of Object.entries(sub.attribs)) {
              if (!fieldMap.has(key)) {
                const type = typeof value === 'number' ? 'NUMBER' : typeof value === 'boolean' ? 'BOOLEAN' : 'TEXT'

                fieldMap.set(key, type)
              }
            }
          }
        }

        const fieldList: FieldInfo[] = Array.from(fieldMap.entries()).map(([name, type]) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          type,
          tag: `{$${name}}`
        }))

        setFields(fieldList)
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
        <CircularProgress size={32} />
        <Typography className='ml-3' color='text.secondary'>Loading fields...</Typography>
      </div>
    )
  }

  return (
    <Card>
      <CardContent>
        <div className='flex items-center justify-between mb-4'>
          <div className='flex items-center gap-2'>
            <Checkbox size='small' />
            <Typography color='text.secondary'>Select all</Typography>
          </div>
          <Button variant='contained' color='success'>Create field</Button>
        </div>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Tag</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align='right'>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {fields.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className='text-center'>
                    <Typography color='text.secondary' className='py-4'>No custom fields found. Subscriber attributes will appear here.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                fields.map(field => (
                  <TableRow key={field.name} hover>
                    <TableCell>
                      <Typography className='font-medium'>{field.name}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography color='text.secondary'>{field.type}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant='body2'
                        sx={{
                          fontFamily: 'monospace',
                          bgcolor: 'action.hover',
                          px: 1,
                          py: 0.5,
                          borderRadius: 1,
                          display: 'inline-block'
                        }}
                      >
                        {field.tag}
                      </Typography>
                    </TableCell>
                    <TableCell align='right'>
                      <Typography color='text.secondary'>-</Typography>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  )
}

export default SubscriberFields
