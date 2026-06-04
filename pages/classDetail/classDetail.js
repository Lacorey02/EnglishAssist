const store = require("../../utils/store");

Page({
  data: {
    classInfo: null,
    teacherProfile: null,
    students: [],
    tasks: [],
    role: "teacher",
    accountId: "",
    teacherRole: "",
    permissionLabel: "",
    canPublishTask: false,
    deleteTaskModalVisible: false,
    pendingDeleteTask: null
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

    const teacherProfile = store.ensureTeacherProfile(account.id);
    const classInfo = store.getClassById(this.classId);
    const teacherRole = classInfo ? store.getTeacherRoleInClass(classInfo.id, teacherProfile.id) : "";
    if (!classInfo || !teacherRole) {
      this.setData({ classInfo: null, teacherProfile: null, students: [], tasks: [] });
      return;
    }

    wx.setNavigationBarTitle({ title: classInfo.name });
    this.setData({
      classInfo,
      teacherProfile: store.getTeacherProfileById(classInfo.ownerTeacherProfileId || classInfo.teacherProfileId),
      students: store.getStudentsByClassId(classInfo.id),
      tasks: store.getTasksByClassId(classInfo.id),
      role: "teacher",
      teacherRole,
      permissionLabel: teacherRole === "owner" ? "创建者" : "协作老师",
      canPublishTask: store.canPublishTask(classInfo.id, teacherProfile.id),
      accountId: this.accountId || account.id,
      deleteTaskModalVisible: false,
      pendingDeleteTask: null
    });
  },

  publishTask() {
    if (!this.data.classInfo || !this.data.canPublishTask) {
      return;
    }
    wx.navigateTo({
      url: "/pages/taskPublish/taskPublish?role=teacher&classId=" + this.data.classInfo.id
        + "&accountId=" + this.data.accountId
    });
  },

  openReport(event) {
    wx.navigateTo({
      url: "/pages/report/report?role=teacher&taskId=" + event.currentTarget.dataset.taskId
        + "&classId=" + this.data.classInfo.id
        + "&accountId=" + this.data.accountId
    });
  },

  askDeleteTask(event) {
    if (!this.data.canPublishTask) {
      return;
    }

    const taskId = event.currentTarget.dataset.taskId;
    const pendingDeleteTask = this.data.tasks.find((item) => item.id === taskId) || null;
    if (!pendingDeleteTask) {
      return;
    }

    this.setData({
      deleteTaskModalVisible: true,
      pendingDeleteTask
    });
  },

  cancelDeleteTask() {
    this.setData({
      deleteTaskModalVisible: false,
      pendingDeleteTask: null
    });
  },

  confirmDeleteTask() {
    const task = this.data.pendingDeleteTask;
    if (!task) {
      this.cancelDeleteTask();
      return;
    }

    store.softDeleteTask(task.id);
    wx.showToast({
      title: "任务已删除",
      icon: "none"
    });
    this.loadClass();
  },

  noop() {},

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
      url: "/pages/mine/mine?role=teacher&classId=" + this.data.classInfo.id
        + "&accountId=" + (account ? account.id : "")
    });
  }
});
