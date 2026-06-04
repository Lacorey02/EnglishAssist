const store = require("../../utils/store");

Page({
  onShow() {
    const account = store.getCurrentAccount();
    wx.redirectTo({
      url: store.getDefaultEntryRoute(account)
    });
  },

  goTeacher() {
    wx.navigateTo({ url: "/pages/teacher/teacher" });
  },

  goStudent() {
    wx.navigateTo({ url: "/pages/studentHome/studentHome" });
  }
});
