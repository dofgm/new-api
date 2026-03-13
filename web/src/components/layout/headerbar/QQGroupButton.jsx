import React from 'react';
import { Button, Tooltip } from '@douyinfe/semi-ui';
import { RiQqFill } from 'react-icons/ri';

const QQ_GROUP_URL =
  'https://qm.qq.com/cgi-bin/qm/qr?k=&group_code=4693347';

const QQGroupButton = ({ t }) => {
  return (
    <Tooltip content={t('加入 QQ 群')} position='bottom'>
      <Button
        icon={<RiQqFill size={18} />}
        aria-label={t('加入 QQ 群')}
        theme='borderless'
        type='tertiary'
        className='!p-1.5 !rounded-full !text-white !bg-gradient-to-r !from-[#00c6ff] !via-[#7c5bf5] !to-[#ff6b9d] hover:!shadow-[0_0_12px_rgba(124,91,245,0.5)] hover:!scale-110 !transition-all !duration-200'
        onClick={() => window.open(QQ_GROUP_URL, '_blank', 'noopener,noreferrer')}
      />
    </Tooltip>
  );
};

export default QQGroupButton;
