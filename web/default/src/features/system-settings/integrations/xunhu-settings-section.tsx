/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

export interface XunhuSettingsValues {
  XunhuEnabled: boolean
  XunhuAppId: string
  XunhuAppSecret: string
  XunhuApiUrl: string
  XunhuMinTopUp: number
  XunhuTestMode: boolean
  XunhuOrderExpire: number
}

interface Props {
  defaultValues: XunhuSettingsValues
}

export function XunhuSettingsSection(props: Props) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [loading, setLoading] = useState(false)

  const form = useForm<XunhuSettingsValues>({
    defaultValues: props.defaultValues,
  })

  useEffect(() => {
    form.reset(props.defaultValues)
  }, [props.defaultValues, form])

  const handleSave = async () => {
    setLoading(true)
    try {
      const values = form.getValues()
      const options: { key: string; value: string | number | boolean }[] = [
        { key: 'XunhuEnabled', value: values.XunhuEnabled },
        { key: 'XunhuAppId', value: values.XunhuAppId.trim() },
        {
          key: 'XunhuApiUrl',
          value:
            values.XunhuApiUrl.trim() ||
            'https://api.xunhupay.com/payment/do.html',
        },
        { key: 'XunhuMinTopUp', value: Number(values.XunhuMinTopUp) || 1 },
        { key: 'XunhuTestMode', value: values.XunhuTestMode },
        {
          key: 'XunhuOrderExpire',
          value: Number(values.XunhuOrderExpire) || 300,
        },
      ]
      // AppSecret 只在用户填写新值时才更新，避免清空原值
      if (values.XunhuAppSecret && values.XunhuAppSecret.trim()) {
        options.push({
          key: 'XunhuAppSecret',
          value: values.XunhuAppSecret.trim(),
        })
      }

      for (const opt of options) {
        await updateOption.mutateAsync(opt)
      }
      toast.success(t('Updated successfully'))
    } catch {
      toast.error(t('Update failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <SettingsSection
      title={t('Xunhu (WeChat Pay) Gateway')}
      description={t(
        'Configure Xunhu WeChat Pay aggregator integration for CNY payments'
      )}
    >
      <Alert>
        <AlertDescription className='text-xs'>
          {t(
            'Obtain AppId and AppSecret from the Xunhu merchant dashboard. The webhook URL is {{url}}.',
            { url: '<ServerAddress>/api/xunhu/webhook' }
          )}
        </AlertDescription>
      </Alert>

      <div className='grid grid-cols-2 gap-4'>
        <div className='flex items-center gap-2'>
          <Switch
            checked={form.watch('XunhuEnabled')}
            onCheckedChange={(v) => form.setValue('XunhuEnabled', v)}
          />
          <Label>{t('Enable Xunhu')}</Label>
        </div>
        <div className='flex items-center gap-2'>
          <Switch
            checked={form.watch('XunhuTestMode')}
            onCheckedChange={(v) => form.setValue('XunhuTestMode', v)}
          />
          <Label>{t('Test mode (skip signature verification)')}</Label>
        </div>
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <div className='grid gap-1.5'>
          <Label>{t('App ID')}</Label>
          <Input {...form.register('XunhuAppId')} placeholder='201906xxxxxx' />
        </div>
        <div className='grid gap-1.5'>
          <Label>{t('App Secret')}</Label>
          <Input
            type='password'
            autoComplete='new-password'
            placeholder={t('Leave blank unless rotating the secret')}
            {...form.register('XunhuAppSecret')}
          />
        </div>
      </div>

      <div className='grid gap-1.5'>
        <Label>{t('API URL')}</Label>
        <Input
          {...form.register('XunhuApiUrl')}
          placeholder='https://api.xunhupay.com/payment/do.html'
        />
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <div className='grid gap-1.5'>
          <Label>{t('Minimum top-up quantity')}</Label>
          <Input type='number' min={1} {...form.register('XunhuMinTopUp')} />
        </div>
        <div className='grid gap-1.5'>
          <Label>{t('Order expire seconds')}</Label>
          <Input
            type='number'
            min={60}
            {...form.register('XunhuOrderExpire')}
          />
        </div>
      </div>

      <Button onClick={handleSave} disabled={loading}>
        {loading ? t('Saving...') : t('Save Changes')}
      </Button>
    </SettingsSection>
  )
}
