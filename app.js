const cloudService = require("./utils/cloud-service");
const theme = require("./utils/theme");

const nativePage = Page;
const initialThemeMode = theme.getThemeMode();

function getNavigationMetrics() {
  const defaultMetrics = {
    statusBarHeight: 20,
    navBarHeight: 44,
    totalHeight: 64,
    rightInset: 96,
    titleSideInset: 96,
    menuButtonInfo: null
  };

  try {
    const systemInfo = wx.getSystemInfoSync ? wx.getSystemInfoSync() : {};
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect
      ? wx.getMenuButtonBoundingClientRect()
      : null;
    const statusBarHeight = systemInfo.statusBarHeight || defaultMetrics.statusBarHeight;
    const navBarHeight = menuButtonInfo
      ? (menuButtonInfo.top - statusBarHeight) * 2 + menuButtonInfo.height
      : defaultMetrics.navBarHeight;
    const rightInset = menuButtonInfo && systemInfo.windowWidth
      ? systemInfo.windowWidth - menuButtonInfo.left + 8
      : defaultMetrics.rightInset;

    return {
      statusBarHeight,
      navBarHeight,
      totalHeight: statusBarHeight + navBarHeight,
      rightInset,
      titleSideInset: Math.max(defaultMetrics.titleSideInset, rightInset),
      menuButtonInfo
    };
  } catch (error) {
    return defaultMetrics;
  }
}

Page = function createThemedPage(config) {
  const originalOnLoad = config.onLoad;
  const originalOnShow = config.onShow;
  const pageThemeMode = theme.getThemeMode();

  config.data = {
    themeMode: pageThemeMode,
    themeClass: theme.getThemeClass(pageThemeMode),
    ...(config.data || {})
  };

  config.onLoad = function themedOnLoad(options) {
    theme.applyThemeToPage(this);
    if (originalOnLoad) {
      return originalOnLoad.call(this, options);
    }
    return undefined;
  };

  config.onShow = function themedOnShow() {
    theme.applyThemeToPage(this);
    if (originalOnShow) {
      return originalOnShow.apply(this, arguments);
    }
    return undefined;
  };

  return nativePage(config);
};

App({
  globalData: {
    cloudReady: false,
    themeMode: initialThemeMode,
    navMetrics: getNavigationMetrics()
  },

  onLaunch() {
    this.globalData.navMetrics = getNavigationMetrics();
    this.syncTheme();
    this.globalData.cloudReady = cloudService.initCloud();
  },

  onShow() {
    this.syncTheme();
  },

  syncTheme() {
    this.globalData.themeMode = theme.applyRuntimeTheme();
  }
});
