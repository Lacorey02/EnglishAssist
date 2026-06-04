const store = require("../../utils/store");
const theme = require("../../utils/theme");

Page({
  data: {
    account: null,
    role: "",
    roleLabel: "",
    classId: "",
    accountId: "",
    avatarText: "U",
    themeSwitchOn: false
  },

  onLoad(options) {
    this.role = options.role || "";
    this.classId = options.classId || "";
    this.accountId = options.accountId || "";
  },

  onShow() {
    const account = store.getCurrentAccount();
    if (!account) {
      wx.redirectTo({ url: "/pages/login/login" });
      return;
    }

    this.setData({
      account: store.getAccountProfile(account.id),
      role: this.role,
      roleLabel: this.role === "teacher" ? "老师" : "学生",
      classId: this.classId,
      accountId: this.accountId || account.id,
      avatarText: (account.username || account.displayName || "U").slice(0, 1).toUpperCase(),
      themeSwitchOn: theme.getThemeMode() === theme.DARK_MODE
    });
  },

  openAccount() {
    wx.navigateTo({
      url: "/pages/accountManage/accountManage?role=" + this.data.role
        + "&classId=" + this.data.classId
        + "&accountId=" + this.data.accountId
    });
  },

  openClasses() {
    wx.navigateTo({
      url: "/pages/classManage/classManage?role=" + this.data.role
        + "&classId=" + this.data.classId
        + "&accountId=" + this.data.accountId
    });
  },

  switchRole() {
    wx.showModal({
      title: "切换身份？",
      content: "切换后会进入另一个身份的主页，当前账号不会退出登录。",
      confirmText: "切换",
      cancelText: "取消",
      success: (res) => {
        if (res.confirm) {
          wx.redirectTo({ url: "/pages/role/role" });
        }
      }
    });
  },

  toggleThemeMode() {
    const nextMode = theme.toggleThemeMode();
    this.applyThemeSwitch(nextMode);
  },

  onThemeSwitchChange(event) {
    const nextMode = event.detail.value ? theme.DARK_MODE : theme.LIGHT_MODE;
    theme.setThemeMode(nextMode);
    this.applyThemeSwitch(nextMode);
  },

  applyThemeSwitch(nextMode) {
    theme.applyThemeToPage(this);
    this.setData({
      themeSwitchOn: nextMode === theme.DARK_MODE
    });

    const bottomNav = this.selectComponent && this.selectComponent("#bottomNav");
    if (bottomNav) {
      theme.applyThemeToComponent(bottomNav);
    }
  },

  noop() {},

  logout() {
    store.clearCurrentSession();
    wx.redirectTo({ url: "/pages/login/login" });
  }
});
