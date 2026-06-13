import { MessageCircleQuestion } from 'lucide-react'
import { SiQq } from 'react-icons/si'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const QQ_GROUP_JOIN_LINK = 'https://qm.qq.com/q/7pmAwWljHi'

interface SupportBannerCardProps {
  loading?: boolean
}

export function SupportBannerCard({ loading }: SupportBannerCardProps) {
  const { t } = useTranslation()

  // Match the page-wide skeleton state so this static banner doesn't pop in
  // fully-rendered while every other card is still showing skeletons.
  if (loading) {
    return (
      <Card className='bg-muted/20 py-0'>
        <CardContent className='grid gap-3 p-3 sm:gap-4 sm:p-4 lg:grid-cols-[1fr_auto] lg:items-center'>
          <div className='flex min-w-0 items-center gap-2.5'>
            <Skeleton className='size-8 shrink-0 rounded-lg' />
            <div className='min-w-0 flex-1 space-y-1.5'>
              <Skeleton className='h-4 w-28' />
              <Skeleton className='h-3 w-full max-w-md' />
            </div>
          </div>
          <Skeleton className='h-9 w-full sm:w-32' />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className='bg-muted/20 py-0'>
      <CardContent className='grid gap-3 p-3 sm:gap-4 sm:p-4 lg:grid-cols-[1fr_auto] lg:items-center'>
        <div className='flex min-w-0 items-center gap-2.5'>
          <div className='bg-background flex size-8 shrink-0 items-center justify-center rounded-lg border'>
            <MessageCircleQuestion className='text-muted-foreground size-4' />
          </div>
          <div className='min-w-0'>
            <h3 className='truncate text-sm font-semibold'>
              {t('Customer Support')}
            </h3>
            <p className='text-muted-foreground text-xs'>
              {t(
                'Trial accounts use higher multiplier rates and limited request speed. Recharge any amount to restore normal rates and speed. For issues or invoices, join our QQ Group.'
              )}
            </p>
          </div>
        </div>
        <Button
          variant='outline'
          size='sm'
          className='h-9 w-full shrink-0 gap-1.5 sm:w-auto'
          onClick={() =>
            window.open(QQ_GROUP_JOIN_LINK, '_blank', 'noopener,noreferrer')
          }
        >
          <SiQq className='size-4' />
          {t('Join QQ Group')}
        </Button>
      </CardContent>
    </Card>
  )
}
