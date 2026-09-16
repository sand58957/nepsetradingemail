// The homepage FAQ. Both the visible accordion and the FAQPage structured data
// read from this list, so the two can't say different things. They used to:
// the JSON-LD named different banks and networks than the page did.
//
// Every answer describes what the product does today. Before adding a claim
// here (a network, a payment method, a statistic), check it against the code
// or a record the business can show.

export type LandingFaq = {
  id: string
  question: string
  answer: string
  active?: boolean
}

export const landingFaqs: LandingFaq[] = [
  {
    id: 'panel1',
    question: 'What is Nepal Fillings and how does it help my business?',
    active: true,
    answer:
      'Nepal Fillings is a dashboard for sending email, SMS, WhatsApp, Telegram and Facebook Messenger campaigns to customers in Nepal. You manage your contacts, send campaigns and check campaign reports for each channel from one login.'
  },
  {
    id: 'panel2',
    question: 'Which marketing channels does Nepal Fillings support?',
    answer:
      "Five: email, SMS, WhatsApp, Telegram and Facebook Messenger. SMS is sent through your own Aakash SMS account. WhatsApp messages go out from a WhatsApp number you link by scanning a QR code, which is not Meta's official WhatsApp Business API. Telegram works through your own bot, and Messenger through your Facebook Page. Which channels you can use depends on your plan."
  },
  {
    id: 'panel3',
    question: 'How much does Nepal Fillings cost? Is there a free plan?',
    answer:
      'You can start free with up to 500 subscribers and 12,000 emails a month, with no card required. The Growing Business and Advanced plans are priced by your subscriber count and billed monthly, or yearly for up to 15% less. Enterprise pricing, for more than 200,000 subscribers, is agreed with our team. SMS messages are paid for through your own Aakash SMS account.'
  },
  {
    id: 'panel4',
    question: 'Is WhatsApp on Nepal Fillings the official WhatsApp Business API?',
    answer:
      "No. You link a WhatsApp number by scanning a QR code, and messages are sent from that number through a WhatsApp Web connection that Nepal Fillings runs. It is not Meta's WhatsApp Business API, so there is no template approval or verified badge. WhatsApp can restrict a linked number, especially if people who did not agree to hear from you report your messages. Link a number you can afford to lose, message only people who opted in, and use SMS or email for anything critical."
  },
  {
    id: 'panel5',
    question: 'Can I send bulk SMS to customers across Nepal?',
    answer:
      'Yes. Nepal Fillings sends SMS campaigns through your own Aakash SMS account: you open an account with Aakash SMS, buy SMS credits there, and connect your auth token and sender ID in Nepal Fillings. You can then schedule campaigns and see the status of each message.'
  },
  {
    id: 'panel6',
    question: 'Is Nepal Fillings suitable for small businesses in Nepal?',
    answer:
      'Yes. You can start on the free plan with up to 500 subscribers and move to a paid plan only when your list grows beyond it, so there is nothing to commit to up front.'
  },
  {
    id: 'panel7',
    question: 'How do I connect Nepal Fillings to my website or app?',
    answer:
      "Use the REST API. Create an API key for a channel in your dashboard, then send SMS, WhatsApp, email and Messenger messages from your website, app or CRM. The API reference in the dashboard has cURL examples for every endpoint. Test keys work straight away; live sends use prepaid API credits, which our team adds to your account. Telegram isn't available through the API."
  },
  {
    id: 'panel8',
    question: 'How do I upgrade to a paid plan or buy API credits?',
    answer:
      "Paid plans and API credits are set up by our team. Call or email us using the details in the contact section, and we'll confirm the price for your subscriber count and how to pay."
  },
  {
    id: 'panel9',
    question: 'How does Telegram marketing work on Nepal Fillings?',
    answer:
      'You create a Telegram bot, connect it to your Nepal Fillings account, and share its subscription link with your audience. People who subscribe through your bot are added to your contacts, and you can then send broadcasts to all subscribers or to specific groups from the dashboard.'
  }
]
