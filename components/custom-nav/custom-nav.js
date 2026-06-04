const theme = require("../../utils/theme");

const DEFAULT_METRICS = {
  statusBarHeight: 20,
  navBarHeight: 44,
  totalHeight: 64,
  rightInset: 96,
  titleSideInset: 96
};

function getNavigationMetrics() {
  const app = typeof getApp === "function" ? getApp() : null;
  if (app && app.globalData && app.globalData.navMetrics) {
    return app.globalData.navMetrics;
  }

  try {
    const systemInfo = wx.getSystemInfoSync ? wx.getSystemInfoSync() : {};
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect
      ? wx.getMenuButtonBoundingClientRect()
      : null;
    const statusBarHeight = systemInfo.statusBarHeight || DEFAULT_METRICS.statusBarHeight;
    const navBarHeight = menuButtonInfo
      ? (menuButtonInfo.top - statusBarHeight) * 2 + menuButtonInfo.height
      : DEFAULT_METRICS.navBarHeight;
    const rightInset = menuButtonInfo && systemInfo.windowWidth
      ? systemInfo.windowWidth - menuButtonInfo.left + 8
      : DEFAULT_METRICS.rightInset;

    return {
      statusBarHeight,
      navBarHeight,
      totalHeight: statusBarHeight + navBarHeight,
      rightInset,
      titleSideInset: Math.max(DEFAULT_METRICS.titleSideInset, rightInset)
    };
  } catch (error) {
    return DEFAULT_METRICS;
  }
}

Component({
  properties: {
    title: {
      type: String,
      value: ""
    },
    showBack: {
      type: Boolean,
      value: false
    },
    showHome: {
      type: Boolean,
      value: false
    },
    homeUrl: {
      type: String,
      value: "/pages/login/login"
    },
    fallbackUrl: {
      type: String,
      value: "/pages/login/login"
    },
    themeMode: {
      type: String,
      value: "",
      observer(mode) {
        this.setData({
          themeClass: theme.getThemeClass(mode)
        });
      }
    }
  },

  data: {
    themeClass: theme.getThemeClass(),
    statusBarHeight: DEFAULT_METRICS.statusBarHeight,
    navBarHeight: DEFAULT_METRICS.navBarHeight,
    totalHeight: DEFAULT_METRICS.totalHeight,
    rightInset: DEFAULT_METRICS.rightInset,
    titleSideInset: DEFAULT_METRICS.titleSideInset,
    canGoBack: false
  },

  lifetimes: {
    attached() {
      this.syncNav();
    }
  },

  pageLifetimes: {
    show() {
      this.syncNav();
    }
  },

  methods: {
    syncNav() {
      const metrics = getNavigationMetrics();
      const pages = typeof getCurrentPages === "function" ? getCurrentPages() : [];
      theme.applyThemeToComponent(this);
      this.setData({
        ...metrics,
        canGoBack: pages.length > 1
      });
    },

    goBack() {
      const pages = typeof getCurrentPages === "function" ? getCurrentPages() : [];
      if (pages.length > 1) {
        wx.navigateBack();
        return;
      }

      wx.redirectTo({ url: this.data.fallbackUrl || "/pages/login/login" });
    },

    goHome() {
      wx.redirectTo({ url: this.data.homeUrl || "/pages/login/login" });
    }
  }
});
