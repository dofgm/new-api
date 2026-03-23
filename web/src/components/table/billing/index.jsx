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
  Card,
  Skeleton,
  Avatar,
} from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { Coins } from 'lucide-react';
import {
  IconMoneyExchangeStroked,
  IconPulse,
  IconHistogram,
  IconCoinMoneyStroked,
} from '@douyinfe/semi-icons';
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

// 统计卡片配置
const STAT_CARDS = [
  { key: 'total_money', label: '充值总额', icon: <IconMoneyExchangeStroked />, avatarColor: 'green', format: (v) => `¥${v.toFixed(2)}` },
  { key: 'total_count', label: '充值次数', icon: <IconPulse />, avatarColor: 'purple', format: (v) => `${v}` },
  { key: 'total_amount', label: '充值额度', icon: <IconHistogram />, avatarColor: 'yellow', format: (v) => `${v}` },
  { key: 'today_money', label: '今日充值', icon: <IconCoinMoneyStroked />, avatarColor: 'blue', format: (v) => `¥${v.toFixed(2)}` },
];

// 计算快捷时间范围
const getTimeRange = (presetKey) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23, 59, 59, 999);

  switch (presetKey) {
    case 'today':
      return {
        startTime: Math.floor(todayStart.getTime() / 1000),
        endTime: Math.floor(todayEnd.getTime() / 1000),
      };
    case 'yesterday': {
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      const yesterdayEnd = new Date(yesterdayStart);
      yesterdayEnd.setHours(23, 59, 59, 999);
      return {
        startTime: Math.floor(yesterdayStart.getTime() / 1000),
        endTime: Math.floor(yesterdayEnd.getTime() / 1000),
      };
    }
    case '7d':
    case '15d':
    case '30d': {
      const days = parseInt(presetKey);
      const start = new Date(todayStart);
      start.setDate(start.getDate() - days + 1);
      return {
        startTime: Math.floor(start.getTime() / 1000),
        endTime: Math.floor(todayEnd.getTime() / 1000),
      };
    }
    default:
      return { startTime: 0, endTime: 0 };
  }
};

const BillingPage = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [topups, setTopups] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [activePreset, setActivePreset] = useState('today');
  const [stats, setStats] = useState({ total_money: 0, total_count: 0, total_amount: 0, today_money: 0 });
  const userIsAdmin = useMemo(() => isAdmin(), []);

  // 加载列表数据
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

  // 加载统计数据
  const loadStats = useCallback(async (currentStartTime, currentEndTime) => {
    setStatsLoading(true);
    try {
      let qs = '';
      if (currentStartTime) qs += `start_time=${currentStartTime}`;
      if (currentEndTime) qs += `${qs ? '&' : ''}end_time=${currentEndTime}`;
      const res = await API.get(`/api/user/billing/stats${qs ? '?' + qs : ''}`);
      const { success, data } = res.data;
      if (success) {
        setStats(data || { total_money: 0, total_count: 0, total_amount: 0, today_money: 0 });
      }
    } catch (error) {
      // 统计加载失败不影响主功能
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // 初始加载 — 默认选中今天
  useEffect(() => {
    const { startTime: todayStart, endTime: todayEnd } = getTimeRange('today');
    setStartTime(todayStart);
    setEndTime(todayEnd);
    loadData(1, pageSize, keyword, status, todayStart, todayEnd);
    loadStats(todayStart, todayEnd);
  }, []);

  // 翻页时重新加载
  const pageRef = React.useRef({ page: 1, pageSize: 10, initialized: false });
  useEffect(() => {
    if (!pageRef.current.initialized) {
      pageRef.current.initialized = true;
      return;
    }
    loadData(page, pageSize, keyword, status, startTime, endTime);
  }, [page, pageSize]);

  const handlePageChange = (currentPage) => {
    setPage(currentPage);
  };

  const handlePageSizeChange = (currentPageSize) => {
    setPageSize(currentPageSize);
    setPage(1);
  };

  // 筛选搜索
  const handleSearch = (newKeyword, newStatus, newStartTime, newEndTime) => {
    setKeyword(newKeyword);
    setStatus(newStatus);
    setStartTime(newStartTime || 0);
    setEndTime(newEndTime || 0);
    setActivePreset('');
    setPage(1);
    loadData(1, pageSize, newKeyword, newStatus, newStartTime || 0, newEndTime || 0);
    loadStats(newStartTime || 0, newEndTime || 0);
  };

  // 重置
  const handleReset = () => {
    setKeyword('');
    setStatus('');
    setStartTime(0);
    setEndTime(0);
    setActivePreset('');
    setPage(1);
    loadData(1, pageSize, '', '', 0, 0);
    loadStats(0, 0);
  };

  // 快捷时间按钮
  const handlePresetChange = (presetKey) => {
    const { startTime: st, endTime: et } = getTimeRange(presetKey);
    setActivePreset(presetKey);
    setStartTime(st);
    setEndTime(et);
    setPage(1);
    loadData(1, pageSize, keyword, status, st, et);
    loadStats(st, et);
  };

  // 刷新
  const handleRefresh = () => {
    loadData(page, pageSize, keyword, status, startTime, endTime);
    loadStats(startTime, endTime);
  };

  // 手动选日期时清除快捷按钮高亮
  const handleDatePickerChange = () => {
    setActivePreset('');
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
        handleRefresh();
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
        render: (text) => <Text>{text}</Text>,
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

  // 统计卡片区域
  const statsArea = (
    <div className='grid grid-cols-2 md:grid-cols-4 gap-3 w-full mt-3'>
      {STAT_CARDS.map((card) => {
        return (
          <Card
            key={card.key}
            className='!rounded-xl'
            bodyStyle={{ padding: '12px 16px' }}
          >
            <div className='flex items-center gap-3'>
              <Avatar size='small' color={card.avatarColor}>
                {card.icon}
              </Avatar>
              <div>
                <div className='text-xs' style={{ color: 'var(--semi-color-text-2)' }}>
                  {t(card.label)}
                </div>
                <Skeleton loading={statsLoading} active placeholder={<Skeleton.Title style={{ width: 60, height: 20 }} />}>
                  <div className='text-base font-semibold' style={{ color: 'var(--semi-color-text-0)' }}>
                    {card.format(stats[card.key] || 0)}
                  </div>
                </Skeleton>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );

  return (
    <CardPro
      type='type1'
      descriptionArea={
        <>
          <BillingDescription
            activePreset={activePreset}
            onPresetChange={handlePresetChange}
            onRefresh={handleRefresh}
            loading={loading || statsLoading}
            t={t}
          />
          {statsArea}
        </>
      }
      actionsArea={
        <BillingFilters
          onSearch={handleSearch}
          onReset={handleReset}
          onDatePickerChange={handleDatePickerChange}
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
        size='small'
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
