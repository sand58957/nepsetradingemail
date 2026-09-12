// MUI Imports
import type { Theme } from '@mui/material/styles'

const chip: Theme['components'] = {
  MuiChip: {
    styleOverrides: {
      root: ({ ownerState, theme }) => ({
        ...theme.typography.body2,
        fontWeight: theme.typography.fontWeightMedium,
        '&.MuiChip-outlined:not(.MuiChip-colorDefault)': {
          borderColor: `var(--mui-palette-${ownerState.color}-main)`
        },
        ...(ownerState.size === 'small'
          ? {
              borderRadius: 'var(--mui-shape-customBorderRadius-sm)'
            }
          : {
              borderRadius: 'var(--mui-shape-borderRadius)'
            }),

        '& .MuiChip-deleteIcon': {
          ...(ownerState.size === 'small'
            ? {
                fontSize: '1rem',
                marginInlineEnd: theme.spacing(1),
                marginInlineStart: theme.spacing(-2)
              }
            : {
                fontSize: '1.25rem',
                marginInlineEnd: theme.spacing(1.5),
                marginInlineStart: theme.spacing(-2)
              })
        },
        '& .MuiChip-avatar, & .MuiChip-icon': {
          '& i, & svg': {
            ...(ownerState.size === 'small'
              ? {
                  fontSize: 13
                }
              : {
                  fontSize: 15
                })
          },
          ...(ownerState.size === 'small'
            ? {
                blockSize: 16,
                inlineSize: 16,
                marginInlineStart: theme.spacing(1),
                marginInlineEnd: theme.spacing(-1.5)
              }
            : {
                blockSize: 20,
                inlineSize: 20,
                marginInlineStart: theme.spacing(1.5),
                marginInlineEnd: theme.spacing(-2)
              })
        },
        '&.Mui-disabled': {
          opacity: 0.45
        },
        variants: [
          {
            props: { variant: 'tonal', color: 'primary' },
            style: {
              backgroundColor: 'var(--mui-palette-primary-lightOpacity)',
              color: 'var(--mui-palette-primary-main)',
              // The brand purple on a 16% tint of itself composites to 3.79:1 over
              // the dark surface -- below the 4.5:1 this text size needs. The
              // lighter brand step gives 5.25:1. Only the dark scheme needs it; on
              // the light surface the darker brand is the readable one.
              //
              // The attribute is `data-dark`, which is what this app sets on <html>
              // at runtime. `data-mui-color-scheme` appears in the server-rendered
              // markup but is not what ends up on the live element, so selecting on
              // it silently matched nothing.
              ':where([data-dark]) &': {
                color: 'var(--mui-palette-primary-light)'
              },
              '&.Mui-focusVisible': {
                backgroundColor: 'var(--mui-palette-primary-mainOpacity)'
              },
              '& .MuiChip-deleteIcon': {
                color: 'rgb(var(--mui-palette-primary-mainChannel) / 0.7)',
                '&:hover': {
                  color: 'var(--mui-palette-primary-main)'
                }
              },
              '&.MuiChip-clickable:hover': {
                backgroundColor: 'var(--mui-palette-primary-main)',
                color: 'var(--mui-palette-common-white)'
              }
            }
          },
          {
            props: { variant: 'tonal', color: 'secondary' },
            style: {
              backgroundColor: 'var(--mui-palette-secondary-lightOpacity)',
              color: 'var(--mui-palette-secondary-main)',
              '&.Mui-focusVisible': {
                backgroundColor: 'var(--mui-palette-secondary-mainOpacity)'
              },
              '& .MuiChip-deleteIcon': {
                color: 'rgb(var(--mui-palette-secondary-mainChannel) / 0.7)',
                '&:hover': {
                  color: 'var(--mui-palette-secondary-main)'
                }
              },
              '&.MuiChip-clickable:hover': {
                backgroundColor: 'var(--mui-palette-secondary-main)',
                color: 'var(--mui-palette-common-white)'
              }
            }
          },
          {
            props: { variant: 'tonal', color: 'error' },
            style: {
              backgroundColor: 'var(--mui-palette-error-lightOpacity)',
              color: 'var(--mui-palette-error-main)',
              '&.Mui-focusVisible': {
                backgroundColor: 'var(--mui-palette-error-mainOpacity)'
              },
              '& .MuiChip-deleteIcon': {
                color: 'rgb(var(--mui-palette-error-mainChannel) / 0.7)',
                '&:hover': {
                  color: 'var(--mui-palette-error-main)'
                }
              },
              '&.MuiChip-clickable:hover': {
                backgroundColor: 'var(--mui-palette-error-main)',
                color: 'var(--mui-palette-common-white)'
              }
            }
          },
          {
            props: { variant: 'tonal', color: 'warning' },
            style: {
              backgroundColor: 'var(--mui-palette-warning-lightOpacity)',
              color: 'var(--mui-palette-warning-main)',
              '&.Mui-focusVisible': {
                backgroundColor: 'var(--mui-palette-warning-mainOpacity)'
              },
              '& .MuiChip-deleteIcon': {
                color: 'rgb(var(--mui-palette-warning-mainChannel) / 0.7)',
                '&:hover': {
                  color: 'var(--mui-palette-warning-main)'
                }
              },
              '&.MuiChip-clickable:hover': {
                backgroundColor: 'var(--mui-palette-warning-main)',
                color: 'var(--mui-palette-common-white)'
              }
            }
          },
          {
            props: { variant: 'tonal', color: 'info' },
            style: {
              backgroundColor: 'var(--mui-palette-info-lightOpacity)',
              color: 'var(--mui-palette-info-main)',
              '&.Mui-focusVisible': {
                backgroundColor: 'var(--mui-palette-info-mainOpacity)'
              },
              '& .MuiChip-deleteIcon': {
                color: 'rgb(var(--mui-palette-info-mainChannel) / 0.7)',
                '&:hover': {
                  color: 'var(--mui-palette-info-main)'
                }
              },
              '&.MuiChip-clickable:hover': {
                backgroundColor: 'var(--mui-palette-info-main)',
                color: 'var(--mui-palette-common-white)'
              }
            }
          },
          {
            props: { variant: 'tonal', color: 'success' },
            style: {
              backgroundColor: 'var(--mui-palette-success-lightOpacity)',
              color: 'var(--mui-palette-success-main)',
              '&.Mui-focusVisible': {
                backgroundColor: 'var(--mui-palette-success-mainOpacity)'
              },
              '& .MuiChip-deleteIcon': {
                color: 'rgb(var(--mui-palette-success-mainChannel) / 0.7)',
                '&:hover': {
                  color: 'var(--mui-palette-success-main)'
                }
              },
              '&.MuiChip-clickable:hover': {
                backgroundColor: 'var(--mui-palette-success-main)',
                color: 'var(--mui-palette-common-white)'
              }
            }
          }
        ]
      }),
      label: ({ ownerState, theme }) => ({
        ...(ownerState.size === 'small'
          ? {
              paddingInline: theme.spacing(2.5),
              paddingBlock: theme.spacing(0.5)
            }
          : {
              paddingInline: theme.spacing(3)
            })
      }),
      iconMedium: {
        fontSize: '1.25rem'
      },
      iconSmall: {
        fontSize: '1rem'
      }
    }
  }
}

export default chip
