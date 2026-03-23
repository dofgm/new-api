import React from 'react';
import { Typography, Button, Space } from '@douyinfe/semi-ui';
import { IconRefresh } from '@douyinfe/semi-icons';
import { Receipt } from 'lucide-react';

const { Text } = Typography;

const TIME_PRESETS = [
  { key: 'today', label: '今天', days: 0 },
  { key: 'yesterday', label: '昨天', days: -1 },
  { key: '7d', label: '7天', days: 7 },
  { key: '15d', label: '15天', days: 15 },
  { key: '30d', label: '30天', days: 30 },
];

const BillingDescription = ({ activePreset, onPresetChange, onRefresh, loading, t }) => {
  return (
    <div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-2 w-full'>
      <div className='flex items-center text-blue-500'>
        <Receipt size={16} className='mr-2' />
        <Text>{t('充值账单')}</Text>
      </div>
      <Space>
        {TIME_PRESETS.map((preset) => (
          <Button
            key={preset.key}
            size='small'
            type={activePreset === preset.key ? 'primary' : 'tertiary'}
            theme={activePreset === preset.key ? 'solid' : 'light'}
            onClick={() => onPresetChange(preset.key, preset.days)}
          >
            {t(preset.label)}
          </Button>
        ))}
        <Button
          size='small'
          type='tertiary'
          theme='light'
          icon={<IconRefresh />}
          onClick={onRefresh}
          loading={loading}
        />
      </Space>
    </div>
  );
};

export default BillingDescription;
