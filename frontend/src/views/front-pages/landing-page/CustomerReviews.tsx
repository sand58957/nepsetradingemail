// MUI Imports
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Rating from '@mui/material/Rating'
import Divider from '@mui/material/Divider'
// import { useColorScheme } from '@mui/material/styles'

// Third-party Imports
import { useKeenSlider } from 'keen-slider/react'
import classnames from 'classnames'

// Component Imports
import CustomIconButton from '@core/components/mui/IconButton'
import CustomAvatar from '@core/components/mui/Avatar'

// Styled Component Imports
import AppKeenSlider from '@/libs/styles/AppKeenSlider'

// Styles Imports
import frontCommonStyles from '@views/front-pages/styles.module.css'
import styles from './styles.module.css'

// Company Logo Component
const CompanyLogo = ({ src, alt }: { src: string; alt: string }) => (
  <img src={src} alt={alt} style={{ height: 40, maxWidth: 140, objectFit: 'contain' }} />
)

// Data - Nepali Companies
const data = [
  {
    desc: 'Nepal Fillings has completely transformed our email marketing. We can now reach thousands of customers across Nepal with a single campaign. The delivery rates are outstanding!',
    logo: '/images/front-pages/landing-page/reviews/daraz_official.png',
    company: 'Daraz',
    rating: 5,
    name: 'Rajesh Sharma',
    position: 'Marketing Head, Daraz Nepal',
    avatarSrc: '/images/avatars/1.png'
  },
  {
    desc: 'The Telegram marketing feature is a game-changer for our food delivery alerts. Our customers love getting instant notifications about offers and deals directly on Telegram.',
    logo: '/images/front-pages/landing-page/reviews/foodmandu_official.png',
    company: 'Foodmandu',
    rating: 5,
    name: 'Srijana Thapa',
    position: 'CEO, Foodmandu',
    avatarSrc: '/images/avatars/2.png'
  },
  {
    desc: 'We switched from manual WhatsApp messaging to Nepal Fillings and our engagement rate doubled. The bulk SMS feature helps us reach customers even in remote areas of Nepal.',
    logo: '/images/front-pages/landing-page/reviews/bhojdeal_official.png',
    company: 'Bhoj Deal',
    rating: 5,
    name: 'Ankit Paudel',
    position: 'Founder, Bhoj Deal',
    avatarSrc: '/images/avatars/3.png'
  },
  {
    desc: 'As a beauty brand, visual email campaigns are essential. Nepal Fillings makes it easy to design stunning emails with their template gallery. Our sales increased by 40% after using their platform.',
    logo: '/images/front-pages/landing-page/reviews/foreveryng_official.svg',
    company: 'Foreveryng',
    rating: 5,
    name: 'Priya Karki',
    position: 'Digital Manager, Foreveryng',
    avatarSrc: '/images/avatars/4.png'
  },
  {
    desc: 'The API integration is incredibly easy. We automated our order confirmation messages through SMS and email — all from one dashboard. Best digital marketing tool made for Nepal!',
    logo: '/images/front-pages/landing-page/reviews/ultima.svg',
    company: 'Ultima Lifestyle',
    rating: 4,
    name: 'Bikash Adhikari',
    position: 'CTO, Ultima Lifestyle',
    avatarSrc: '/images/avatars/5.png'
  },
  {
    desc: 'Nepal Fillings helped us streamline our admission notifications. We send bulk SMS and email updates to thousands of students. The platform is reliable and affordable for educational institutions.',
    logo: '/images/front-pages/landing-page/reviews/ioe_official.png',
    company: 'IOE Pulchowk',
    rating: 5,
    name: 'Dr. Ram Prasad',
    position: 'Admin, IOE Pulchowk',
    avatarSrc: '/images/avatars/6.png'
  },
  {
    desc: 'Our institute uses Nepal Fillings for sending class schedules, exam notices, and fee reminders via SMS and Telegram. Students find it very convenient. Highly recommended!',
    logo: '/images/front-pages/landing-page/reviews/name.svg',
    company: 'NAME Institute',
    rating: 5,
    name: 'Suresh Maharjan',
    position: 'Director, NAME Institute',
    avatarSrc: '/images/avatars/7.png'
  },
  {
    desc: 'Payment confirmation emails and SMS reminders have become effortless with Nepal Fillings. The multi-channel approach ensures our users never miss important payment deadlines.',
    logo: '/images/front-pages/landing-page/reviews/neb_official.png',
    company: 'NEB Payment',
    rating: 5,
    name: 'Kumari Shrestha',
    position: 'IT Head, NEB Payment',
    avatarSrc: '/images/avatars/8.png'
  },
  {
    desc: 'As the stock exchange platform, we need instant market alerts. Nepal Fillings Telegram bot integration lets us push real-time NEPSE updates to thousands of traders simultaneously.',
    logo: '/images/front-pages/landing-page/reviews/tms.svg',
    company: 'TMS (NEPSE)',
    rating: 5,
    name: 'Dipak Gurung',
    position: 'Tech Lead, TMS',
    avatarSrc: '/images/avatars/9.png'
  },
  {
    desc: 'We use Nepal Fillings for flight booking confirmations, delay notifications, and promotional campaigns. The WhatsApp integration has improved our customer satisfaction significantly.',
    logo: '/images/front-pages/landing-page/reviews/nepalair_official.png',
    company: 'Nepal Airlines',
    rating: 4,
    name: 'Captain Binod KC',
    position: 'Marketing, Nepal Airlines',
    avatarSrc: '/images/avatars/10.png'
  },
  {
    desc: 'Nepal Fillings has been instrumental in our policyholder communication. Automated SMS and email reminders for premium payments have reduced our lapse rate by 35%. A must-have for insurance companies!',
    logo: '/images/front-pages/landing-page/reviews/nepallife_official.png',
    company: 'Nepal Life Insurance',
    rating: 5,
    name: 'Hari Bahadur KC',
    position: 'IT Director, Nepal Life Insurance',
    avatarSrc: '/images/avatars/1.png'
  },
  {
    desc: 'As a global brand operating in Nepal, we needed a reliable local platform for customer engagement. Nepal Fillings delivers professional email campaigns with excellent tracking and analytics.',
    logo: '/images/front-pages/landing-page/reviews/metlife_official.png',
    company: 'MetLife Nepal',
    rating: 5,
    name: 'Anil Joshi',
    position: 'Digital Lead, MetLife Nepal',
    avatarSrc: '/images/avatars/3.png'
  },
  {
    desc: 'Bulk SMS campaigns for festival greetings and new product launches have become effortless with Nepal Fillings. The Telegram bot feature helps us share insurance tips with our subscriber community.',
    logo: '/images/front-pages/landing-page/reviews/asianlife_official.png',
    company: 'Asian Life Insurance',
    rating: 4,
    name: 'Binita Rana',
    position: 'VP Marketing, Asian Life',
    avatarSrc: '/images/avatars/4.png'
  }
]


const CustomerReviews = () => {

  const [sliderRef, instanceRef] = useKeenSlider<HTMLDivElement>(
    {
      loop: true,
      slides: {
        perView: 3,
        origin: 'auto'
      },
      breakpoints: {
        '(max-width: 1200px)': {
          slides: {
            perView: 2,
            spacing: 10,
            origin: 'auto'
          }
        },
        '(max-width: 900px)': {
          slides: {
            perView: 2,
            spacing: 10
          }
        },
        '(max-width: 600px)': {
          slides: {
            perView: 1,
            spacing: 10,
            origin: 'center'
          }
        }
      }
    },
    [
      slider => {
        let timeout: ReturnType<typeof setTimeout>
        const mouseOver = false

        function clearNextTimeout() {
          clearTimeout(timeout)
        }

        function nextTimeout() {
          clearTimeout(timeout)
          if (mouseOver) return
          timeout = setTimeout(() => {
            slider.next()
          }, 2000)
        }

        slider.on('created', nextTimeout)
        slider.on('dragStarted', clearNextTimeout)
        slider.on('animationEnded', nextTimeout)
        slider.on('updated', nextTimeout)
      }
    ]
  )

  return (
    <section className={classnames('flex flex-col gap-6 plb-[40px] bg-backgroundDefault', styles.sectionStartRadius)}>
      <div
        className={classnames('flex max-md:flex-col max-sm:flex-wrap is-full gap-6', frontCommonStyles.layoutSpacing)}
      >
        <div className='flex flex-col gap-1 bs-full justify-center items-center lg:items-start is-full md:is-[30%] mlb-auto sm:pbs-2'>
          <Chip label='Real Customers Reviews' variant='tonal' color='primary' size='small' className='mbe-3' />
          <div className='flex flex-col gap-y-1 flex-wrap max-lg:text-center '>
            <Typography color='text.primary' variant='h4'>
              <span className='relative z-[1] font-extrabold'>
                What people say
                <img
                  src='/images/front-pages/landing-page/bg-shape.png'
                  alt='bg-shape'
                  className='absolute block-end-0 z-[1] bs-[40%] is-[132%] inline-start-[-8%] block-start-[17px]'
                />
              </span>
            </Typography>
            <Typography>See what our customers have to say about their experience.</Typography>
          </div>
          <div className='flex gap-x-4 mbs-11'>
            <CustomIconButton color='primary' variant='tonal' onClick={() => instanceRef.current?.prev()}>
              <i className='tabler-chevron-left' />
            </CustomIconButton>
            <CustomIconButton color='primary' variant='tonal' onClick={() => instanceRef.current?.next()}>
              <i className='tabler-chevron-right' />
            </CustomIconButton>
          </div>
        </div>
        <div className='is-full md:is-[70%]'>
          <AppKeenSlider>
            <div ref={sliderRef} className='keen-slider mbe-6'>
              {data.map((item, index) => (
                <div key={index} className='keen-slider__slide flex p-4 sm:p-3'>
                  <Card elevation={8} className='flex items-start'>
                    <CardContent className='p-8 items-center mlb-auto'>
                      <div className='flex flex-col gap-4 items-start'>
                        <CompanyLogo src={item.logo} alt={item.company} />
                        <Typography>{item.desc}</Typography>
                        <Rating value={item.rating} readOnly />
                        <div className='flex flex-col items-start'>
                          <Typography color='text.primary' className='font-medium'>
                            {item.name}
                          </Typography>
                          <Typography variant='body2' color='text.disabled'>
                            {item.position}
                          </Typography>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </AppKeenSlider>
        </div>
      </div>
      <Divider />
      <div className='flex flex-wrap items-center justify-center gap-x-8 gap-y-5 mli-3 pbs-4'>
        {[
          { src: '/images/front-pages/landing-page/reviews/daraz_official.png', alt: 'Daraz' },
          { src: '/images/front-pages/landing-page/reviews/foodmandu_official.png', alt: 'Foodmandu' },
          { src: '/images/front-pages/landing-page/reviews/bhojdeal_official.png', alt: 'Bhoj Deal' },
          { src: '/images/front-pages/landing-page/reviews/foreveryng_official.svg', alt: 'Foreveryng' },
          { src: '/images/front-pages/landing-page/reviews/ioe_official.png', alt: 'IOE Pulchowk' },
          { src: '/images/front-pages/landing-page/reviews/nepalair_official.png', alt: 'Nepal Airlines' },
          { src: '/images/front-pages/landing-page/reviews/nepallife_official.png', alt: 'Nepal Life Insurance' },
          { src: '/images/front-pages/landing-page/reviews/asianlife_official.png', alt: 'Asian Life Insurance' }
        ].map((item, index) => (
          <img
            key={index}
            src={item.src}
            alt={item.alt}
            style={{
              height: 44,
              maxWidth: 150,
              objectFit: 'contain'
            }}
          />
        ))}
      </div>
    </section>
  )
}

export default CustomerReviews
