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
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SettingsSwitchField } from '../components/settings-form-layout'

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
  values: XunhuSettingsValues
  onValueChange: <K extends keyof XunhuSettingsValues>(
    key: K,
    value: XunhuSettingsValues[K]
  ) => void
}

export function XunhuSettingsSection({ values, onValueChange }: Props) {
  const { t } = useTranslation()

  return (
    <div className='space-y-4 pt-4'>
      <div>
        <h3 className='text-lg font-medium'>
          {t('Xunhu (WeChat Pay) Gateway')}
        </h3>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Configure Xunhu WeChat Pay aggregator integration for CNY payments'
          )}
        </p>
      </div>
      <Alert>
        <AlertDescription className='text-xs'>
          {t(
            'Obtain AppId and AppSecret from the Xunhu merchant dashboard. The webhook URL is {{url}}.',
            { url: '<ServerAddress>/api/xunhu/webhook' }
          )}
        </AlertDescription>
      </Alert>

      <div className='grid grid-cols-2 gap-4'>
        <SettingsSwitchField
          label={t('Enable Xunhu')}
          checked={values.XunhuEnabled}
          onCheckedChange={(v) => onValueChange('XunhuEnabled', v)}
        />
        <SettingsSwitchField
          label={t('Test mode (skip signature verification)')}
          checked={values.XunhuTestMode}
          onCheckedChange={(v) => onValueChange('XunhuTestMode', v)}
        />
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <div className='grid gap-1.5'>
          <Label>{t('App ID')}</Label>
          <Input
            value={values.XunhuAppId}
            onChange={(e) => onValueChange('XunhuAppId', e.target.value)}
            placeholder='201906xxxxxx'
          />
        </div>
        <div className='grid gap-1.5'>
          <Label>{t('App Secret')}</Label>
          <Input
            type='password'
            autoComplete='new-password'
            placeholder={t('Leave blank unless rotating the secret')}
            value={values.XunhuAppSecret}
            onChange={(e) => onValueChange('XunhuAppSecret', e.target.value)}
          />
        </div>
      </div>

      <div className='grid gap-1.5'>
        <Label>{t('API URL')}</Label>
        <Input
          value={values.XunhuApiUrl}
          onChange={(e) => onValueChange('XunhuApiUrl', e.target.value)}
          placeholder='https://api.xunhupay.com/payment/do.html'
        />
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <div className='grid gap-1.5'>
          <Label>{t('Minimum top-up quantity')}</Label>
          <Input
            type='number'
            min={1}
            value={values.XunhuMinTopUp}
            onChange={(e) =>
              onValueChange('XunhuMinTopUp', Number(e.target.value) || 1)
            }
          />
        </div>
        <div className='grid gap-1.5'>
          <Label>{t('Order expire seconds')}</Label>
          <Input
            type='number'
            min={60}
            value={values.XunhuOrderExpire}
            onChange={(e) =>
              onValueChange('XunhuOrderExpire', Number(e.target.value) || 300)
            }
          />
        </div>
      </div>
    </div>
  )
}
