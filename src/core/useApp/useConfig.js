const defaultSettings = {
  'network.proxy.enable': false,
  'network.proxy.host': '',
  'network.proxy.port': '',
  'common.apiSource': 'tx',
  'common.startInFullscreen': false,
  'theme.id': 'default',
  'common.fontSize': 14,
  'common.isAgreePact': false,
};

let appSetting = { ...defaultSettings };

function setAppSetting(newSettings) {
  appSetting = { ...appSetting, ...newSettings };
  console.log('[useConfig] Settings updated:', newSettings);
  return appSetting;
}

function getAppSetting(key) {
  if (key) {
    return appSetting[key];
  }
  return { ...appSetting };
}

function updateSetting(key, value) {
  appSetting[key] = value;
  console.log('[useConfig] Setting updated:', { key, value });
  return appSetting;
}

export { appSetting, setAppSetting, getAppSetting, updateSetting };
