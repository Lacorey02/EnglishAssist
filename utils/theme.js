const THEME_STORAGE_KEY = "english_assistant_theme";
const DARK_MODE = "dark";
const LIGHT_MODE = "light";
const DARK_PAGE_BG = "#101719";
const LIGHT_PAGE_BG = "#F8F7F1";
const LIGHT_PAGE_BG_BOTTOM = "#EDF4F8";

function normalizeMode(mode) {
  return mode === DARK_MODE ? DARK_MODE : LIGHT_MODE;
}

function getThemeMode() {
  const stored = wx.getStorageSync(THEME_STORAGE_KEY);
  if (stored && typeof stored === "object") {
    return normalizeMode(stored.mode);
  }
  return normalizeMode(stored);
}

function getThemeClass(mode) {
  return normalizeMode(mode || getThemeMode()) === DARK_MODE ? "theme-dark" : "theme-light";
}

function setThemeMode(mode) {
  const nextMode = normalizeMode(mode);
  wx.setStorageSync(THEME_STORAGE_KEY, {
    mode: nextMode
  });
  applyNavigationTheme(nextMode);
  return nextMode;
}

function toggleThemeMode() {
  return setThemeMode(getThemeMode() === DARK_MODE ? LIGHT_MODE : DARK_MODE);
}

function safeApply(api, payload) {
  if (typeof api !== "function") {
    return;
  }

  try {
    api(payload);
  } catch (error) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[theme] apply failed", error);
    }
  }
}

function applyNavigationTheme(mode) {
  const nextMode = normalizeMode(mode || getThemeMode());
  const isDark = nextMode === DARK_MODE;
  const topColor = isDark ? DARK_PAGE_BG : LIGHT_PAGE_BG;
  safeApply(wx.setNavigationBarColor, {
    frontColor: isDark ? "#ffffff" : "#000000",
    backgroundColor: topColor
  });
  safeApply(wx.setBackgroundColor, {
    backgroundColor: topColor,
    backgroundColorTop: topColor,
    backgroundColorBottom: isDark ? DARK_PAGE_BG : LIGHT_PAGE_BG_BOTTOM
  });
  safeApply(wx.setBackgroundTextStyle, {
    textStyle: isDark ? "light" : "dark"
  });

  return nextMode;
}

function applyRuntimeTheme(mode) {
  return applyNavigationTheme(mode);
}

function getThemePageBackground(mode) {
  return normalizeMode(mode || getThemeMode()) === DARK_MODE ? DARK_PAGE_BG : LIGHT_PAGE_BG;
}

function getThemeWindowMeta(mode) {
  const nextMode = normalizeMode(mode || getThemeMode());
  const isDark = nextMode === DARK_MODE;
  return {
    frontColor: nextMode === DARK_MODE ? "#ffffff" : "#000000",
    backgroundColor: isDark ? DARK_PAGE_BG : LIGHT_PAGE_BG,
    backgroundColorBottom: isDark ? DARK_PAGE_BG : LIGHT_PAGE_BG_BOTTOM
  };
}

function applyThemeToTarget(target) {
  const mode = getThemeMode();
  applyNavigationTheme(mode);
  if (target && target.setData) {
    target.setData({
      themeMode: mode,
      themeClass: getThemeClass(mode)
    });
  }
  return mode;
}

module.exports = {
  DARK_MODE,
  LIGHT_MODE,
  applyNavigationTheme,
  applyRuntimeTheme,
  applyThemeToComponent: applyThemeToTarget,
  applyThemeToPage: applyThemeToTarget,
  getThemeClass,
  getThemeMode,
  getThemePageBackground,
  getThemeWindowMeta,
  setThemeMode,
  toggleThemeMode
};
