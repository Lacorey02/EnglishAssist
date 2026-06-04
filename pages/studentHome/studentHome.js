const store = require("../../utils/store");

Page({
  data: {
    pageState: "loading",
    studentProfile: null,
    classes: [],
    accountId: "",
    errorText: ""
  },

  onLoad(options) {
    this.entryState = options.state || "";
    this.accountId = options.accountId || "";
  },

  onShow() {
    const account = store.getCurrentAccount();
    if (!account) {
      wx.redirectTo({ url: "/pages/login/login" });
      return;
    }

    const studentProfile = store.getStudentProfileByAccountId(account.id);
    const classes = store.getJoinedClassesByStudentAccountId(account.id);
    if (classes.length === 1) {
      wx.redirectTo({
        url: "/pages/studentClass/studentClass?role=student&classId=" + classes[0].id
          + "&accountId=" + account.id
      });
      return;
    }

    if (classes.length > 1) {
      this.setData({
        pageState: "list",
        studentProfile,
        classes,
        accountId: this.accountId || account.id,
        errorText: ""
      });
      return;
    }

    if (studentProfile && studentProfile.joinedClassIds && studentProfile.joinedClassIds.length) {
      this.setData({
        pageState: "error",
        studentProfile,
        classes: [],
        accountId: this.accountId || account.id,
        errorText: "班级信息异常，请重新加入班级。"
      });
      return;
    }

    this.setData({
      pageState: this.entryState === "classMissing" ? "error" : "empty",
      studentProfile,
      classes: [],
      accountId: this.accountId || account.id,
      errorText: this.entryState === "classMissing" ? "班级信息异常，请重新加入班级。" : ""
    });
  },

  goJoinClass() {
    const account = store.getCurrentAccount();
    if (account && this.data.pageState === "error") {
      store.clearStudentJoinedClass(account.id);
    }
    this.entryState = "";
    wx.navigateTo({
      url: "/pages/studentJoin/studentJoin?role=student&accountId=" + this.data.accountId
    });
  },

  openClass(event) {
    wx.redirectTo({
      url: "/pages/studentClass/studentClass?role=student&classId="
        + event.currentTarget.dataset.classId
        + "&accountId=" + this.data.accountId
    });
  },

  logout() {
    store.clearCurrentSession();
    wx.redirectTo({ url: "/pages/login/login" });
  }
});
