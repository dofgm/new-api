import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Table,
  Badge,
  Typography,
  Toast,
  Empty,
  Button,
  Tag,
  Modal,
} from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { Coins } from 'lucide-react';
import { API, timestamp2string } from '../../../helpers';
import { isAdmin, createCardProPagination } from '../../../helpers/utils';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import { useTranslation } from 'react-i18next';
import CardPro from '../../common/ui/CardPro';
import BillingDescription from './BillingDescription';
import BillingFilters from './BillingFilters';

const { Text } = Typography;

// 状态映射配置
const STATUS_CONFIG = {
  success: { type: 'success', key: '成功' },
  pending: { type: 'warning', key: '待支付' },
  failed: { type: 'danger', key: '失败' },
  expired: { type: 'danger', key: '已过期' },
};

// 支付方式映射
const PAYMENT_METHOD_MAP = {
  stripe: 'Stripe',
  creem: 'Creem',
  waffo: 'Waffo',
  alipay: '支付宝',
  wxpay: '微信',
};

const BillingPage = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [topups, setTopups] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [compactMode, setCompactMode] = useState(false);
  const userIsAdmin = useMemo(() => isAdmin(), []);

  const loadData = useCallback(async (currentPage, currentPageSize, currentKeyword, currentStatus, currentStartTime, currentEndTime) => {
    setLoading(true);
    try {
      let qs = `p=${currentPage}&page_size=${currentPageSize}`;
      if (currentKeyword) qs += `&keyword=${encodeURIComponent(currentKeyword)}`;
      if (currentStatus) qs += `&status=${encodeURIComponent(currentStatus)}`;
      if (currentStartTime) qs += `&start_time=${currentStartTime}`;
      if (currentEndTime) qs += `&end_time=${currentEndTime}`;
      const res = await API.get(`/api/user/billing?${qs}`);
      const { success, message, data } = res.data;
      if (success) {
        setTopups(data.items || []);
        setTotal(data.total || 0);
      } else {
        Toast.error({ content: message || t('加载失败') });
      }
    } catch (error) {
      Toast.error({ content: t('加载账单失败') });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData(page, pageSize, keyword, status, startTime, endTime);
  }, [page, pageSize]);

  const handlePageChange = (currentPage) => {
    setPage(currentPage);
  };

  const handlePageSizeChange = (currentPageSize) => {
    setPageSize(currentPageSize);
    setPage(1);
  };

  const handleSearch = (newKeyword, newStatus, newStartTime, newEndTime) => {
    setKeyword(newKeyword);
    setStatus(newStatus);
    setStartTime(newStartTime || 0);
    setEndTime(newEndTime || 0);
    setPage(1);
    loadData(1, pageSize, newKeyword, newStatus, newStartTime || 0, newEndTime || 0);
  };

  const handleReset = () => {
    setKeyword('');
    setStatus('');
    setStartTime(0);
    setEndTime(0);
    setPage(1);
    loadData(1, pageSize, '', '', 0, 0);
  };

  // 管理员补单
  const handleAdminComplete = async (tradeNo) => {
    try {
      const res = await API.post('/api/user/topup/complete', {
        trade_no: tradeNo,
      });
      const { success, message } = res.data;
      if (success) {
        Toast.success({ content: t('补单成功') });
        loadData(page, pageSize, keyword, status, startTime, endTime);
      } else {
        Toast.error({ content: message || t('补单失败') });
      }
    } catch (e) {
      Toast.error({ content: t('补单失败') });
    }
  };

  const confirmAdminComplete = (tradeNo) => {
    Modal.confirm({
      title: t('确认补单'),
      content: t('是否将该订单标记为成功并为用户入账？'),
      onOk: () => handleAdminComplete(tradeNo),
    });
  };

  // 渲染状态徽章
  const renderStatusBadge = (statusVal) => {
    const config = STATUS_CONFIG[statusVal] || { type: 'primary', key: statusVal };
    return (
      <span className='flex items-center gap-2'>
        <Badge dot type={config.type} />
        <span>{t(config.key)}</span>
      </span>
    );
  };

  // 渲染支付方式
  const renderPaymentMethod = (pm) => {
    const displayName = PAYMENT_METHOD_MAP[pm];
    return <Text>{displayName ? t(displayName) : pm || '-'}</Text>;
  };

  const isSubscriptionTopup = (record) => {
    const tradeNo = (record?.trade_no || '').toLowerCase();
    return Number(record?.amount || 0) === 0 && tradeNo.startsWith('sub');
  };

  const columns = useMemo(() => {
    const baseColumns = [
      {
        title: t('订单号'),
        dataIndex: 'trade_no',
        key: 'trade_no',
        render: (text) => <Text copyable>{text}</Text>,
      },
      {
        title: t('支付方式'),
        dataIndex: 'payment_method',
        key: 'payment_method',
        render: renderPaymentMethod,
      },
      {
        title: t('充值额度'),
        dataIndex: 'amount',
        key: 'amount',
        render: (amount, record) => {
          if (isSubscriptionTopup(record)) {
            return (
              <Tag color='purple' shape='circle' size='small'>
                {t('订阅套餐')}
              </Tag>
            );
          }
          return (
            <span className='flex items-center gap-1'>
              <Coins size={16} />
              <Text>{amount}</Text>
            </span>
          );
        },
      },
      {
        title: t('支付金额'),
        dataIndex: 'money',
        key: 'money',
        render: (money) => <Text type='danger'>¥{money.toFixed(2)}</Text>,
      },
      {
        title: t('状态'),
        dataIndex: 'status',
        key: 'status',
        render: renderStatusBadge,
      },
    ];

    if (userIsAdmin) {
      baseColumns.push({
        title: t('操作'),
        key: 'action',
        render: (_, record) => {
          if (record.status === 'pending') {
            return (
              <Button
                size='small'
                type='primary'
                theme='outline'
                onClick={() => confirmAdminComplete(record.trade_no)}
              >
                {t('补单')}
              </Button>
            );
          }
          return null;
        },
      });
    }

    baseColumns.push({
      title: t('创建时间'),
      dataIndex: 'create_time',
      key: 'create_time',
      render: (time) => timestamp2string(time),
    });

    return baseColumns;
  }, [t, userIsAdmin]);

  return (
    <CardPro
      type='type1'
      descriptionArea={
        <BillingDescription
          compactMode={compactMode}
          setCompactMode={setCompactMode}
          t={t}
        />
      }
      actionsArea={
        <BillingFilters
          onSearch={handleSearch}
          onReset={handleReset}
          loading={loading}
          t={t}
        />
      }
      paginationArea={createCardProPagination({
        currentPage: page,
        pageSize: pageSize,
        total: total,
        onPageChange: handlePageChange,
        onPageSizeChange: handlePageSizeChange,
        isMobile: isMobile,
        t: t,
      })}
      t={t}
    >
      <Table
        columns={columns}
        dataSource={topups}
        loading={loading}
        rowKey='id'
        pagination={false}
        size={compactMode ? 'small' : 'default'}
        empty={
          <Empty
            image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
            darkModeImage={
              <IllustrationNoResultDark style={{ width: 150, height: 150 }} />
            }
            description={t('暂无充值记录')}
            style={{ padding: 30 }}
          />
        }
      />
    </CardPro>
  );
};

export default BillingPage;
