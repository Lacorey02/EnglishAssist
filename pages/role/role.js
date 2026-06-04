const store = require("../../utils/store");

Page({
  data: {
    account: null
  },

  onShow() {
    const account = store.getCurrentAccount();
    if (!account) {
      wx.redirectTo({ url: "/pages/login/login" });
      return;
    }

    this.setData({ account });
  },

  chooseTeacher() {
    const account = store.getCurrentAccount();
    if (!account) {
      wx.redirectTo({ url: "/pages/login/login" });
      return;
    }

    store.setLastSelectedRole("teacher");
    store.ensureTeacherProfile(account.id);
    wx.redirectTo({ url: "/pages/teacher/teacher?role=teacher&accountId=" + account.id });
  },

  chooseStudent() {
    const account = store.getCurrentAccount();
    if (!account) {
      wx.redirectTo({ url: "/pages/login/login" });
      return;
    }

    store.setLastSelectedRole("student");
    wx.redirectTo({ url: store.getStudentDefaultRoute(account.id) });
  }
});
