// MUI Imports
import Typography from '@mui/material/Typography'
import Container from '@mui/material/Container'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'
import Box from '@mui/material/Box'

export const metadata = {
  title: 'Terms of Service - Nepal Fillings',
  description:
    'Terms of Service for Nepal Fillings Digital Marketing Platform by Marketminds Investment Group Pvt Ltd.'
}

const TermsOfServicePage = () => {
  return (
    <Container maxWidth='lg' sx={{ py: 8 }}>
      <Card>
        <CardContent sx={{ p: { xs: 4, md: 8 } }}>
          <Typography variant='h3' fontWeight='bold' gutterBottom>
            Terms of Service
          </Typography>
          <Typography variant='body2' color='text.secondary' gutterBottom>
            Last Updated: March 16, 2026
          </Typography>
          <Divider sx={{ my: 4 }} />

          <Typography variant='body1' paragraph>
            These Terms of Service (&quot;Terms&quot;) govern your access to and use of the digital marketing platform
            operated by <strong>Marketminds Investment Group Pvt Ltd</strong> (referred to as &quot;Nepal
            Fillings,&quot; &quot;Nepse Trading,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) available at{' '}
            <strong>nepalfillings.com</strong>. By accessing or using our services, you agree to be bound by these
            Terms.
          </Typography>

          <Box sx={{ mb: 4 }}>
            <Typography variant='h5' fontWeight='bold' gutterBottom sx={{ mt: 4 }}>
              1. Services Provided
            </Typography>
            <Typography variant='body1' paragraph>
              Nepal Fillings provides a multi-channel digital marketing platform including:
            </Typography>
            <Typography variant='body1' component='div'>
              <ul style={{ paddingLeft: '1.5rem', lineHeight: 2 }}>
                <li>
                  <strong>Email Marketing</strong> &mdash; Campaign creation, subscriber management, template design,
                  and bulk email delivery
                </li>
                <li>
                  <strong>SMS Marketing</strong> &mdash; Bulk SMS campaigns and contact management
                </li>
                <li>
                  <strong>Telegram Marketing</strong> &mdash; Bot-based subscriber management, campaign broadcasting,
                  and group messaging via @nepsemarket_alert_bot
                </li>
                <li>
                  <strong>WhatsApp Marketing</strong> &mdash; Business messaging and campaign delivery
                </li>
                <li>
                  <strong>Facebook Messenger Marketing</strong> &mdash; Automated messaging via Meta Messenger API
                </li>
                <li>
                  <strong>API Access</strong> &mdash; RESTful APIs for programmatic campaign management and integration
                </li>
              </ul>
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography variant='h5' fontWeight='bold' gutterBottom>
              2. Account Registration &amp; Responsibilities
            </Typography>
            <Typography variant='body1' component='div'>
              <ul style={{ paddingLeft: '1.5rem', lineHeight: 2 }}>
                <li>You must provide accurate, complete, and current information during registration</li>
                <li>You are responsible for maintaining the confidentiality of your login credentials and API keys</li>
                <li>You must notify us immediately of any unauthorized access to your account</li>
                <li>One person or entity may maintain multiple accounts, each isolated with separate data and credits</li>
                <li>You must be at least 18 years of age to use our services</li>
                <li>
                  Businesses must be registered under Nepalese law or the applicable laws of their jurisdiction
                </li>
              </ul>
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography variant='h5' fontWeight='bold' gutterBottom>
              3. Credit System &amp; Billing
            </Typography>
            <Typography variant='body1' component='div'>
              <ul style={{ paddingLeft: '1.5rem', lineHeight: 2 }}>
                <li>
                  Our platform operates on a <strong>credit-based system</strong>. Each channel (Email, SMS, Telegram,
                  WhatsApp) has its own credit balance
                </li>
                <li>Credits are deducted per message sent (1 credit = 1 message delivered)</li>
                <li>Credits are non-refundable once purchased, except as required by law</li>
                <li>Unused credits do not expire unless your account is terminated</li>
                <li>We reserve the right to adjust pricing with 30 days advance notice</li>
                <li>All payments are processed in Nepalese Rupees (NPR) unless otherwise specified</li>
              </ul>
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography variant='h5' fontWeight='bold' gutterBottom>
              4. Acceptable Use Policy
            </Typography>
            <Typography variant='body1' paragraph>
              You agree NOT to use our platform to:
            </Typography>
            <Typography variant='body1' component='div'>
              <ul style={{ paddingLeft: '1.5rem', lineHeight: 2 }}>
                <li>Send unsolicited messages (spam) to recipients who have not opted in</li>
                <li>Distribute misleading financial advice or manipulate NEPSE stock prices</li>
                <li>
                  Send content that violates Nepal&apos;s <strong>Electronic Transactions Act, 2063</strong> or any
                  other applicable law
                </li>
                <li>Distribute malware, phishing links, or fraudulent content</li>
                <li>Impersonate any person, organization, or government entity</li>
                <li>Harvest or scrape contact information without consent</li>
                <li>Circumvent sending limits, credit restrictions, or rate limits</li>
                <li>Share, resell, or redistribute API keys to unauthorized third parties</li>
                <li>
                  Send content that violates <strong>SEBON (Securities Board of Nepal)</strong> regulations regarding
                  market information dissemination
                </li>
                <li>Use the platform for illegal gambling, narcotics, or activities prohibited under Nepalese law</li>
              </ul>
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography variant='h5' fontWeight='bold' gutterBottom>
              5. Telegram Bot Terms
            </Typography>
            <Typography variant='body1' component='div'>
              <ul style={{ paddingLeft: '1.5rem', lineHeight: 2 }}>
                <li>
                  Access to the Telegram bot (@nepsemarket_alert_bot) requires a valid <strong>subscription code</strong>
                </li>
                <li>Subscription codes are issued to authorized/paid subscribers only</li>
                <li>Sharing subscription codes with unauthorized users is prohibited</li>
                <li>
                  Users can unsubscribe at any time by sending <strong>/stop</strong> to the bot
                </li>
                <li>We reserve the right to revoke access for users who violate these terms</li>
                <li>
                  Telegram bot usage is subject to{' '}
                  <strong>Telegram&apos;s Terms of Service and Bot API Terms</strong>
                </li>
              </ul>
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography variant='h5' fontWeight='bold' gutterBottom>
              6. Email Marketing Compliance
            </Typography>
            <Typography variant='body1' component='div'>
              <ul style={{ paddingLeft: '1.5rem', lineHeight: 2 }}>
                <li>All email campaigns must include a valid unsubscribe link</li>
                <li>Sender identity must be accurate and not misleading</li>
                <li>Subject lines must accurately reflect the email content</li>
                <li>You must honor unsubscribe requests within 24 hours</li>
                <li>
                  Purchased or scraped email lists are <strong>strictly prohibited</strong>
                </li>
                <li>Bounce rates exceeding 5% may result in account suspension pending review</li>
              </ul>
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography variant='h5' fontWeight='bold' gutterBottom>
              7. API Usage Terms
            </Typography>
            <Typography variant='body1' component='div'>
              <ul style={{ paddingLeft: '1.5rem', lineHeight: 2 }}>
                <li>API keys are confidential and must not be exposed in client-side code</li>
                <li>Rate limits apply to all API endpoints (detailed in API Documentation)</li>
                <li>
                  We provide API access for Email, SMS, Telegram, and WhatsApp channels with per-channel API keys
                </li>
                <li>Abuse of API endpoints may result in key revocation and account suspension</li>
                <li>We reserve the right to modify API endpoints with 14 days advance notice</li>
              </ul>
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography variant='h5' fontWeight='bold' gutterBottom>
              8. Nepal-Specific Digital Marketing Risks
            </Typography>
            <Typography variant='body1' paragraph>
              Users should be aware of the following risks specific to digital marketing in Nepal:
            </Typography>
            <Typography variant='body1' component='div'>
              <ul style={{ paddingLeft: '1.5rem', lineHeight: 2 }}>
                <li>
                  <strong>Internet Infrastructure</strong> &mdash; Nepal&apos;s internet connectivity may affect email
                  delivery rates and real-time campaign performance
                </li>
                <li>
                  <strong>SMS Gateway Limitations</strong> &mdash; Nepal Telecom and Ncell networks may impose delivery
                  delays or filtering on bulk SMS
                </li>
                <li>
                  <strong>Regulatory Changes</strong> &mdash; NTA and government regulations regarding digital
                  communications may change, potentially affecting service availability
                </li>
                <li>
                  <strong>Financial Content Regulations</strong> &mdash; SEBON and NRB may impose restrictions on
                  market-related content distribution, especially regarding NEPSE trading alerts
                </li>
                <li>
                  <strong>Data Localization</strong> &mdash; Future regulations may require data to be stored within
                  Nepal&apos;s borders
                </li>
                <li>
                  <strong>Power Outages</strong> &mdash; Load shedding may affect scheduled campaign delivery; we
                  mitigate this with redundant infrastructure
                </li>
                <li>
                  <strong>Payment Processing</strong> &mdash; Limited international payment gateway support in Nepal may
                  affect billing
                </li>
                <li>
                  <strong>Cyber Security Act</strong> &mdash; Potential upcoming cybersecurity legislation may impose
                  additional compliance requirements
                </li>
              </ul>
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography variant='h5' fontWeight='bold' gutterBottom>
              9. Intellectual Property
            </Typography>
            <Typography variant='body1' paragraph>
              All platform code, design, branding, and documentation are the intellectual property of Marketminds
              Investment Group Pvt Ltd. You retain ownership of your content (subscriber data, campaign content,
              templates you create). By using our platform, you grant us a limited license to process your content solely
              for the purpose of delivering your campaigns.
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography variant='h5' fontWeight='bold' gutterBottom>
              10. Limitation of Liability
            </Typography>
            <Typography variant='body1' component='div'>
              <ul style={{ paddingLeft: '1.5rem', lineHeight: 2 }}>
                <li>
                  We provide our services &quot;as is&quot; without warranties of any kind, express or implied
                </li>
                <li>
                  We are not liable for losses arising from email delivery failures, SMS gateway issues, Telegram API
                  downtime, or third-party service outages
                </li>
                <li>
                  Our total liability is limited to the amount of credits purchased in the preceding 12 months
                </li>
                <li>
                  We are not responsible for any financial losses resulting from NEPSE trading decisions made based on
                  alerts sent through our platform
                </li>
                <li>
                  Campaign analytics are provided for informational purposes and may not be 100% accurate due to email
                  client limitations
                </li>
              </ul>
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography variant='h5' fontWeight='bold' gutterBottom>
              11. Account Suspension &amp; Termination
            </Typography>
            <Typography variant='body1' paragraph>
              We reserve the right to suspend or terminate your account if:
            </Typography>
            <Typography variant='body1' component='div'>
              <ul style={{ paddingLeft: '1.5rem', lineHeight: 2 }}>
                <li>You violate these Terms of Service or our Acceptable Use Policy</li>
                <li>Your campaigns generate excessive spam complaints or bounce rates</li>
                <li>You engage in activities that harm our platform, reputation, or other users</li>
                <li>Required by law or government order</li>
                <li>Non-payment of outstanding invoices beyond 30 days</li>
              </ul>
            </Typography>
            <Typography variant='body1' paragraph>
              Upon termination, you may request export of your data within 30 days. After 30 days, your data will be
              permanently deleted.
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography variant='h5' fontWeight='bold' gutterBottom>
              12. Governing Law &amp; Dispute Resolution
            </Typography>
            <Typography variant='body1' component='div'>
              <ul style={{ paddingLeft: '1.5rem', lineHeight: 2 }}>
                <li>These Terms are governed by the laws of Nepal</li>
                <li>
                  Any disputes shall first be resolved through mediation, and if unresolved, through the courts of
                  Kathmandu, Nepal
                </li>
                <li>
                  Applicable laws include the <strong>Electronic Transactions Act, 2063</strong>,{' '}
                  <strong>Contract Act, 2056</strong>, and <strong>Consumer Protection Act, 2075</strong>
                </li>
              </ul>
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography variant='h5' fontWeight='bold' gutterBottom>
              13. Changes to Terms
            </Typography>
            <Typography variant='body1' paragraph>
              We may update these Terms at any time. Material changes will be communicated via email or platform
              notification at least 14 days before taking effect. Continued use of the platform after changes constitutes
              acceptance of the updated Terms.
            </Typography>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography variant='h5' fontWeight='bold' gutterBottom>
              14. Contact Information
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
            By using Nepal Fillings, you acknowledge that you have read, understood, and agree to be bound by these
            Terms of Service and our Privacy Policy.
          </Typography>
        </CardContent>
      </Card>
    </Container>
  )
}

export default TermsOfServicePage
