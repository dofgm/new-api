import { MessageCircleQuestion } from 'lucide-react'
import { SiQq } from 'react-icons/si'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const QQ_GROUP_JOIN_LINK = 'https://qm.qq.com/q/7pmAwWljHi'

export function InvoiceNoticeCard() {
  const { t } = useTranslation()
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
            <p className='text-muted-foreground line-clamp-1 text-xs'>
              {t(
                'Got questions while using the service or need an invoice? Join our QQ Group and our team will resolve it promptly.'
              )}
            </p>
          </div>
        </div>
        <Button
          variant='outline'
          size='sm'
          className='text-emerald-600 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-400 h-9 w-full shrink-0 gap-1.5 sm:w-auto'
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
