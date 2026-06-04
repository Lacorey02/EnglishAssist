const store = require("../../utils/store");

Page({
  data: {
    studentName: "",
    classCode: "",
    accountId: ""
  },

  onLoad(options) {
    this.accountId = options.accountId || "";
  },

  onShow() {
    const account = store.getCurrentAccount();
    if (!account) {
      wx.redirectTo({ url: "/pages/login/login" });
      return;
    }

    const studentProfile = store.getStudentProfileByAccountId(account.id);
    this.setData({
      accountId: this.accountId || account.id
    });
    if (studentProfile && !this.data.studentName) {
      this.setData({
        studentName: studentProfile.name || ""
      });
    }
  },

  onNameInput(event) {
    this.setData({ studentName: event.detail.value });
  },

  onCodeInput(event) {
    this.setData({
      classCode: store.normalizeClassCode(event.detail.value)
    });
  },

  joinClass() {
    const account = store.getCurrentAccount();
    if (!account) {
      wx.redirectTo({ url: "/pages/login/login" });
      return;
    }

    const name = (this.data.studentName || "").trim();
    const code = store.normalizeClassCode(this.data.classCode);

    if (name.length < 2 || name.length > 20) {
      wx.showToast({
        title: "请填写 2 到 20 个字符的学生姓名",
        icon: "none"
      });
      return;
    }

    if (!code) {
      wx.showToast({
        title: "请填写班级代号",
        icon: "none"
      });
      return;
    }

    try {
      const result = store.joinClass({
        accountId: account.id,
        name,
        code
      });
      const joinedClasses = store.getJoinedClassesByStudentAccountId(account.id);

      wx.redirectTo({
        url: joinedClasses.length > 1
          ? "/pages/studentHome/studentHome?role=student&accountId=" + account.id
          : "/pages/studentClass/studentClass?role=student&classId=" + result.classInfo.id
            + "&accountId=" + account.id
      });
    } catch (error) {
      let title = "加入失败，请重试";
      if (error.message === "CLASS_NOT_FOUND") {
        title = "班级代号不存在";
      }
      wx.showToast({ title, icon: "none" });
    }
  },

  logout() {
    store.clearCurrentSession();
    wx.redirectTo({ url: "/pages/login/login" });
  }
});
