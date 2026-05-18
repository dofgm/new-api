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
import { SiQq } from 'react-icons/si'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const QQ_GROUP_JOIN_LINK = 'https://qm.qq.com/q/7pmAwWljHi'

export function QQGroupButton() {
  const { t } = useTranslation()
  const label = t('Join QQ Group')

  const button = (
    <Button
      variant='ghost'
      size='icon'
      className='h-9 w-9'
      onClick={() =>
        window.open(QQ_GROUP_JOIN_LINK, '_blank', 'noopener,noreferrer')
      }
      aria-label={label}
    >
      <SiQq className='size-[1.2rem]' />
    </Button>
  )

  return (
    <TooltipProvider delay={0}>
      <Tooltip>
        <TooltipTrigger render={button} />
        <TooltipContent>
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
