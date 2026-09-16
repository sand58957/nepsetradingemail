// Next Imports
import type { Metadata } from 'next'

// MUI Imports
import Typography from '@mui/material/Typography'
import Container from '@mui/material/Container'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'
import Box from '@mui/material/Box'

// Util Imports
import { pageMetadata } from '@/utils/seo'

export const metadata: Metadata = pageMetadata({
  path: '/privacy',
  title: 'Privacy Policy | Nepal Fillings',
  description:
    'How Marketminds Investment Group Pvt Ltd (Nepal Fillings) collects, uses and protects account, subscriber, campaign and technical data.'
})

const PrivacyPolicyPage = () => {
  return (
    <Container maxWidth='lg' sx={{ py: 8 }}>
      <Card>
        <CardContent sx={{ p: { xs: 4, md: 8 } }}>
          <Typography variant='h3' component='h1' fontWeight='bold' gutterBottom>
            Privacy Policy
          </Typography>
          <Typography variant='body2' color='text.secondary' gutterBottom>
            Last Updated: September 16, 2026
          </Typography>
          <Divider sx={{ my: 4 }} />

          <Typography variant='body1' paragraph>
            This Privacy Policy explains how <strong>Marketminds Investment Group Pvt Ltd</strong> (operating as
            &quot;Nepal Fillings&quot; and &quot;Nepse Trading&quot;) collects, uses, discloses, and safeguards your
            information when you use our digital marketing platform at <strong>nepalfillings.com</strong> and related
            services including email marketing, SMS marketing, Telegram marketing, WhatsApp marketing, and associated
            APIs.
          </Typography>

          <Box sx={{ mb: 4 }}>
            <Typography variant='h5' fontWeight='bold' gutterBottom sx={{ mt: 4 }}>
              1. Information We Collect
            </Typography>
            <Typography variant='h6' fontWeight='600' gutterBottom sx={{ mt: 2 }}>
              1.1 Account Information
            </Typography>
            <Typography variant='body1' paragraph>
              When you register, we collect your name, email address, phone number, organization name, and billing
              information necessary to provide our services.
            </Typography>

            <Typography variant='h6' fontWeight='600' gutterBottom>
              1.2 Subscriber &amp; Contact Data
            </Typography>
            <Typography variant='body1' paragraph>
              You may upload or collect subscriber lists including names, email addresses, phone numbers, Telegram Chat
              IDs, and WhatsApp numbers for your marketing campaigns. You are the data controller for this subscriber
              data, and we act as the data processor on your behalf.
            </Typography>

            <Typography variant='h6' fontWeight='600' gutterBottom>
              1.3 Campaign &amp; Usage Data
            </Typography>
            <Typography variant='body1' paragraph>
              We collect data about campaigns you create and send, including open rates, click rates, delivery status,
              bounce rates, and engagement metrics. We also collect logs of API usage, login activity, and platform
              interactions.
            </Typography>

            <Typography variant='h6' fontWeight='600' gutterBottom>
              1.4 Telegram Bot Data
            </Typography>
            <Typography variant='body1' paragraph>
              When users interact with your Telegram bot (e.g., @nepsemarket_alert_bot), we collect their Telegram Chat
              ID, username, first name, last name, and subscription status. Users must provide a valid subscription code
              to opt in.
            </Typography>

            <Typography variant='h6' fontWeight='600' gutterBottom>
              1.5 Technical Data
            </Typography>
            <Typography variant='body1' paragraph>
              We automatically collect IP addresses, browser type, device information, cookies, and access timestamps
              when you visit our platform.
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography variant='h5' fontWeight='bold' gutterBottom>
              2. How We Use Your Information
            </Typography>
            <Typography variant='body1' component='div'>
              <ul style={{ paddingLeft: '1.5rem', lineHeight: 2 }}>
                <li>To provide, maintain, and improve our digital marketing platform</li>
                <li>To process and deliver email, SMS, Telegram, and WhatsApp campaigns</li>
                <li>To manage your account, billing, and credit balances</li>
                <li>To generate campaign analytics and performance reports</li>
                <li>To authenticate API requests and prevent unauthorized access</li>
                <li>To comply with legal obligations under Nepalese law</li>
                <li>To send service-related notifications (not marketing)</li>
                <li>To detect, prevent, and address technical issues and security threats</li>
              </ul>
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography variant='h5' fontWeight='bold' gutterBottom>
              3. Data Storage &amp; Security
            </Typography>
            <Typography variant='body1' paragraph>
              Your data is stored on secured servers. We implement industry-standard security measures including:
            </Typography>
            <Typography variant='body1' component='div'>
              <ul style={{ paddingLeft: '1.5rem', lineHeight: 2 }}>
                <li>SSL/TLS encryption for all data in transit</li>
                <li>JWT-based authentication with role-based access control</li>
                <li>API keys stored only as one-way SHA-256 hashes, so a key cannot be read back after it is created</li>
              </ul>
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography variant='h5' fontWeight='bold' gutterBottom>
              4. Third-Party Services
            </Typography>
            <Typography variant='body1' paragraph>
              We use the following third-party services to deliver our platform:
            </Typography>
            <Typography variant='body1' component='div'>
              <ul style={{ paddingLeft: '1.5rem', lineHeight: 2 }}>
                <li>
                  <strong>Bunny CDN</strong> &mdash; For storing and delivering email template images
                </li>
                <li>
                  <strong>Telegram Bot API</strong> &mdash; For Telegram messaging and subscriber management
                </li>
                <li>
                  <strong>Meta/Facebook Messenger API</strong> &mdash; For Messenger marketing campaigns
                </li>
                <li>
                  <strong>Cloudflare</strong> &mdash; For DNS management, DDoS protection, and email routing
                </li>
                <li>
                  <strong>Listmonk</strong> &mdash; For email campaign processing and delivery
                </li>
                <li>
                  <strong>SendGrid</strong> &mdash; For sending email
                </li>
                <li>
                  <strong>Aakash SMS</strong> &mdash; SMS campaigns are sent through the Aakash SMS account you connect
                </li>
                <li>
                  <strong>WhatsApp</strong> &mdash; WhatsApp messages are sent from the number you link, through a
                  WhatsApp Web client that we run on our servers (not Meta&apos;s WhatsApp Business API)
                </li>
                <li>
                  <strong>Google AdSense</strong> &mdash; Shows ads on blog pages and may set cookies to serve and
                  measure them
                </li>
              </ul>
            </Typography>
            <Typography variant='body1' paragraph>
              Each third-party service has its own privacy policy. We encourage you to review them.
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography variant='h5' fontWeight='bold' gutterBottom>
              5. Nepal Digital Marketing Compliance
            </Typography>
            <Typography variant='body1' paragraph>
              Operating within Nepal&apos;s regulatory framework, we adhere to:
            </Typography>
            <Typography variant='body1' component='div'>
              <ul style={{ paddingLeft: '1.5rem', lineHeight: 2 }}>
                <li>
                  <strong>Electronic Transactions Act, 2063 (2008)</strong> &mdash; Governing electronic communications
                  and data protection in Nepal
                </li>
                <li>
                  <strong>Individual Privacy Act, 2075 (2018)</strong> &mdash; Protecting personal data and privacy
                  rights of Nepali citizens
                </li>
                <li>
                  <strong>Nepal Rastra Bank (NRB) Guidelines</strong> &mdash; For financial data handling related to
                  NEPSE market information
                </li>
                <li>
                  <strong>Nepal Telecommunications Authority (NTA) Regulations</strong> &mdash; For SMS and digital
                  communication compliance
                </li>
                <li>
                  <strong>Securities Board of Nepal (SEBON) Guidelines</strong> &mdash; For market-related content
                  dissemination
                </li>
              </ul>
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography variant='h5' fontWeight='bold' gutterBottom>
              6. Anti-Spam Policy
            </Typography>
            <Typography variant='body1' paragraph>
              We strictly prohibit the use of our platform for sending unsolicited messages. Every recipient must have
              agreed to receive your messages, and you are responsible for having that consent. In particular:
            </Typography>
            <Typography variant='body1' component='div'>
              <ul style={{ paddingLeft: '1.5rem', lineHeight: 2 }}>
                <li>Telegram contacts subscribe themselves through your bot</li>
                <li>
                  WhatsApp contacts you import are not opted in unless you confirm that they agreed, or your file says
                  so for each contact
                </li>
                <li>Messages sent through the API use prepaid credits</li>
              </ul>
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography variant='h5' fontWeight='bold' gutterBottom>
              7. Data Retention
            </Typography>
            <Typography variant='body1' paragraph>
              We retain your account data for as long as your account is active. Campaign data and analytics are
              retained for 24 months. You may request deletion of your data at any time by contacting us.
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography variant='h5' fontWeight='bold' gutterBottom>
              8. Your Rights
            </Typography>
            <Typography variant='body1' paragraph>
              You have the right to:
            </Typography>
            <Typography variant='body1' component='div'>
              <ul style={{ paddingLeft: '1.5rem', lineHeight: 2 }}>
                <li>Access your personal data stored on our platform</li>
                <li>Correct inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Export your subscriber lists and campaign data</li>
                <li>Withdraw consent for data processing</li>
                <li>Lodge complaints with relevant Nepalese authorities</li>
              </ul>
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography variant='h5' fontWeight='bold' gutterBottom>
              9. Cookies
            </Typography>
            <Typography variant='body1' paragraph>
              We use essential cookies for authentication and session management. Blog pages show ads from Google
              AdSense, which may set cookies to serve and measure those ads.
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography variant='h5' fontWeight='bold' gutterBottom>
              10. Contact Us
            </Typography>
            <Typography variant='body1' paragraph>
              If you have questions about this Privacy Policy or wish to exercise your rights:
            </Typography>
            <Typography variant='body1' component='div'>
              <ul style={{ paddingLeft: '1.5rem', lineHeight: 2 }}>
                <li>
                  <strong>Company:</strong> Marketminds Investment Group Pvt Ltd
                </li>
                <li>
                  <strong>Email:</strong> admin@nepsetrading.com
                </li>
                <li>
                  <strong>Website:</strong> https://nepalfillings.com
                </li>
                <li>
                  <strong>Domain:</strong> nepsetrading.com
                </li>
              </ul>
            </Typography>
          </Box>

          <Divider sx={{ my: 4 }} />
          <Typography variant='body2' color='text.secondary'>
            This Privacy Policy may be updated from time to time. We will notify you of any material changes by posting
            the new policy on this page and updating the &quot;Last Updated&quot; date.
          </Typography>
        </CardContent>
      </Card>
    </Container>
  )
}

export default PrivacyPolicyPage
