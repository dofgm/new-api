import React from 'react';
import { Typography } from '@douyinfe/semi-ui';
import { Receipt } from 'lucide-react';
import CompactModeToggle from '../../common/ui/CompactModeToggle';

const { Text } = Typography;

const BillingDescription = ({ compactMode, setCompactMode, t }) => {
  return (
    <div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-2 w-full'>
      <div className='flex items-center text-blue-500'>
        <Receipt size={16} className='mr-2' />
        <Text>{t('充值账单')}</Text>
      </div>
      <CompactModeToggle
        compactMode={compactMode}
        setCompactMode={setCompactMode}
        t={t}
      />
    </div>
  );
};

export default BillingDescription;
