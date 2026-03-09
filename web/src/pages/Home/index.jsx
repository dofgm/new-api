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

import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Spin } from '@douyinfe/semi-ui';
import { useNavigate } from 'react-router-dom';
import { API, copy, showError, showSuccess, getLogo } from '../../helpers';
import { renderQuota } from '../../helpers/render';
import {
  formatSubscriptionDuration,
  formatSubscriptionResetPeriod,
} from '../../helpers/subscriptionFormat';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { StatusContext } from '../../context/Status';
import { marked } from 'marked';
import { useTranslation } from 'react-i18next';
import NoticeModal from '../../components/layout/NoticeModal';


const FEATURE_ITEMS = [
  {
    key: 'speed',
    title: '极速响应',
    description:
      '常用模型统一入口，适配流式输出，减少多平台来回切换。',
    index: '01',
  },
  {
    key: 'stability',
    title: '稳定路由',
    description: '面向开发使用场景，减少渠道波动带来的调用中断。',
    index: '02',
  },
  {
    key: 'pricing',
    title: '套餐清晰',
    description: '不再只显示抽象标签，直接呈现价格、额度、重置规则与升级分组。',
    index: '03',
  },
  {
    key: 'compatibility',
    title: '即插即用',
    description:
      '兼容 OpenAI 风格接口，便于接入 Cursor、Cline、Claude Code 等工具。',
    index: '04',
  },
];

const PROVIDER_COMPANIES = [
  { key: 'anthropic', label: 'Anthropic' },
  { key: 'openai', label: 'OpenAI' },
  { key: 'google', label: 'Google' },
];

const PROVIDER_MODELS = [
  { key: 'claude', label: 'Claude' },
  { key: 'chatgpt', label: 'ChatGPT' },
  { key: 'gemini', label: 'Gemini' },
];

const TUTORIAL_ITEMS = [
  {
    key: 'claude',
    label: 'Claude Code',
    title: 'Claude Code 快速接入',
    description:
      '参考文档中的 Claude Code 教程：安装 Node.js、安装 Claude Code，并配置 ANTHROPIC_BASE_URL 与 ANTHROPIC_AUTH_TOKEN。',
    badges: ['Base URL: /', 'Claude 官方变量'],
    steps: [
      {
        step: '01',
        title: '安装 Claude Code',
        description:
          '先准备 Node.js 环境，再执行 npm install -g @anthropic-ai/claude-code。',
      },
      {
        step: '02',
        title: '设置环境变量',
        descriptionTemplate: true,
      },
      {
        step: '03',
        title: '启动并验证',
        description: '执行 claude，能正常启动并对话就说明接入成功。',
      },
    ],
    codeTitle: '与文档保持一致',
  },
  {
    key: 'gemini',
    label: 'Gemini CLI',
    title: 'Gemini CLI 快速接入',
    description:
      '参考文档中的 Gemini CLI 教程：重点是把网关地址设置为 /gemini，并同时配置 GEMINI_API_KEY 与 GEMINI_MODEL。',
    badges: ['Base URL: /gemini', 'Gemini CLI'],
    steps: [
      {
        step: '01',
        title: '准备 Node.js 环境',
        description: 'Gemini CLI 需要 Node.js，可直接参考 Claude Code 教程中的安装步骤。',
      },
      {
        step: '02',
        title: '设置 Gemini 专用变量',
        description:
          '使用 GOOGLE_GEMINI_BASE_URL、GEMINI_API_KEY 与 GEMINI_MODEL，不要混用其他工具变量。',
      },
      {
        step: '03',
        title: '从默认模型开始测试',
        description: '建议先按文档示例使用 gemini-2.5-pro，确认 CLI 能正常请求后再切换。',
      },
    ],
    codeTitle: '直接对应文档变量名',
  },
  {
    key: 'codex',
    label: 'Codex CLI',
    title: 'Codex CLI 快速接入',
    description:
      '参考文档中的 Codex CLI 教程：核心是写入 ~/.codex/config.toml，把 provider 指向网关的 /v1 端点。',
    badges: ['Base URL: /v1', 'wire_api: responses'],
    steps: [
      {
        step: '01',
        title: '创建 config.toml',
        description:
          '按文档把 model_provider 设为 crs，model 默认使用 gpt-5-codex，并保留 wire_api = responses。',
      },
      {
        step: '02',
        title: '配置认证方式',
        description:
          '可以写 ~/.codex/auth.json，也可以直接设置 CRS_OAI_KEY 环境变量。',
      },
      {
        step: '03',
        title: '先用默认模型跑通',
        description: '优先使用文档里的 gpt-5-codex，确认接入成功后再切换其他模型。',
      },
    ],
    codeTitle: '精简版配置片段',
  },
];

const getPlanTag = (plan) => {
  const title = (plan?.title || '').toLowerCase();
  if (title.includes('周卡')) return '热门订阅';
  if (title.includes('养虾')) return '推荐方案';
  return '订阅方案';
};

const normalizePlanRecord = (record) => {
  if (!record) return null;
  if (record.plan && typeof record.plan === 'object') {
    return record.plan;
  }
  return record;
};

const Home = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [statusState] = useContext(StatusContext);
  const [homePageContentLoaded, setHomePageContentLoaded] = useState(false);
  const [homePageContent, setHomePageContent] = useState('');
  const [noticeVisible, setNoticeVisible] = useState(false);
  const [subscriptionPlans, setSubscriptionPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [activeTutorial, setActiveTutorial] = useState('claude');
  const isMobile = useIsMobile();
  const docsLink = statusState?.status?.docs_link || '';
  const docsUrl = docsLink || `${window.location.origin}/docs/`;
  const serverAddress =
    statusState?.status?.server_address || `${window.location.origin}`;
  const openAIBaseUrl = `${serverAddress}/v1`;
  const systemName = statusState?.status?.system_name || 'DOFGM AI Hub';

  const displayHomePageContent = async () => {
    setHomePageContent(localStorage.getItem('home_page_content') || '');
    const res = await API.get('/api/home_page_content');
    const { success, message, data } = res.data;
    if (success) {
      let content = data;
      if (data && !data.startsWith('https://')) {
        content = marked.parse(data);
      }
      setHomePageContent(content);
      localStorage.setItem('home_page_content', content || '');
    } else {
      showError(message);
      setHomePageContent('加载首页内容失败...');
    }
    setHomePageContentLoaded(true);
  };

  const getSubscriptionPlans = async () => {
    setPlansLoading(true);
    try {
      const res = await API.get('/api/subscription/public_plans');
      if (res.data?.success) {
        setSubscriptionPlans(
          (res.data.data || [])
            .map((item) => normalizePlanRecord(item))
            .filter(Boolean),
        );
      } else {
        setSubscriptionPlans([]);
      }
    } catch (error) {
      setSubscriptionPlans([]);
    } finally {
      setPlansLoading(false);
    }
  };

  const handleCopyBaseURL = async () => {
    const ok = await copy(serverAddress);
    if (ok) {
      showSuccess(t('已复制到剪切板'));
    }
  };

  const scrollToQuickStart = () => {
    document
      .getElementById('quick-start')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollToPricing = () => {
    document
      .getElementById('pricing')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCopySnippet = async (snippet) => {
    const ok = await copy(snippet);
    if (ok) {
      showSuccess(t('已复制到剪切板'));
    }
  };

  const planCards = useMemo(() => {
    return subscriptionPlans.map((plan) => ({ plan })).reverse();
  }, [subscriptionPlans]);

  const tutorialItems = useMemo(
    () => ({
      claude: {
        snippet: `export ANTHROPIC_BASE_URL="${serverAddress}"
export ANTHROPIC_AUTH_TOKEN="your-api-key"

claude`,
      },
      gemini: {
        snippet: `export GOOGLE_GEMINI_BASE_URL="${serverAddress}/gemini"
export GEMINI_API_KEY="your-api-key"
export GEMINI_MODEL="gemini-2.5-pro"`,
      },
      codex: {
        snippet: `model_provider = "crs"
model = "gpt-5-codex"
preferred_auth_method = "apikey"

[model_providers.crs]
name = "crs"
base_url = "${openAIBaseUrl}"
wire_api = "responses"
requires_openai_auth = true
env_key = "CRS_OAI_KEY"`,
      },
    }),
    [openAIBaseUrl, serverAddress],
  );

  const activeTutorialItem = useMemo(() => {
    const base = TUTORIAL_ITEMS.find((item) => item.key === activeTutorial);
    if (!base) return null;
    const item = {
      ...base,
      snippet: tutorialItems[activeTutorial]?.snippet || '',
    };
    // Fill in dynamic step descriptions
    item.steps = item.steps.map((step) => {
      if (step.descriptionTemplate) {
        return {
          ...step,
          description: `文档使用 ANTHROPIC_BASE_URL=${serverAddress} 与 ANTHROPIC_AUTH_TOKEN=你的API密钥。`,
        };
      }
      return step;
    });
    return item;
  }, [activeTutorial, tutorialItems, serverAddress]);

  useEffect(() => {
    const checkNoticeAndShow = async () => {
      const lastCloseDate = localStorage.getItem('notice_close_date');
      const today = new Date().toDateString();
      if (lastCloseDate !== today) {
        try {
          const res = await API.get('/api/notice');
          const { success, data } = res.data;
          if (success && data && data.trim() !== '') {
            setNoticeVisible(true);
          }
        } catch (error) {
          console.error('获取公告失败:', error);
        }
      }
    };

    checkNoticeAndShow();
    displayHomePageContent().then();
    getSubscriptionPlans().then();
  }, []);

  if (!homePageContentLoaded) {
    return (
      <div className='w-full min-h-[60vh] flex items-center justify-center'>
        <Spin size='large' />
      </div>
    );
  }

  if (homePageContent !== '') {
    return (
      <div className='overflow-x-hidden w-full'>
        {homePageContent.startsWith('https://') ? (
          <iframe src={homePageContent} className='w-full h-screen border-none' />
        ) : (
          <div
            className='mt-[60px]'
            dangerouslySetInnerHTML={{ __html: homePageContent }}
          />
        )}
      </div>
    );
  }

  return (
    <div className='df-homepage'>
      <NoticeModal
        visible={noticeVisible}
        onClose={() => setNoticeVisible(false)}
        isMobile={isMobile}
      />

      {/* ========== Hero Section ========== */}
      <section className='df-hero'>
        <div className='df-hero-bg' />
        <main className='df-shell'>
          <div className='df-hero-card'>
            <div className='df-hero-layout'>
              {/* Left column */}
              <div>
                <div className='df-eyebrow'>{systemName}</div>
                <div className='df-hero-brand'>
                  <img
                    src={getLogo()}
                    alt={systemName}
                    className='df-hero-logo'
                  />
                  <h1 className='df-hero-h1 df-rainbow-text'>
                    DOFGM<br />AI Hub
                  </h1>
                </div>
                <p className='df-lead'>
                  {t(
                    '稳定接入 Claude、GPT、Gemini 等主流模型，一套兼容接口即可覆盖常见开发工具与工作流。',
                  )}
                </p>

                <div className='df-hero-actions'>
                  <button
                    className='df-btn df-btn-primary'
                    onClick={() => navigate('/console')}
                  >
                    {t('开始使用')}
                  </button>
                  <button
                    className='df-btn df-btn-secondary'
                    onClick={scrollToQuickStart}
                  >
                    {t('查看教程')}
                  </button>
                  {docsLink && (
                    <button
                      className='df-btn df-btn-secondary'
                      onClick={() => window.open(docsLink, '_blank')}
                    >
                      {t('接口文档')}
                    </button>
                  )}
                </div>

                <div className='df-hero-metrics'>
                  <div className='df-metric'>
                    <strong>OpenAI Compatible</strong>
                    <span>{t('兼容常见工具与调用方式')}</span>
                  </div>
                  <div className='df-metric'>
                    <strong>Claude / GPT / Gemini</strong>
                    <span>{t('覆盖主流模型使用场景')}</span>
                  </div>
                  <div className='df-metric'>
                    <strong>{t('真实套餐直出')}</strong>
                    <span>{t('周卡、月卡内容清晰可见')}</span>
                  </div>
                </div>
              </div>

              {/* Right column */}
              <div className='df-hero-panel'>
                <div className='df-base-card'>
                  <div className='df-panel-label'>Base URL</div>
                  <div className='df-url-box'>
                    <span>{serverAddress}</span>
                    <button
                      className='df-btn df-btn-secondary df-btn-sm'
                      onClick={handleCopyBaseURL}
                    >
                      {t('复制')}
                    </button>
                  </div>
                  <div className='df-chip-row'>
                    <span className='df-chip'>/v1/chat/completions</span>
                    <span className='df-chip'>/v1/messages</span>
                    <span className='df-chip'>/v1/responses</span>
                    <span className='df-chip'>/v1/images/generations</span>
                  </div>
                </div>

                <div className='df-status-card'>
                  <div className='df-panel-label'>{t('模型供应商')}</div>
                  <div className='df-provider-row-label'>{t('平台')}</div>
                  <div className='df-provider-row'>
                    {PROVIDER_COMPANIES.map((item) => (
                      <span key={item.key} className='df-provider'>
                        {item.label}
                      </span>
                    ))}
                  </div>
                  <div className='df-provider-row-label'>{t('模型')}</div>
                  <div className='df-provider-row'>
                    {PROVIDER_MODELS.map((item) => (
                      <span key={item.key} className='df-provider'>
                        {item.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </section>

      {/* ========== Feature Section ========== */}
      <section className='df-section'>
        <div className='df-shell'>
          <div className='df-section-card'>
            <div className='df-section-head'>
              <div>
                <div className='df-kicker'>Core Features</div>
                <h2 className='df-section-h2'>
                  {t('为开发场景优化的 API 网关')}
                </h2>
              </div>
            </div>

            <div className='df-feature-grid'>
              {FEATURE_ITEMS.map((item) => (
                <div className='df-feature-card' key={item.key}>
                  <div className='df-feature-icon'>{item.index}</div>
                  <h3>{t(item.title)}</h3>
                  <p>{t(item.description)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ========== Pricing Section ========== */}
      <section className='df-section' id='pricing'>
        <div className='df-shell'>
          <div className='df-section-card'>
            <div className='df-section-head'>
              <div>
                <div className='df-kicker'>Live Plans</div>
                <h2 className='df-section-h2'>
                  {t('透明定价，按需选择')}
                </h2>
              </div>
            </div>

            {plansLoading ? (
              <div className='df-pricing-loading'>
                <Spin size='large' />
              </div>
            ) : (
              <div className='df-plans-grid'>
                {planCards.map(({ plan }) => {
                  const totalAmount = Number(plan?.total_amount || 0);
                  const tag = getPlanTag(plan);
                  return (
                    <article
                      className={`df-plan-card ${tag === '热门订阅' ? 'highlight' : ''}`}
                      key={plan.id}
                    >
                      <div className='df-plan-top'>
                        <span className='df-plan-tag'>
                          {t(tag)}
                        </span>
                        {plan?.upgrade_group && (
                          <span className='df-plan-group'>
                            {t('升级分组')} {plan.upgrade_group}
                          </span>
                        )}
                      </div>
                      <h3>{plan?.title || t('订阅套餐')}</h3>
                      <p>
                        {plan?.subtitle || t('按不同使用阶段提供更清晰的额度与重置规则。')}
                      </p>
                      <div className='df-price-row'>
                        <div className='df-price'>
                          ¥{Number(plan?.price_amount || 0).toFixed(2)}
                        </div>
                        <div className='df-price-unit'>
                          /{formatSubscriptionDuration(plan, t)}
                        </div>
                      </div>
                      <div className='df-meta-grid'>
                        <div className='df-meta-row'>
                          <div className='df-meta-label'>{t('每日额度')}</div>
                          <div className='df-meta-value'>
                            {totalAmount > 0 ? renderQuota(totalAmount) : t('无限制')}
                          </div>
                        </div>
                        <div className='df-meta-row'>
                          <div className='df-meta-label'>{t('重置')}</div>
                          <div className='df-meta-value'>
                            {formatSubscriptionResetPeriod(plan, t)}
                          </div>
                        </div>
                        <div className='df-meta-row'>
                          <div className='df-meta-label'>{t('购买上限')}</div>
                          <div className='df-meta-value'>
                            {plan?.max_purchase_per_user > 0
                              ? plan.max_purchase_per_user
                              : t('不限')}
                          </div>
                        </div>
                      </div>
                      <div className='df-plan-footer'>
                        <div className='df-plan-note'>
                          {t('当前套餐内容以后台实际配置为准。')}
                        </div>
                        <button
                          className='df-btn df-btn-primary df-btn-sm'
                          onClick={() => navigate('/console/topup')}
                        >
                          {t('立即购买')}
                        </button>
                      </div>
                    </article>
                  );
                })}

                {!planCards.length && (
                  <div className='df-pricing-empty'>
                    <h3>{t('暂未配置可展示套餐')}</h3>
                    <p>{t('你可以先进入控制台查看充值页，或稍后再回来。')}</p>
                    <button
                      className='df-btn df-btn-primary'
                      onClick={() => navigate('/console/topup')}
                    >
                      {t('前往购买页')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ========== Tutorial / Quick Start Section ========== */}
      <section className='df-section' id='quick-start'>
        <div className='df-shell'>
          <div className='df-section-card'>
            <div className='df-section-head'>
              <div>
                <div className='df-kicker'>Quick Start</div>
                <h2 className='df-section-h2'>
                  {t('三步完成接入，即刻开始开发')}
                </h2>
              </div>
            </div>

            <div className='df-tutorial-nav'>
              {TUTORIAL_ITEMS.map((item) => (
                <button
                  type='button'
                  key={item.key}
                  className={`df-tutorial-tab ${activeTutorial === item.key ? 'active' : ''}`}
                  onClick={() => setActiveTutorial(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {activeTutorialItem && (
              <div className='df-steps-grid'>
                {/* Left: summary + steps */}
                <div>
                  <div className='df-tool-summary'>
                    <div>
                      <h3>{t(activeTutorialItem.title)}</h3>
                      <p>{t(activeTutorialItem.description)}</p>
                    </div>
                    <div className='df-tool-badge-row'>
                      {activeTutorialItem.badges.map((badge) => (
                        <span key={badge} className='df-tool-badge'>
                          {badge}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className='df-steps-stack'>
                    {activeTutorialItem.steps.map((item) => (
                      <div className='df-step-card' key={item.step}>
                        <div className='df-step-index'>{item.step}</div>
                        <h3>{t(item.title)}</h3>
                        <p>{t(item.description)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: code card */}
                <div className='df-code-card'>
                  <div className='df-code-head'>
                    <span>{activeTutorialItem.label}</span>
                    <span>{t(activeTutorialItem.codeTitle)}</span>
                  </div>
                  <pre>
                    <code>{activeTutorialItem.snippet}</code>
                  </pre>
                  <div className='df-code-actions'>
                    <button
                      className='df-mini-btn df-mini-btn-primary'
                      onClick={() => handleCopySnippet(activeTutorialItem.snippet)}
                    >
                      {t('复制配置')}
                    </button>
                    <button
                      className='df-mini-btn'
                      onClick={() => navigate('/console/token')}
                    >
                      {t('创建 API Key')}
                    </button>
                    <button
                      className='df-mini-btn'
                      onClick={() => window.open(docsUrl, '_blank')}
                    >
                      {t('打开完整文档')}
                    </button>
                    <button
                      className='df-mini-btn'
                      onClick={scrollToPricing}
                    >
                      {t('查看套餐')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
