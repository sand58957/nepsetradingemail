// Component Imports
import SubscriberDetail from '@views/email/subscribers/SubscriberDetail'

const SubscriberDetailPage = async (props: { params: Promise<{ id: string }> }) => {
  const params = await props.params

  return <SubscriberDetail id={params.id} />
}

export default SubscriberDetailPage
