const store = require("../../utils/store");

Page({
  data: {
    classes: [],
    accountId: "",
    classId: ""
  },

  onLoad(options) {
    this.accountId = options.accountId || "";
  },

  onShow() {
    this.loadClasses();
  },

  loadClasses() {
    const account = store.getCurrentAccount();
    if (!account) {
      wx.redirectTo({ url: "/pages/login/login" });
      return;
    }

    const teacherProfile = store.ensureTeacherProfile(account.id);
    const classes = store.getTeacherClassesByAccountId(account.id).map((classInfo) => ({
      ...classInfo,
      teacherName: classInfo.teacherMembers && classInfo.teacherMembers[0]
        ? classInfo.teacherMembers[0].teacherName
        : "老师",
      studentCount: (classInfo.studentIds || []).length,
      roleLabel: store.isClassOwner(classInfo.id, teacherProfile.id) ? "创建者" : "协作老师"
    }));
    this.setData({
      accountId: this.accountId || account.id,
      classId: classes[0] ? classes[0].id : "",
      classes
    });
  },

  openClass(event) {
    wx.navigateTo({
      url: "/pages/classDetail/classDetail?role=teacher&classId="
        + event.currentTarget.dataset.classId
        + "&accountId=" + this.data.accountId
    });
  },

  goCreateClass() {
    wx.navigateTo({
      url: "/pages/classCreate/classCreate?role=teacher&accountId=" + this.data.accountId
    });
  },

  goJoinClass() {
    wx.navigateTo({
      url: "/pages/teacherJoin/teacherJoin?role=teacher&accountId=" + this.data.accountId
    });
  },

  goTeacherHome() {
    wx.navigateBack();
  }
});
