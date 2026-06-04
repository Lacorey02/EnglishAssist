const store = require("../../utils/store");

Page({
  data: {
    teacherName: "",
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

    const teacherProfile = store.getTeacherProfileByAccountId(account.id);
    this.setData({
      accountId: this.accountId || account.id
    });
    if (teacherProfile && !this.data.teacherName) {
      this.setData({
        teacherName: teacherProfile.name === "老师" ? "" : teacherProfile.name
      });
    }
  },

  onTeacherNameInput(event) {
    this.setData({ teacherName: event.detail.value });
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

    const teacherName = (this.data.teacherName || "").trim();
    const code = store.normalizeClassCode(this.data.classCode);
    if (teacherName.length < 2 || teacherName.length > 20) {
      wx.showToast({
        title: "老师姓名需为 2 到 20 个字符",
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
      const result = store.joinClassAsTeacher({
        accountId: account.id,
        name: teacherName,
        code
      });
      wx.showToast({
        title: "已加入班级",
        icon: "success"
      });
      wx.redirectTo({
        url: "/pages/classDetail/classDetail?role=teacher&classId=" + result.classInfo.id
          + "&accountId=" + account.id
      });
    } catch (error) {
      let title = "加入失败，请重试";
      if (error.message === "CLASS_NOT_FOUND") {
        title = "班级代号不存在";
      } else if (error.message === "TEACHER_ALREADY_OWNER") {
        title = "你已是创建老师";
      } else if (error.message === "TEACHER_ALREADY_JOINED") {
        title = "你已加入该班级";
      }
      wx.showToast({
        title,
        icon: "none"
      });
    }
  }
});
