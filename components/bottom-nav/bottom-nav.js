const store = require("../../utils/store");
const theme = require("../../utils/theme");

function buildQuery(params) {
  return Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== "")
    .map((key) => key + "=" + encodeURIComponent(params[key]))
    .join("&");
}

Component({
  data: {
    themeClass: theme.getThemeClass()
  },

  properties: {
    active: {
      type: String,
      value: "home"
    },
    role: {
      type: String,
      value: ""
    },
    classId: {
      type: String,
      value: ""
    },
    accountId: {
      type: String,
      value: ""
    }
  },

  lifetimes: {
    attached() {
      theme.applyThemeToComponent(this);
    }
  },

  pageLifetimes: {
    show() {
      theme.applyThemeToComponent(this);
    }
  },

  methods: {
    getAccountId() {
      if (this.data.accountId) {
        return this.data.accountId;
      }
      const account = store.getCurrentAccount();
      return account ? account.id : "";
    },

    goHome() {
      const role = this.data.role;
      const accountId = this.getAccountId();
      if (!role) {
        return;
      }

      const url = role === "teacher"
        ? "/pages/teacher/teacher?" + buildQuery({ role, accountId })
        : store.getStudentDefaultRoute(accountId);
      wx.redirectTo({ url });
    },

    goMine() {
      const role = this.data.role;
      const classId = this.data.classId;
      if (!role || this.data.active === "mine") {
        return;
      }

      wx.redirectTo({
        url: "/pages/mine/mine?" + buildQuery({
          role,
          classId,
          accountId: this.getAccountId()
        })
      });
    }
  }
});
