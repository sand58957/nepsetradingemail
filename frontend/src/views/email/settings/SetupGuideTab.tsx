'use client'

// MUI Imports
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'

const SetupGuideTab = () => {
  return (
    <Grid container spacing={6}>
      {/* Header */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardContent>
            <div className='flex items-center gap-3'>
              <i className='tabler-mail text-[32px] text-primary' />
              <div>
                <Typography variant='h5'>Email Marketing Setup Guide</Typography>
                <Typography variant='body2' color='text.secondary'>
                  Follow these steps to set up and start sending email campaigns with Listmonk
                </Typography>
              </div>
            </div>
          </CardContent>
        </Card>
      </Grid>

      {/* Getting Started */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Card>
          <CardHeader title='Getting Started' subheader='Initial configuration for email marketing' />
          <CardContent>
            <div className='flex flex-col gap-4'>
              <Alert severity='info' icon={<i className='tabler-info-circle' />}>
                Email marketing is powered by Listmonk, a self-hosted newsletter and mailing list manager.
              </Alert>

              <Typography variant='subtitle2' color='primary'>Step 1: Set Up Company Profile</Typography>
              <Typography variant='body2' color='text.secondary'>
                Go to the <strong>&ldquo;Company Profile&rdquo;</strong> tab &rarr; Fill in your company name, address, and contact details. This information appears in the footer of every email (required by{' '}
                <a href='https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business' target='_blank' rel='noopener noreferrer' style={{ color: '#1976d2' }}>
                  CAN-SPAM Act
                </a>
                ).
              </Typography>

              <Divider />

              <Typography variant='subtitle2' color='primary'>Step 2: Configure Default Settings</Typography>
              <Typography variant='body2' color='text.secondary'>
                Go to the <strong>&ldquo;Default Settings&rdquo;</strong> tab &rarr; Set your default <strong>From Name</strong> and <strong>From Email</strong> &rarr; Upload your company <strong>logo</strong> &rarr; Set brand colors. These defaults are used when creating new campaigns.
              </Typography>

              <Divider />

              <Typography variant='subtitle2' color='primary'>Step 3: Add &amp; Verify Your Domain</Typography>
              <Typography variant='body2' color='text.secondary'>
                Go to the <strong>&ldquo;Domains&rdquo;</strong> tab &rarr; Click <strong>&ldquo;Add Domain&rdquo;</strong> &rarr; Enter your sending domain (e.g. <code>yourdomain.com</code>). You&apos;ll need to add DNS records for authentication:
              </Typography>
              <Typography variant='body2' color='text.secondary' component='div'>
                <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                  <li><strong>SPF Record</strong> &mdash; Authorizes your email server to send on behalf of your domain. Add a TXT record: <code>v=spf1 include:sendgrid.net ~all</code></li>
                  <li><strong>DKIM Record</strong> &mdash; Adds a digital signature to verify emails aren&apos;t tampered with. Add the provided CNAME records.</li>
                  <li><strong>DMARC Record</strong> &mdash; Tells receiving servers how to handle unauthenticated emails. Add TXT record: <code>v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com</code></li>
                </ul>
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                Learn more about email authentication:{' '}
                <a href='https://www.cloudflare.com/learning/dns/dns-records/dns-spf-record/' target='_blank' rel='noopener noreferrer' style={{ color: '#1976d2' }}>
                  SPF Guide
                </a>
                {' | '}
                <a href='https://www.cloudflare.com/learning/dns/dns-records/dns-dkim-record/' target='_blank' rel='noopener noreferrer' style={{ color: '#1976d2' }}>
                  DKIM Guide
                </a>
                {' | '}
                <a href='https://www.cloudflare.com/learning/dns/dns-records/dns-dmarc-record/' target='_blank' rel='noopener noreferrer' style={{ color: '#1976d2' }}>
                  DMARC Guide
                </a>
              </Typography>

              <Divider />

              <Typography variant='subtitle2' color='primary'>Step 4: Choose an Email Provider (SMTP)</Typography>
              <Typography variant='body2' color='text.secondary'>
                You need an SMTP provider to actually deliver emails. Popular options:
              </Typography>
              <Typography variant='body2' color='text.secondary' component='div'>
                <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                  <li>
                    <strong>SendGrid</strong> &mdash;{' '}
                    <a href='https://signup.sendgrid.com/' target='_blank' rel='noopener noreferrer' style={{ color: '#1976d2' }}>
                      signup.sendgrid.com
                    </a>
                    {' '}&mdash; 100 free emails/day. Go to{' '}
                    <a href='https://app.sendgrid.com/settings/api_keys' target='_blank' rel='noopener noreferrer' style={{ color: '#1976d2' }}>
                      Settings &rarr; API Keys
                    </a>
                    {' '}&rarr; Create API Key &rarr; Use <code>apikey</code> as username and the key as password.
                  </li>
                  <li>
                    <strong>Amazon SES</strong> &mdash;{' '}
                    <a href='https://aws.amazon.com/ses/' target='_blank' rel='noopener noreferrer' style={{ color: '#1976d2' }}>
                      aws.amazon.com/ses
                    </a>
                    {' '}&mdash; Very low cost ($0.10 per 1,000 emails). Set up in{' '}
                    <a href='https://console.aws.amazon.com/ses/' target='_blank' rel='noopener noreferrer' style={{ color: '#1976d2' }}>
                      AWS SES Console
                    </a>
                    .
                  </li>
                  <li>
                    <strong>Mailgun</strong> &mdash;{' '}
                    <a href='https://signup.mailgun.com/new/signup' target='_blank' rel='noopener noreferrer' style={{ color: '#1976d2' }}>
                      mailgun.com
                    </a>
                    {' '}&mdash; 5,000 free emails for 3 months.
                  </li>
                  <li>
                    <strong>Postmark</strong> &mdash;{' '}
                    <a href='https://postmarkapp.com/' target='_blank' rel='noopener noreferrer' style={{ color: '#1976d2' }}>
                      postmarkapp.com
                    </a>
                    {' '}&mdash; Great deliverability, 100 free emails/month.
                  </li>
                </ul>
              </Typography>

              <Divider />

              <Alert severity='warning' icon={<i className='tabler-alert-triangle' />}>
                <Typography variant='caption'>
                  <strong>Important:</strong> Always verify your sending domain with SPF, DKIM, and DMARC records before sending campaigns. Emails from unverified domains are likely to end up in spam folders.
                </Typography>
              </Alert>
            </div>
          </CardContent>
        </Card>
      </Grid>

      {/* Campaign & Lists Guide */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Card>
          <CardHeader title='Campaigns & Subscriber Lists' subheader='How to manage contacts and send campaigns' />
          <CardContent>
            <div className='flex flex-col gap-4'>
              <Typography variant='subtitle2' color='primary'>Step 5: Create Subscriber Lists</Typography>
              <Typography variant='body2' color='text.secondary'>
                Go to <strong>Email Marketing &rarr; Subscribers</strong> &rarr; Click <strong>&ldquo;Manage Lists&rdquo;</strong> &rarr; Create lists like &ldquo;Newsletter&rdquo;, &ldquo;Promotions&rdquo;, or &ldquo;Product Updates&rdquo;. Lists help you segment your audience for targeted campaigns.
              </Typography>

              <Divider />

              <Typography variant='subtitle2' color='primary'>Step 6: Import or Add Subscribers</Typography>
              <Typography variant='body2' color='text.secondary'>
                You can add subscribers in multiple ways:
              </Typography>
              <Typography variant='body2' color='text.secondary' component='div'>
                <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                  <li><strong>Manual</strong> &mdash; Add individual subscribers from the Subscribers page</li>
                  <li><strong>CSV Import</strong> &mdash; Bulk import from a CSV file with columns: email, name, lists</li>
                  <li><strong>Signup Forms</strong> &mdash; Embed opt-in forms on your website using the provided HTML snippet</li>
                  <li><strong>API</strong> &mdash; Use the{' '}
                    <a href='https://listmonk.app/docs/apis/subscribers/' target='_blank' rel='noopener noreferrer' style={{ color: '#1976d2' }}>
                      Listmonk Subscriber API
                    </a>
                    {' '}to programmatically add contacts
                  </li>
                </ul>
              </Typography>

              <Divider />

              <Typography variant='subtitle2' color='primary'>Step 7: Design Email Templates</Typography>
              <Typography variant='body2' color='text.secondary'>
                Go to <strong>Email Marketing &rarr; Templates</strong> &rarr; Browse pre-built templates or create your own using the drag-and-drop editor. Templates support:
              </Typography>
              <Typography variant='body2' color='text.secondary' component='div'>
                <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                  <li><strong>Personalization</strong> &mdash; Use variables like <code>{'{{.Subscriber.Name}}'}</code> and <code>{'{{.Subscriber.Email}}'}</code></li>
                  <li><strong>Dynamic Content</strong> &mdash; Show/hide blocks based on subscriber attributes</li>
                  <li><strong>Responsive Design</strong> &mdash; Templates automatically adapt to mobile devices</li>
                </ul>
              </Typography>

              <Divider />

              <Typography variant='subtitle2' color='primary'>Step 8: Create &amp; Send a Campaign</Typography>
              <Typography variant='body2' color='text.secondary'>
                Go to <strong>Email Marketing &rarr; Campaigns &rarr; Create Campaign</strong> &rarr; Fill in:
              </Typography>
              <Typography variant='body2' color='text.secondary' component='div'>
                <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                  <li><strong>Subject Line</strong> &mdash; Keep it under 60 characters for best open rates</li>
                  <li><strong>From Name &amp; Email</strong> &mdash; Uses your defaults unless overridden</li>
                  <li><strong>Content</strong> &mdash; Choose a template or write custom HTML</li>
                  <li><strong>Target Lists</strong> &mdash; Select which subscriber lists to send to</li>
                  <li><strong>Schedule</strong> &mdash; Send immediately or schedule for a specific date/time</li>
                </ul>
              </Typography>

              <Divider />

              <Typography variant='subtitle2' color='primary'>Step 9: Track &amp; Analyze</Typography>
              <Typography variant='body2' color='text.secondary'>
                After sending, go to <strong>Email Marketing &rarr; Campaigns</strong> to view:
              </Typography>
              <Typography variant='body2' color='text.secondary' component='div'>
                <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                  <li><strong>Open Rate</strong> &mdash; % of recipients who opened the email</li>
                  <li><strong>Click Rate</strong> &mdash; % who clicked links (requires Link Tracking enabled)</li>
                  <li><strong>Bounce Rate</strong> &mdash; Failed deliveries</li>
                  <li><strong>Unsubscribe Rate</strong> &mdash; Recipients who opted out</li>
                </ul>
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                Enable link tracking in the <strong>&ldquo;Link Tracking&rdquo;</strong> tab to monitor click-through rates.
              </Typography>

              <Divider />

              <Typography variant='subtitle2' color='primary'>Step 10: Set Up E-commerce Tracking (Optional)</Typography>
              <Typography variant='body2' color='text.secondary'>
                Go to the <strong>&ldquo;E-commerce Integration&rdquo;</strong> tab to connect your online store. Track revenue generated from email campaigns, abandoned cart recovery, and product recommendation emails.
              </Typography>

              <Divider />

              <Alert severity='info' variant='outlined' sx={{ py: 0.5 }}>
                <Typography variant='caption'>
                  <strong>Listmonk Docs:</strong>{' '}
                  <a href='https://listmonk.app/docs/' target='_blank' rel='noopener noreferrer' style={{ color: '#1976d2' }}>
                    listmonk.app/docs
                  </a>
                  {' | '}
                  <strong>Email Best Practices:</strong>{' '}
                  <a href='https://www.mailgun.com/blog/deliverability/email-best-practices/' target='_blank' rel='noopener noreferrer' style={{ color: '#1976d2' }}>
                    Email Deliverability Guide
                  </a>
                </Typography>
              </Alert>
            </div>
          </CardContent>
        </Card>
      </Grid>

      {/* Best Practices */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader title='Email Marketing Best Practices' />
          <CardContent>
            <Grid container spacing={4}>
              <Grid size={{ xs: 12, md: 4 }}>
                <Alert severity='success' icon={<i className='tabler-check' />} sx={{ height: '100%' }}>
                  <Typography variant='subtitle2' gutterBottom>Deliverability Tips</Typography>
                  <Typography variant='caption' component='div'>
                    &bull; Always authenticate your domain (SPF + DKIM + DMARC)<br />
                    &bull; Use a consistent &ldquo;From&rdquo; address<br />
                    &bull; Include a physical mailing address<br />
                    &bull; Make unsubscribe link easy to find<br />
                    &bull; Warm up new sending domains gradually
                  </Typography>
                </Alert>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Alert severity='info' icon={<i className='tabler-bulb' />} sx={{ height: '100%' }}>
                  <Typography variant='subtitle2' gutterBottom>Content Tips</Typography>
                  <Typography variant='caption' component='div'>
                    &bull; Keep subject lines under 60 characters<br />
                    &bull; Personalize with subscriber name<br />
                    &bull; Use a clear call-to-action (CTA)<br />
                    &bull; Test emails before sending (preview)<br />
                    &bull; Optimize images for fast loading
                  </Typography>
                </Alert>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Alert severity='warning' icon={<i className='tabler-alert-triangle' />} sx={{ height: '100%' }}>
                  <Typography variant='subtitle2' gutterBottom>Avoid These Mistakes</Typography>
                  <Typography variant='caption' component='div'>
                    &bull; Never buy email lists &mdash; use opt-in only<br />
                    &bull; Don&apos;t send without testing first<br />
                    &bull; Avoid spam trigger words in subject lines<br />
                    &bull; Don&apos;t send too frequently (1-4x/month is ideal)<br />
                    &bull; Never ignore bounce/unsubscribe data
                  </Typography>
                </Alert>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}

export default SetupGuideTab
