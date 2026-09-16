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

// Data Imports
import { landingFaqs as FaqsData } from '@/data/landingFaqs'

// Styles Imports
import frontCommonStyles from '@views/front-pages/styles.module.css'
import styles from './styles.module.css'

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
