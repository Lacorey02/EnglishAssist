const store = require("../../utils/store");

Page({
  data: {
    username: "",
    password: ""
  },

  onUsernameInput(event) {
    this.setData({ username: event.detail.value });
  },

  onPasswordInput(event) {
    this.setData({ password: event.detail.value });
  },

  login() {
    const username = store.normalizeUsername(this.data.username);
    const password = this.data.password || "";

    if (!username || !password) {
      wx.showToast({
        title: "请输入用户名和密码",
        icon: "none"
      });
      return;
    }

    try {
      const account = store.loginAccount({ username, password });
      wx.redirectTo({ url: store.getDefaultEntryRoute(account) });
    } catch (error) {
      wx.showToast({
        title: error.message === "USERNAME_NOT_FOUND" ? "用户名不存在" : "密码错误",
        icon: "none"
      });
    }
  },

  goRegister() {
    wx.redirectTo({ url: "/pages/accountRegister/accountRegister" });
  }
});
