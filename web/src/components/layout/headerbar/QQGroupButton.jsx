import React, { useState, useEffect } from 'react';
import { Button, Tooltip } from '@douyinfe/semi-ui';
import { RiQqFill } from 'react-icons/ri';

const QQ_GROUP_URL =
  'https://qm.qq.com/cgi-bin/qm/qr?k=&group_code=4693347';
const STORAGE_KEY = 'qq_group_clicked';

const QQGroupButton = ({ t }) => {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setPulse(true);
    }
  }, []);

  const handleClick = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setPulse(false);
    window.open(QQ_GROUP_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <Tooltip content={t('加入 QQ 群')} position='bottom'>
      <Button
        icon={<RiQqFill size={18} />}
        aria-label={t('加入 QQ 群')}
        theme='borderless'
        type='tertiary'
        className={`!p-1.5 !text-current focus:!bg-semi-color-fill-1 !rounded-full !bg-semi-color-fill-0 hover:!bg-semi-color-fill-1${pulse ? ' qq-pulse' : ''}`}
        onClick={handleClick}
      />
    </Tooltip>
  );
};

export default QQGroupButton;
