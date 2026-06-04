const store = require("../../utils/store");

Page({
  onShow() {
    const account = store.getCurrentAccount();
    if (account) {
      wx.redirectTo({ url: store.getDefaultEntryRoute(account) });
    }
  },

  goAccountLogin() {
    wx.navigateTo({ url: "/pages/accountLogin/accountLogin" });
  },

  goAccountRegister() {
    wx.navigateTo({ url: "/pages/accountRegister/accountRegister" });
  }
});
