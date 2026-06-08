import { useTranslation } from 'react-i18next'
import { SectionPageLayout } from '@/components/layout'
import { BillingFilters } from './components/billing-filters'
import { BillingStatsCard } from './components/billing-stats-card'
import { BillingTable } from './components/billing-table'
import { useAdminBilling } from './hooks/use-admin-billing'

export function AdminBillingHistory() {
  const { t } = useTranslation()
  const {
    records,
    stats,
    total,
    page,
    pageSize,
    loading,
    fetching,
    completing,
    applyFilter,
    handlePageChange,
    handlePageSizeChange,
    handleCompleteOrder,
  } = useAdminBilling()

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Billing History')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='space-y-4'>
          <BillingStatsCard stats={stats} loading={loading} />
          <BillingFilters onChange={applyFilter} />
          <BillingTable
            records={records}
            loading={loading}
            fetching={fetching}
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            onCompleteOrder={handleCompleteOrder}
            completing={completing}
          />
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
