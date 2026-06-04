const store = require("../../utils/store");

Page({
  data: {
    username: "",
    password: "",
    confirmPassword: ""
  },

  onUsernameInput(event) {
    this.setData({ username: event.detail.value });
  },

  onPasswordInput(event) {
    this.setData({ password: event.detail.value });
  },

  onConfirmPasswordInput(event) {
    this.setData({ confirmPassword: event.detail.value });
  },

  register() {
    const username = store.normalizeUsername(this.data.username);
    const password = this.data.password || "";
    const confirmPassword = this.data.confirmPassword || "";

    if (!username) {
      wx.showToast({
        title: "请输入用户名",
        icon: "none"
      });
      return;
    }

    if (store.isUsernameTaken(username)) {
      wx.showToast({
        title: "用户名已存在",
        icon: "none"
      });
      return;
    }

    if (!password) {
      wx.showToast({
        title: "请输入密码",
        icon: "none"
      });
      return;
    }

    if (password !== confirmPassword) {
      wx.showToast({
        title: "两次输入的密码不一致",
        icon: "none"
      });
      return;
    }

    store.registerAccount({ username, password });
    wx.redirectTo({ url: "/pages/role/role" });
  },

  goLogin() {
    wx.redirectTo({ url: "/pages/accountLogin/accountLogin" });
  }
});
