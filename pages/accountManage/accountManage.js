const store = require("../../utils/store");

Page({
  data: {
    account: null,
    phone: "",
    phoneLabel: "未绑定手机号",
    role: "",
    classId: "",
    accountId: ""
  },

  onLoad(options) {
    this.role = options.role || "";
    this.classId = options.classId || "";
    this.accountId = options.accountId || "";
  },

  onShow() {
    this.loadAccount();
  },

  loadAccount() {
    const current = store.getCurrentAccount();
    if (!current) {
      wx.redirectTo({ url: "/pages/login/login" });
      return;
    }

    const account = store.getAccountProfile(current.id);
    this.setData({
      account,
      phone: account.phone || "",
      phoneLabel: account.phone || "未绑定手机号",
      role: this.role,
      classId: this.classId,
      accountId: this.accountId || current.id
    });
  },

  onPhoneInput(event) {
    this.setData({ phone: event.detail.value });
  },

  savePhone() {
    const phone = String(this.data.phone || "").trim();
    if (phone && !/^1\d{10}$/.test(phone)) {
      wx.showToast({
        title: "请输入 11 位手机号",
        icon: "none"
      });
      return;
    }

    store.updateAccountPhone(this.data.account.id, phone);
    wx.showToast({
      title: "已保存",
      icon: "success"
    });
    this.loadAccount();
  }
});
