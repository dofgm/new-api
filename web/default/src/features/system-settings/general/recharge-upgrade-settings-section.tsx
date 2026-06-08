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
import { z } from 'zod'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const schema = z.object({
  enabled: z.boolean(),
  threshold: z.coerce.number().min(0),
  targetGroup: z.string(),
  fromGroup: z.string(),
})

type Values = z.infer<typeof schema>

export function RechargeUpgradeSettingsSection({
  defaultValues,
}: {
  defaultValues: {
    enabled: boolean
    threshold: number
    targetGroup: string
    fromGroup: string
  }
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const form = useForm<Values>({
    resolver: zodResolver(schema) as unknown as Resolver<Values>,
    defaultValues: {
      enabled: defaultValues.enabled,
      threshold: defaultValues.threshold,
      targetGroup: defaultValues.targetGroup,
      fromGroup: defaultValues.fromGroup,
    },
  })

  const { isDirty, isSubmitting } = form.formState
  const enabled = form.watch('enabled')

  async function onSubmit(values: Values) {
    const updates: Array<{ key: string; value: string }> = []

    if (values.enabled !== defaultValues.enabled) {
      updates.push({
        key: 'recharge_upgrade_setting.enabled',
        value: String(values.enabled),
      })
    }
    if (values.threshold !== defaultValues.threshold) {
      updates.push({
        key: 'recharge_upgrade_setting.threshold',
        value: String(values.threshold),
      })
    }
    if (values.targetGroup !== defaultValues.targetGroup) {
      updates.push({
        key: 'recharge_upgrade_setting.target_group',
        value: values.targetGroup,
      })
    }
    if (values.fromGroup !== defaultValues.fromGroup) {
      updates.push({
        key: 'recharge_upgrade_setting.from_group',
        value: values.fromGroup,
      })
    }

    if (updates.length === 0) {
      toast.info(t('No changes to save'))
      return
    }

    if (values.enabled && values.targetGroup.trim() === '') {
      toast.error(t('Please specify a target group before enabling.'))
      return
    }

    for (const update of updates) {
      await updateOption.mutateAsync(update)
    }

    form.reset(values)
  }

  return (
    <SettingsSection title={t('Recharge Auto-Upgrade')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending || isSubmitting}
            isSaveDisabled={!isDirty}
            saveLabel='Save recharge upgrade settings'
          />
          <FormField
            control={form.control}
            name='enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable recharge auto-upgrade')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Automatically upgrade a user to the target group once their cumulative recharge reaches the threshold. Only upgrades, never downgrades.'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={updateOption.isPending || isSubmitting}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />

          {enabled && (
            <div className='grid gap-6 sm:grid-cols-2'>
              <FormField
                control={form.control}
                name='threshold'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Cumulative Recharge Threshold')}</FormLabel>
                    <FormControl>
                      <Input type='number' min={0} step='0.01' {...field} />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Total amount actually paid (across Alipay/WeChat orders) required to trigger the upgrade.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='targetGroup'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Target Group')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('e.g., vip')} {...field} />
                    </FormControl>
                    <FormDescription>
                      {t('Group the user is upgraded to once qualified.')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='fromGroup'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Source Group')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('default')} {...field} />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Only users currently in this group are eligible for upgrade. Defaults to "default" to avoid downgrading higher-tier users.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
