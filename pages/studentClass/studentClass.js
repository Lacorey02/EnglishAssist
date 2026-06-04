const store = require("../../utils/store");

Page({
  data: {
    pageState: "loading",
    classInfo: null,
    teacherProfile: null,
    studentProfile: null,
    taskCount: 0,
    completedCount: 0,
    accountId: "",
    errorText: ""
  },

  onLoad(options) {
    this.classId = options.classId || "";
    this.accountId = options.accountId || "";
  },

  onShow() {
    this.loadClass();
  },

  loadClass() {
    const account = store.getCurrentAccount();
    if (!account) {
      wx.redirectTo({ url: "/pages/login/login" });
      return;
    }

    const studentProfile = store.getStudentProfileByAccountId(account.id);
    if (!studentProfile || !studentProfile.joinedClassIds || !studentProfile.joinedClassIds.length) {
      wx.redirectTo({
        url: "/pages/studentHome/studentHome?role=student&accountId=" + account.id
      });
      return;
    }

    const classId = this.classId || studentProfile.joinedClassId || studentProfile.joinedClassIds[0];
    if (!classId) {
      wx.redirectTo({
        url: "/pages/studentHome/studentHome?role=student&accountId=" + account.id
      });
      return;
    }
    this.classId = classId;

    const classInfo = store.getClassById(classId);
    if (!classInfo) {
      this.setData({
        pageState: "error",
        classInfo: null,
        teacherProfile: null,
        studentProfile,
        taskCount: 0,
        completedCount: 0,
        accountId: this.accountId || account.id,
        errorText: "班级信息异常，请重新加入班级。"
      });
      return;
    }

    if (!store.isStudentInClass(studentProfile, classInfo.id)) {
      this.setData({
        pageState: "error",
        classInfo: null,
        teacherProfile: null,
        studentProfile,
        taskCount: 0,
        completedCount: 0,
        accountId: this.accountId || account.id,
        errorText: "当前学生不属于这个班级。"
      });
      return;
    }

    const tasks = store.getTasksByClassIdForStudent(classInfo.id, studentProfile.id);
    const completedCount = tasks.filter((task) => !!store.getSubmission(task.id, studentProfile.id)).length;
    wx.setNavigationBarTitle({ title: "班级" });
    this.setData({
      pageState: "ready",
      classInfo,
      teacherProfile: store.getTeacherProfileById(classInfo.teacherProfileId),
      studentProfile,
      taskCount: tasks.length,
      completedCount,
      accountId: this.accountId || account.id,
      errorText: ""
    });
  },

  goCheckin() {
    if (!this.data.classInfo) {
      return;
    }

    wx.navigateTo({
      url: "/pages/student/student?role=student&classId=" + this.data.classInfo.id
        + "&accountId=" + this.data.accountId
    });
  },

  rejoinClass() {
    const account = store.getCurrentAccount();
    if (account) {
      const studentProfile = store.getStudentProfileByAccountId(account.id);
      if (studentProfile && this.classId) {
        store.removeStudentClass(studentProfile.id, this.classId);
      } else {
        store.clearStudentJoinedClass(account.id);
      }
    }
    wx.redirectTo({
      url: "/pages/studentJoin/studentJoin?role=student&accountId=" + this.data.accountId
    });
  },

  goStudentHome() {
    wx.redirectTo({
      url: "/pages/studentHome/studentHome?role=student&accountId=" + this.data.accountId
    });
  },

  logout() {
    store.clearCurrentSession();
    wx.redirectTo({ url: "/pages/login/login" });
  },

  openMine() {
    if (!this.data.classInfo) {
      return;
    }
    const account = store.getCurrentAccount();
    wx.redirectTo({
      url: "/pages/mine/mine?role=student&classId=" + this.data.classInfo.id
        + "&accountId=" + (this.data.accountId || (account ? account.id : ""))
    });
  }
});
