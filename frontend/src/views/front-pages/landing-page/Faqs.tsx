// React Imports
import { useEffect, useRef } from 'react'

// MUI Imports
import Typography from '@mui/material/Typography'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import Grid from '@mui/material/Grid'
import Chip from '@mui/material/Chip'

// Third-party Imports
import classnames from 'classnames'

// Hook Imports
import { useIntersection } from '@/hooks/useIntersection'

// Styles Imports
import frontCommonStyles from '@views/front-pages/styles.module.css'
import styles from './styles.module.css'

type FaqsDataTypes = {
  id: string
  question: string
  active?: boolean
  answer: string
}

const FaqsData: FaqsDataTypes[] = [
  {
    id: 'panel1',
    question: 'What is Nepal Fillings and how does it help my business?',
    active: true,
    answer:
      'Nepal Fillings is an all-in-one digital marketing platform built for businesses in Nepal. It enables you to send bulk emails, Telegram messages, SMS, WhatsApp messages, and Facebook Messenger campaigns — all from a single dashboard. Whether you are a startup, SME, or enterprise, Nepal Fillings helps you reach your customers across multiple channels, track engagement with real-time analytics, and grow your business with powerful automation tools.'
  },
  {
    id: 'panel2',
    question: 'Which marketing channels does Nepal Fillings support?',
    answer:
      'Nepal Fillings supports 5 powerful marketing channels: Email Marketing (unlimited bulk emails with drag-and-drop template builder), Telegram Marketing (bot-based subscriber messaging), SMS Marketing (bulk SMS to any Nepal mobile number), WhatsApp Marketing (business messaging through WhatsApp API), and Facebook Messenger Marketing (engage customers via Messenger). You can use any combination of these channels depending on your subscription plan.'
  },
  {
    id: 'panel3',
    question: 'How much does Nepal Fillings cost? Are there free trials?',
    answer:
      'Start free with up to 500 subscribers — no card required. Paid plans are priced by how many subscribers you have, so the cost grows only as your audience does, and paying yearly saves up to 15%. Use the slider in the pricing section above to see the exact price for your list size, or contact us if you need more than 200,000 subscribers.'
  },
  {
    id: 'panel4',
    question: 'Can I send bulk SMS to customers across Nepal?',
    answer:
      'Yes — you can send bulk SMS to any mobile number in Nepal, including NTC, Ncell and Smart Cell networks. SMS suits time-sensitive promotions, payment reminders, OTP verification and reaching customers where internet access is limited. Every campaign comes with delivery reports, scheduling and contact segmentation.'
  },
  {
    id: 'panel5',
    question: 'Is Nepal Fillings suitable for small businesses in Nepal?',
    answer:
      'Yes — from local shops and restaurants to schools and large enterprises. You can start free with up to 500 subscribers and move to a paid plan only when your list outgrows it, so there is nothing to commit up front. Businesses in Kathmandu, Pokhara, Chitwan and across Nepal use the platform to grow through email and Telegram marketing.'
  },
  {
    id: 'panel6',
    question: 'How do I integrate Nepal Fillings with my existing website or app?',
    answer:
      'A REST API lets you send email, SMS, Telegram and other channels straight from your website, mobile app or CRM. The documentation includes examples in Python, JavaScript, PHP and Go, and support can help you wire up automated flows such as order confirmations, welcome emails and payment notifications.'
  },
  {
    id: 'panel7',
    question: 'What payment methods do you accept?',
    answer:
      'We accept all major payment methods popular in Nepal including eSewa, Khalti, ConnectIPS, IME Pay, FonePay, PrabhuPay, and bank transfers from NMB Bank, Civil Bank, Laxmi Sunrise Bank, and Citizens Bank. We also accept international payments via Visa, Mastercard, UnionPay, and PayPal for businesses operating outside Nepal.'
  },
  {
    id: 'panel8',
    question: 'How does Telegram marketing work on Nepal Fillings?',
    answer:
      'Telegram marketing on Nepal Fillings works through a bot-based subscription system. You create a Telegram bot, connect it to your Nepal Fillings account, and share a subscription link with your audience. When users subscribe through your bot, they are added to your contact list. You can then send broadcast messages, promotional content, and updates to all subscribers or specific groups directly from the Nepal Fillings dashboard — no coding required.'
  }
]

const Faqs = () => {
  // Refs
  const skipIntersection = useRef(true)
  const ref = useRef<null | HTMLDivElement>(null)

  // Hooks
  const { updateIntersections } = useIntersection()

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (skipIntersection.current) {
          skipIntersection.current = false

          return
        }

        updateIntersections({ [entry.target.id]: entry.isIntersecting })
      },
      { threshold: 0.35 }
    )

    ref.current && observer.observe(ref.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section id='faq' ref={ref} className={classnames('plb-[100px] bg-backgroundDefault', styles.sectionStartRadius)}>
      <div className={classnames('flex flex-col gap-16', frontCommonStyles.layoutSpacing)}>
        <div className='flex flex-col gap-y-4 items-center justify-center'>
          <Chip size='small' variant='tonal' color='primary' label='FAQ' />
          <div className='flex flex-col items-center gap-y-1 justify-center flex-wrap'>
            <div className='flex items-center gap-x-2'>
              <Typography color='text.primary' variant='h4' component='h2'>
                Frequently asked
                <span className='relative z-[1] font-extrabold'>
                  <img
                    src='/images/front-pages/landing-page/bg-shape.webp'
                    alt='bg-shape'
                    className='absolute block-end-0 z-[1] bs-[40%] is-[132%] -inline-start-[8%] block-start-[17px]'
                  />{' '}
                  questions
                </span>
              </Typography>
            </div>
            <Typography className='text-center'>
              Browse through these FAQs to find answers to commonly asked questions.
            </Typography>
          </div>
        </div>
        <div>
          <Grid container spacing={6}>
            <Grid size={{ xs: 12, lg: 5 }} className='text-center'>
              <img
                src='/images/front-pages/landing-page/boy-sitting-with-laptop.webp'
                alt='boy with laptop'
                width={660}
                height={601}
                loading='lazy'
                decoding='async'
                className='is-[80%] max-is-[320px]'
                style={{ height: 'auto' }}
              />
            </Grid>
            <Grid size={{ xs: 12, lg: 7 }}>
              <div>
                {FaqsData.map((data, index) => {
                  return (
                    <Accordion key={index} defaultExpanded={data.active}>
                      <AccordionSummary
                        aria-controls={data.id + '-content'}
                        id={data.id + '-header'}
                        className='font-medium'
                        color='text.primary'
                      >
                        <Typography component='span'>{data.question}</Typography>
                      </AccordionSummary>
                      <AccordionDetails className='text-textSecondary'>{data.answer}</AccordionDetails>
                    </Accordion>
                  )
                })}
              </div>
            </Grid>
          </Grid>
        </div>
      </div>
    </section>
  )
}

export default Faqs
