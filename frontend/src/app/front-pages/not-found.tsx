// Next Imports
import Link from 'next/link'

// MUI Imports
import Typography from '@mui/material/Typography'
import Container from '@mui/material/Container'

// Renders for unknown marketing and blog URLs. There was no boundary here, so they
// got the framework's bare "This page could not be found" with no way onward.
export default function FrontPagesNotFound() {
  return (
    <Container maxWidth='sm' sx={{ pt: 20, pb: 12, textAlign: 'center' }}>
      <Typography variant='h3' component='h1' fontWeight='bold' gutterBottom>
        Page not found
      </Typography>
      <Typography variant='body1' paragraph>
        The page you asked for doesn&apos;t exist, or it has moved.
      </Typography>
      <nav aria-label='Where to go next'>
        <Typography variant='body1' component='p'>
          <Link href='/'>Home</Link> · <Link href='/pricing'>Pricing</Link> · <Link href='/blog'>Blog</Link> ·{' '}
          <Link href='/about'>About</Link> · <Link href='/#contact-us'>Contact us</Link>
        </Typography>
      </nav>
    </Container>
  )
}
