// MUI Imports
import type { Theme } from '@mui/material/styles'

const tablePagination: Theme['components'] = {
  MuiTablePagination: {
    styleOverrides: {
      toolbar: ({ theme }) => ({
        paddingInlineEnd: `${theme.spacing(3)} !important`,
        [theme.breakpoints.down('sm')]: {
          flexWrap: 'wrap',
          justifyContent: 'center',
          rowGap: theme.spacing(1)
        }
      }),
      select: {
        '& ~ i, & ~ svg': {
          right: '2px !important'
        }
      }
    }
  }
}

export default tablePagination
