'use client'

// Next Imports
import Link from 'next/link'

// Third-party Imports
import classnames from 'classnames'

// Hook Imports
import useHorizontalNav from '@menu/hooks/useHorizontalNav'

// Util Imports
import { horizontalLayoutClasses } from '@layouts/utils/layoutClasses'

const FooterContent = () => {
  // Hooks
  const { isBreakpointReached } = useHorizontalNav()

  return (
    <div
      className={classnames(horizontalLayoutClasses.footerContent, 'flex items-center justify-center sm:justify-between flex-wrap gap-4')}
    >
      <p>
        <span className='text-textSecondary'>{`\u00A9 ${new Date().getFullYear()} `}</span>
        <Link href='https://nepsetrading.com' target='_blank' className='text-primary font-medium'>
          Marketminds Investment Group Pvt Ltd
        </Link>
        <span className='text-textSecondary'>{`. All rights reserved.`}</span>
      </p>
      <div className='flex gap-4 items-center'>
        <Link href='/front-pages/privacy' target='_blank' className='text-textSecondary text-sm hover:text-primary'>
          Privacy Policy
        </Link>
        <Link href='/front-pages/terms' target='_blank' className='text-textSecondary text-sm hover:text-primary'>
          Terms of Service
        </Link>
      </div>
    </div>
  )
}

export default FooterContent
