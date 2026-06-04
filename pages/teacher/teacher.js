const store = require("../../utils/store");

Page({
  data: {
    teacherProfile: null,
    classes: [],
    accountId: "",
    classId: ""
  },

  onLoad(options) {
    this.accountId = options.accountId || "";
  },

  onShow() {
    this.loadPage();
  },

  loadPage() {
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
      teacherRole: store.getTeacherRoleInClass(classInfo.id, teacherProfile.id),
      roleLabel: store.isClassOwner(classInfo.id, teacherProfile.id) ? "创建者" : "协作老师"
    }));

    this.setData({
      teacherProfile,
      classes,
      accountId: this.accountId || account.id,
      classId: classes[0] ? classes[0].id : ""
    });
  },

  openClass(event) {
    const accountId = this.data.accountId;
    wx.navigateTo({
      url: "/pages/classDetail/classDetail?role=teacher&classId="
        + event.currentTarget.dataset.classId
        + "&accountId=" + accountId
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

  logout() {
    store.clearCurrentSession();
    wx.redirectTo({ url: "/pages/login/login" });
  }
});
