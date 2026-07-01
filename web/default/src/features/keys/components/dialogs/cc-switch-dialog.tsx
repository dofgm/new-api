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
import { useQuery } from '@tanstack/react-query'
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { ComboboxInput } from '@/components/ui/combobox-input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { api, getUserModels } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

const APP_CONFIGS = {
  claude: {
    label: 'Claude',
    defaultName: 'AIONEW',
    modelFields: [
      { key: 'model', labelKey: 'Primary Model', required: false },
      { key: 'haikuModel', labelKey: 'Haiku Model', required: false },
      { key: 'sonnetModel', labelKey: 'Sonnet Model', required: false },
      { key: 'opusModel', labelKey: 'Opus Model', required: false },
    ],
  },
  codex: {
    label: 'Codex',
    defaultName: 'AIONEW',
    modelFields: [{ key: 'model', labelKey: 'Primary Model', required: true }],
  },
  gemini: {
    label: 'Gemini',
    defaultName: 'AIONEW',
    modelFields: [{ key: 'model', labelKey: 'Primary Model', required: true }],
  },
} as const

type AppType = keyof typeof APP_CONFIGS

function getServerAddress(): string {
  try {
    const raw = localStorage.getItem('status')
    if (raw) {
      const status = JSON.parse(raw)
      if (status.server_address) return status.server_address
    }
  } catch {
    /* empty */
  }
  return window.location.origin
}

const getDefaultProviderName = (appKey: AppType, tokenName?: string) =>
  tokenName ? `AIONEW - ${tokenName}` : APP_CONFIGS[appKey].defaultName

// Matches CC Switch's built-in NewAPI usage template (calls /api/user/self),
// embedded into the deeplink so users don't have to configure usage queries
// manually inside CC Switch after import.
const NEWAPI_USAGE_SCRIPT = `({
  request: {
    url: "{{baseUrl}}/api/user/self",
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer {{accessToken}}",
      "User-Agent": "cc-switch/1.0",
      "New-Api-User": "{{userId}}"
    },
  },
  extractor: function (response) {
    if (response.success && response.data) {
      return {
        planName: response.data.group || "default",
        remaining: response.data.quota / 500000,
        used: response.data.used_quota / 500000,
        total: (response.data.quota + response.data.used_quota) / 500000,
        unit: "USD",
      };
    }
    return {
      isValid: false,
      invalidMessage: response.message || "Query failed"
    };
  },
})`

interface UsageConfig {
  accessToken: string
  userId: number
  baseUrl: string
}

function buildCCSwitchURL(
  app: string,
  name: string,
  models: Record<string, string>,
  apiKey: string,
  usage?: UsageConfig
): string {
  const serverAddress = getServerAddress()
  const endpoint = app === 'codex' ? serverAddress + '/v1' : serverAddress
  const params = new URLSearchParams()
  params.set('resource', 'provider')
  params.set('app', app)
  params.set('name', name)
  params.set('endpoint', endpoint)
  params.set('apiKey', apiKey)
  for (const [k, v] of Object.entries(models)) {
    if (v) params.set(k, v)
  }
  params.set('homepage', serverAddress)
  params.set('enabled', 'true')
  params.set('icon', 'newapi')

  if (usage) {
    params.set('usageEnabled', 'true')
    params.set('usageBaseUrl', usage.baseUrl)
    params.set('usageAccessToken', usage.accessToken)
    params.set('usageUserId', String(usage.userId))
    params.set('usageAutoInterval', '5')
    params.set('usageScript', btoa(NEWAPI_USAGE_SCRIPT))
  }
  return `ccswitch://v1/import?${params.toString()}`
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  tokenKey: string
  tokenName?: string
}

export function CCSwitchDialog(props: Props) {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.auth.user)
  const [app, setApp] = useState<AppType>('claude')
  const [name, setName] = useState<string>(APP_CONFIGS.claude.defaultName)
  const [models, setModels] = useState<Record<string, string>>({})
  const [accessToken, setAccessToken] = useState<string>('')

  const { data: modelsData } = useQuery({
    queryKey: ['user-models-ccswitch'],
    queryFn: getUserModels,
    enabled: props.open,
    staleTime: 5 * 60 * 1000,
  })

  const modelOptions = useMemo(() => {
    const items = modelsData?.data ?? []
    return items.map((m) => ({ value: m, label: m }))
  }, [modelsData?.data])

  useEffect(() => {
    if (props.open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModels({})

      setApp('claude')

      setName(getDefaultProviderName('claude', props.tokenName))

      setAccessToken('')

      // Fetch access token in the background so the deeplink can embed
      // usage query. Silent failure: the provider still imports, only the
      // usage dashboard inside CC Switch will be unavailable.
      api
        .get('/api/user/access-token')
        .then((res) => {
          if (res.data?.success && res.data?.data) {
            setAccessToken(res.data.data)
          }
        })
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open])

  const currentConfig = APP_CONFIGS[app]

  const handleAppChange = (val: string) => {
    const appVal = val as AppType
    setApp(appVal)
    setName(getDefaultProviderName(appVal, props.tokenName))
    setModels({})
  }

  const handleSubmit = () => {
    const missingRequired = currentConfig.modelFields.some(
      (f) => f.required && !models[f.key]
    )
    if (missingRequired) {
      toast.warning(t('Please select a primary model'))
      return
    }
    const key = props.tokenKey.startsWith('sk-')
      ? props.tokenKey
      : `sk-${props.tokenKey}`
    const usage =
      accessToken && user?.id
        ? {
            accessToken,
            userId: user.id,
            baseUrl: getServerAddress(),
          }
        : undefined
    const url = buildCCSwitchURL(app, name, models, key, usage)
    window.open(url, '_blank')
    props.onOpenChange(false)
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Import to CC Switch')}
      contentClassName='sm:max-w-md'
      contentHeight='auto'
      bodyClassName={
        currentConfig.modelFields.length === 1 ? 'space-y-4 pb-52' : 'space-y-4'
      }
      footer={
        <>
          <Button variant='outline' onClick={() => props.onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleSubmit}>{t('Open CC Switch')}</Button>
        </>
      }
    >
      <div className='space-y-4'>
        <div className='space-y-2'>
          <Label>{t('Application')}</Label>
          <RadioGroup
            value={app}
            onValueChange={handleAppChange}
            className='flex gap-4'
          >
            {(
              Object.entries(APP_CONFIGS) as [
                AppType,
                (typeof APP_CONFIGS)[AppType],
              ][]
            ).map(([key, cfg]) => (
              <div key={key} className='flex items-center gap-2'>
                <RadioGroupItem value={key} id={`app-${key}`} />
                <Label htmlFor={`app-${key}`} className='cursor-pointer'>
                  {cfg.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div className='space-y-2'>
          <Label>{t('Name')}</Label>
          <ComboboxInput
            options={[]}
            value={name}
            onValueChange={setName}
            placeholder={currentConfig.defaultName}
            emptyText=''
            allowCustomValue={true}
          />
        </div>

        {currentConfig.modelFields.map((field) => (
          <div key={field.key} className='space-y-2'>
            <Label>
              {t(field.labelKey)}
              {field.required && (
                <span className='text-destructive ml-0.5'>*</span>
              )}
            </Label>
            <ComboboxInput
              options={modelOptions}
              value={models[field.key] || ''}
              onValueChange={(v) =>
                setModels((prev) => ({ ...prev, [field.key]: v }))
              }
              placeholder={t('Select or enter model name')}
              emptyText={t('No models found')}
            />
          </div>
        ))}
      </div>
    </Dialog>
  )
}
