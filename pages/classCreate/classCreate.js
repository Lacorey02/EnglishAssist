const store = require("../../utils/store");

Page({
  data: {
    teacherName: "",
    className: "",
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

  onNameInput(event) {
    this.setData({ className: event.detail.value });
  },

  onCodeInput(event) {
    this.setData({
      classCode: store.normalizeClassCode(event.detail.value)
    });
  },

  generateCode() {
    const code = store.generateClassCode();
    if (!code) {
      wx.showToast({
        title: "暂时没有生成可用代号，请稍后重试或手动输入",
        icon: "none"
      });
      return;
    }
    this.setData({ classCode: code });
  },

  createClass() {
    const account = store.getCurrentAccount();
    if (!account) {
      wx.redirectTo({ url: "/pages/login/login" });
      return;
    }

    const teacherName = (this.data.teacherName || "").trim();
    const name = (this.data.className || "").trim();
    const code = store.normalizeClassCode(this.data.classCode);

    if (teacherName.length < 2 || teacherName.length > 20) {
      wx.showToast({
        title: "老师姓名需为 2 到 20 个字符",
        icon: "none"
      });
      return;
    }

    if (name.length < 2 || name.length > 30) {
      wx.showToast({
        title: "班级名需为 2 到 30 个字符",
        icon: "none"
      });
      return;
    }

    if (!/^[A-Z0-9]{4,8}$/.test(code)) {
      wx.showToast({
        title: "代号需为 4 到 8 位大写字母或数字",
        icon: "none"
      });
      return;
    }
    if (!store.isClassCodeAvailable(code)) {
      wx.showToast({
        title: "班级代号已存在，请更换一个代号",
        icon: "none"
      });
      return;
    }

    try {
      const teacherProfile = store.ensureTeacherProfile(account.id, teacherName);
      const classInfo = store.createClass({
        name,
        code,
        teacherAccountId: account.id,
        teacherProfileId: teacherProfile.id,
        teacherName: teacherProfile.name
      });

      wx.redirectTo({
        url: "/pages/classDetail/classDetail?role=teacher&classId=" + classInfo.id
          + "&accountId=" + account.id
      });
    } catch (error) {
      wx.showToast({
        title: error.message === "CLASS_CODE_TAKEN" ? "班级代号已存在，请更换一个代号" : "创建失败，请重试",
        icon: "none"
      });
    }
  }
});
