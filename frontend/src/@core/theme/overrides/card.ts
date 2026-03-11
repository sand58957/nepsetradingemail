// MUI Imports
import type { Theme } from '@mui/material/styles'

// Type Imports
import type { Skin } from '@core/types'

const card = (skin: Skin): Theme['components'] => {
  return {
    MuiCard: {
      defaultProps: {
        ...(skin === 'bordered' && {
          variant: 'outlined'
        })
      },
      styleOverrides: {
        root: ({ ownerState }) => ({
          ...(ownerState.variant !== 'outlined' && {
            boxShadow: 'var(--mui-customShadows-md)'
          }),
          // Premium dark mode card styling
          '[data-mui-color-scheme="dark"] &': {
            backgroundImage:
              'linear-gradient(135deg, rgba(115, 103, 240, 0.03) 0%, transparent 50%, rgba(115, 103, 240, 0.03) 100%)',
            ...(ownerState.variant !== 'outlined' && {
              border: '1px solid rgba(115, 103, 240, 0.12)',
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4), 0 0 16px rgba(115, 103, 240, 0.06)'
            })
          }
        })
      }
    },
    MuiCardHeader: {
      styleOverrides: {
        root: ({ theme }) => ({
          padding: theme.spacing(6),
          '& + .MuiCardContent-root, & + .MuiCardActions-root': {
            paddingBlockStart: 0
          },
          '& + .MuiCollapse-root .MuiCardContent-root:first-child, & + .MuiCollapse-root .MuiCardActions-root:first-child':
            {
              paddingBlockStart: 0
            }
        }),
        subheader: ({ theme }) => ({
          ...theme.typography.subtitle1,
          color: 'rgb(var(--mui-palette-text-primaryChannel) / 0.55)'
        }),
        action: ({ theme }) => ({
          ...theme.typography.body1,
          color: 'var(--mui-palette-text-disabled)',
          marginBlock: 0,
          marginInlineEnd: 0,
          '& .MuiIconButton-root': {
            color: 'inherit'
          }
        })
      }
    },
    MuiCardContent: {
      styleOverrides: {
        root: ({ theme }) => ({
          padding: theme.spacing(6),
          color: 'var(--mui-palette-text-secondary)',
          '&:last-child': {
            paddingBlockEnd: theme.spacing(6)
          },
          '& + .MuiCardHeader-root, & + .MuiCardContent-root, & + .MuiCardActions-root': {
            paddingBlockStart: 0
          },
          '& + .MuiCollapse-root .MuiCardHeader-root:first-child, & + .MuiCollapse-root .MuiCardContent-root:first-child, & + .MuiCollapse-root .MuiCardActions-root:first-child':
            {
              paddingBlockStart: 0
            }
        })
      }
    },
    MuiCardActions: {
      styleOverrides: {
        root: ({ theme }) => ({
          padding: theme.spacing(6),
          '& .MuiButtonBase-root:not(:first-of-type)': {
            marginInlineStart: theme.spacing(4)
          },
          '&:where(.card-actions-dense)': {
            padding: theme.spacing(3),
            '& .MuiButton-text': {
              paddingInline: theme.spacing(3)
            }
          },
          '& + .MuiCardHeader-root, & + .MuiCardContent-root, & + .MuiCardActions-root': {
            paddingBlockStart: 0
          },
          '& + .MuiCollapse-root .MuiCardHeader-root:first-child, & + .MuiCollapse-root .MuiCardContent-root:first-child, & + .MuiCollapse-root .MuiCardActions-root:first-child':
            {
              paddingBlockStart: 0
            }
        })
      }
    }
  }
}

export default card
