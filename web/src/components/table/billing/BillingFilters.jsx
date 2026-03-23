import React, { useRef } from 'react';
import { Form, Button, DatePicker } from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'success', label: '成功' },
  { value: 'pending', label: '待支付' },
  { value: 'failed', label: '失败' },
  { value: 'expired', label: '已过期' },
];

const BillingFilters = ({
  onSearch,
  onReset,
  loading,
  t,
}) => {
  const formApiRef = useRef(null);

  const handleReset = () => {
    if (!formApiRef.current) return;
    formApiRef.current.reset();
    setTimeout(() => {
      onReset();
    }, 100);
  };

  const handleSubmit = (values) => {
    let startTime = 0;
    let endTime = 0;
    if (values.dateRange && values.dateRange.length === 2) {
      const [start, end] = values.dateRange;
      startTime = Math.floor(new Date(start).getTime() / 1000);
      // 结束日期设为当天 23:59:59
      const endDate = new Date(end);
      endDate.setHours(23, 59, 59, 999);
      endTime = Math.floor(endDate.getTime() / 1000);
    }
    onSearch(values.keyword || '', values.status || '', startTime, endTime);
  };

  return (
    <Form
      getFormApi={(api) => {
        formApiRef.current = api;
      }}
      onSubmit={handleSubmit}
      allowEmpty={true}
      autoComplete='off'
      layout='horizontal'
      trigger='change'
      stopValidateWithError={false}
      className='w-full md:w-auto order-1 md:order-2'
    >
      <div className='flex flex-col md:flex-row items-center gap-2 w-full md:w-auto'>
        <div className='w-full md:w-36'>
          <Form.Select
            field='status'
            placeholder={t('全部状态')}
            optionList={STATUS_OPTIONS.map((opt) => ({
              value: opt.value,
              label: t(opt.label),
            }))}
            onChange={() => {
              setTimeout(() => {
                formApiRef.current?.submitForm();
              }, 100);
            }}
            className='w-full'
            showClear
            pure
            size='small'
          />
        </div>
        <div className='w-full md:w-auto'>
          <Form.DatePicker
            field='dateRange'
            type='dateRange'
            density='compact'
            placeholder={[t('开始日期'), t('结束日期')]}
            style={{ width: 240 }}
            pure
            size='small'
          />
        </div>
        <div className='relative w-full md:w-48'>
          <Form.Input
            field='keyword'
            prefix={<IconSearch />}
            placeholder={t('搜索订单号')}
            showClear
            pure
            size='small'
          />
        </div>
        <div className='flex gap-2 w-full md:w-auto'>
          <Button
            type='tertiary'
            htmlType='submit'
            loading={loading}
            className='flex-1 md:flex-initial md:w-auto'
            size='small'
          >
            {t('查询')}
          </Button>
          <Button
            type='tertiary'
            onClick={handleReset}
            className='flex-1 md:flex-initial md:w-auto'
            size='small'
          >
            {t('重置')}
          </Button>
        </div>
      </div>
    </Form>
  );
};

export default BillingFilters;
