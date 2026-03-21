import React from 'react';
import { Modal } from '@douyinfe/semi-ui';

const DeleteRedemptionsModal = ({
  visible,
  onCancel,
  onConfirm,
  selectedKeys,
  t,
}) => {
  return (
    <Modal
      title={t('批量删除兑换码')}
      visible={visible}
      onCancel={onCancel}
      onOk={onConfirm}
      type='warning'
    >
      <div>
        {t('确定要删除所选的 {{count}} 个兑换码吗？', {
          count: selectedKeys.length,
        })}
      </div>
    </Modal>
  );
};

export default DeleteRedemptionsModal;
