/*
Copyright (C) 2025 QuantumNous

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

import React, { useState } from 'react';
import { Button } from '@douyinfe/semi-ui';
import { showError } from '../../../helpers';
import DeleteRedemptionsModal from './modals/DeleteRedemptionsModal';

const RedemptionsActions = ({
  selectedKeys,
  setEditingRedemption,
  setShowEdit,
  batchCopyRedemptions,
  batchDeleteRedemptions,
  batchDeleteSelectedRedemptions,
  t,
}) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Add new redemption code
  const handleAddRedemption = () => {
    setEditingRedemption({
      id: undefined,
    });
    setShowEdit(true);
  };

  // Handle delete selected redemptions with confirmation
  const handleDeleteSelectedRedemptions = () => {
    if (selectedKeys.length === 0) {
      showError(t('请先选择要删除的兑换码！'));
      return;
    }
    setShowDeleteModal(true);
  };

  // Handle delete confirmation
  const handleConfirmDelete = () => {
    batchDeleteSelectedRedemptions();
    setShowDeleteModal(false);
  };

  return (
    <>
      <div className='flex flex-wrap gap-2 w-full md:w-auto order-2 md:order-1'>
        <Button
          type='primary'
          className='flex-1 md:flex-initial'
          onClick={handleAddRedemption}
          size='small'
        >
          {t('添加兑换码')}
        </Button>

        <Button
          type='tertiary'
          className='flex-1 md:flex-initial'
          onClick={batchCopyRedemptions}
          size='small'
        >
          {t('复制所选兑换码到剪贴板')}
        </Button>

        <Button
          type='warning'
          className='flex-1 md:flex-initial'
          onClick={handleDeleteSelectedRedemptions}
          size='small'
        >
          {t('删除所选兑换码')}
        </Button>

        <Button
          type='danger'
          className='w-full md:w-auto'
          onClick={batchDeleteRedemptions}
          size='small'
        >
          {t('清除失效兑换码')}
        </Button>
      </div>

      <DeleteRedemptionsModal
        visible={showDeleteModal}
        onCancel={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDelete}
        selectedKeys={selectedKeys}
        t={t}
      />
    </>
  );
};

export default RedemptionsActions;
