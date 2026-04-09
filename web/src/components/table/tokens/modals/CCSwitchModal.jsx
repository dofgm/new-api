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
import React, { useState, useEffect, useMemo, useContext } from 'react';
import {
  Modal,
  RadioGroup,
  Radio,
  Select,
  Input,
  Toast,
  Typography,
  Checkbox,
  Spin,
} from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { API, selectFilter } from '../../../../helpers';
import { UserContext } from '../../../../context/User';

const APP_CONFIGS = {
  claude: {
    label: 'Claude',
    defaultName: 'DOFGM',
    modelFields: [
      { key: 'model', label: '主模型', required: false },
      { key: 'haikuModel', label: 'Haiku 模型', required: false },
      { key: 'sonnetModel', label: 'Sonnet 模型', required: false },
      { key: 'opusModel', label: 'Opus 模型', required: false },
    ],
  },
  codex: {
    label: 'Codex',
    defaultName: 'DOFGM',
    modelFields: [{ key: 'model', label: '主模型', required: false }],
  },
  gemini: {
    label: 'Gemini',
    defaultName: 'DOFGM',
    modelFields: [{ key: 'model', label: '主模型', required: false }],
  },
};

function getServerAddress() {
  try {
    const raw = localStorage.getItem('status');
    if (raw) {
      const status = JSON.parse(raw);
      if (status.server_address) return status.server_address;
    }
  } catch (_) {}
  return window.location.origin;
}

const NEWAPI_USAGE_SCRIPT = `({
  request: {
    url: "{{baseUrl}}/api/user/self",
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer {{accessToken}}",
      "New-Api-User": "{{userId}}"
    },
  },
  extractor: function (response) {
    if (response.success && response.data) {
      return {
        planName: response.data.group || "默认套餐",
        remaining: response.data.quota / 500000,
        used: response.data.used_quota / 500000,
        total: (response.data.quota + response.data.used_quota) / 500000,
        unit: "USD",
      };
    }
    return {
      isValid: false,
      invalidMessage: response.message || "查询失败"
    };
  },
})`;

function buildCCSwitchURL(app, name, models, apiKey, usageConfig) {
  const serverAddress = getServerAddress();
  const endpoint = app === 'codex' ? serverAddress + '/v1' : serverAddress;
  const params = new URLSearchParams();
  params.set('resource', 'provider');
  params.set('app', app);
  params.set('name', name);
  params.set('endpoint', endpoint);
  params.set('apiKey', apiKey);
  for (const [k, v] of Object.entries(models)) {
    if (v) params.set(k, v);
  }
  params.set('homepage', serverAddress);
  params.set('enabled', 'true');
  params.set('icon', 'newapi');

  // Append usage/balance query parameters with embedded script
  if (usageConfig && usageConfig.enabled) {
    params.set('usageEnabled', 'true');
    params.set('usageBaseUrl', usageConfig.baseUrl || serverAddress);
    if (usageConfig.accessToken) {
      params.set('usageAccessToken', usageConfig.accessToken);
    }
    if (usageConfig.userId) {
      params.set('usageUserId', String(usageConfig.userId));
    }
    params.set('usageAutoInterval', '5');
    // Base64 encode the NewAPI usage query script
    params.set('usageScript', btoa(NEWAPI_USAGE_SCRIPT));
  }

  return `ccswitch://v1/import?${params.toString()}`;
}

export default function CCSwitchModal({
  visible,
  onClose,
  tokenKey,
  modelOptions,
}) {
  const { t } = useTranslation();
  const [userState] = useContext(UserContext);
  const [app, setApp] = useState('claude');
  const [name, setName] = useState(APP_CONFIGS.claude.defaultName);
  const [models, setModels] = useState({});
  const [includeUsage, setIncludeUsage] = useState(true);
  const [accessToken, setAccessToken] = useState('');
  const [loadingToken, setLoadingToken] = useState(false);

  const currentConfig = APP_CONFIGS[app];

  useEffect(() => {
    if (visible) {
      setModels({});
      setApp('claude');
      setName(APP_CONFIGS.claude.defaultName);
      setIncludeUsage(true);
      setAccessToken('');
      // Auto-generate access token for usage query
      fetchAccessToken();
    }
  }, [visible]);

  const fetchAccessToken = async () => {
    setLoadingToken(true);
    try {
      const res = await API.get('/api/user/token');
      const { success, data } = res.data;
      if (success && data) {
        setAccessToken(data);
      }
    } catch (_) {
      // Non-critical: usage query is optional
    } finally {
      setLoadingToken(false);
    }
  };

  const handleAppChange = (val) => {
    setApp(val);
    setName(APP_CONFIGS[val].defaultName);
    setModels({});
  };

  const handleModelChange = (field, value) => {
    setModels((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    const usageConfig = includeUsage && accessToken
      ? {
          enabled: true,
          baseUrl: getServerAddress(),
          accessToken,
          userId: userState?.user?.id,
        }
      : null;
    const url = buildCCSwitchURL(app, name, models, 'sk-' + tokenKey, usageConfig);
    window.open(url, '_blank');
    onClose();
  };

  const fieldLabelStyle = useMemo(
    () => ({
      marginBottom: 4,
      fontSize: 13,
      color: 'var(--semi-color-text-1)',
    }),
    [],
  );

  return (
    <Modal
      title={t('填入 CC Switch')}
      visible={visible}
      onCancel={onClose}
      onOk={handleSubmit}
      okText={t('打开 CC Switch')}
      cancelText={t('取消')}
      maskClosable={false}
      width={480}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={fieldLabelStyle}>{t('应用')}</div>
          <RadioGroup
            type='button'
            value={app}
            onChange={(e) => handleAppChange(e.target.value)}
            style={{ width: '100%' }}
          >
            {Object.entries(APP_CONFIGS).map(([key, cfg]) => (
              <Radio key={key} value={key}>
                {cfg.label}
              </Radio>
            ))}
          </RadioGroup>
        </div>

        <div>
          <div style={fieldLabelStyle}>{t('名称')}</div>
          <Input
            value={name}
            onChange={setName}
            placeholder={currentConfig.defaultName}
          />
        </div>

        {currentConfig.modelFields.map((field) => (
          <div key={field.key}>
            <div style={fieldLabelStyle}>
              {t(field.label)}
            </div>
            <Select
              placeholder={t('无特殊需求请留空')}
              optionList={modelOptions}
              value={models[field.key] || undefined}
              onChange={(val) => handleModelChange(field.key, val)}
              filter={selectFilter}
              style={{ width: '100%' }}
              showClear
              searchable
              emptyContent={t('暂无数据')}
            />
          </div>
        ))}

        <div style={{
          borderTop: '1px solid var(--semi-color-border)',
          paddingTop: 12,
        }}>
          <Checkbox
            checked={includeUsage}
            onChange={(e) => setIncludeUsage(e.target.checked)}
          >
            {t('同时导入余额查询')}
            {loadingToken && (
              <Spin size='small' style={{ marginLeft: 8 }} />
            )}
          </Checkbox>
          {includeUsage && !loadingToken && !accessToken && (
            <Typography.Text
              type='warning'
              size='small'
              style={{ display: 'block', marginTop: 4, marginLeft: 24 }}
            >
              {t('获取访问令牌失败，余额查询将不可用')}
            </Typography.Text>
          )}
        </div>
      </div>
    </Modal>
  );
}
