const CLOUD_ENV_ID = "";

let cloudChecked = false;
let cloudAvailable = false;
let cloudErrorMessage = "";

function getCloudInitOptions() {
  const options = {
    traceUser: true
  };

  if (CLOUD_ENV_ID) {
    options.env = CLOUD_ENV_ID;
  }

  return options;
}

function normalizeCloudError(error) {
  const message = error && (error.errMsg || error.message);
  if (!message) {
    return "云开发服务暂未配置";
  }

  if (message.indexOf("Cloud API isn't enabled") >= 0 || message.indexOf("wx.cloud.init") >= 0) {
    return "云开发服务暂未配置";
  }

  return "云开发服务暂不可用";
}

function initCloud() {
  if (cloudChecked && cloudAvailable) {
    return true;
  }

  if (typeof wx === "undefined" || !wx.cloud || !wx.cloud.init) {
    cloudChecked = true;
    cloudAvailable = false;
    cloudErrorMessage = "云开发服务暂未配置";
    return false;
  }

  if (!CLOUD_ENV_ID) {
    cloudChecked = true;
    cloudAvailable = false;
    cloudErrorMessage = "云开发环境 ID 未配置";
    return false;
  }

  try {
    cloudChecked = true;
    wx.cloud.init(getCloudInitOptions());
    cloudAvailable = true;
    cloudErrorMessage = "";
  } catch (error) {
    cloudAvailable = false;
    cloudErrorMessage = normalizeCloudError(error);
  }

  return cloudAvailable;
}

function canUseCloudFunction() {
  if (!initCloud()) {
    return false;
  }

  return !!(
    typeof wx !== "undefined" &&
    wx.cloud &&
    wx.cloud.callFunction
  );
}

function canUseCloudUpload() {
  if (!canUseCloudFunction()) {
    return false;
  }

  return !!(wx.cloud && wx.cloud.uploadFile);
}

function getUnavailableMessage(serviceName) {
  return "云开发服务暂不可用：" + (serviceName || "云服务") + "暂未配置，请先手动处理";
}

function getCloudErrorMessage(fallback) {
  return cloudErrorMessage || fallback || "云开发服务暂不可用";
}

function getCloudFeatureNotice() {
  return getCloudErrorMessage("云开发服务暂不可用") +
    "。语音识别、在线词典和翻译兜底依赖云函数；当前仍可使用本地词库和手动补充释义。常见原因：云环境未开通、环境 ID 为空或错误、云函数未上传部署。";
}

module.exports = {
  canUseCloudFunction,
  canUseCloudUpload,
  getCloudFeatureNotice,
  getCloudErrorMessage,
  getUnavailableMessage,
  initCloud,
  normalizeCloudError
};
