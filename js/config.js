// ============================================================
//  White Horse & Noodle Bar — 云订单设置 (Cloud orders setup)
//  填好下面的 4 个值，网站下单才会自动出现在你的订单面板。
//  怎么拿到这 4 个值：见聊天里我给你的"设置步骤"（第 3 步）。
// ============================================================
//  如果 apiKey 留空，网站就只走 WhatsApp / Email，不影响现有功能。
window.FB_CONFIG = {
  apiKey: "",            // 例：AIzaSyA1B2C3D4... （Firebase 项目 Web API key）
  authDomain: "",        // 例：white-horse-orders.firebaseapp.com
  databaseURL: "",       // 例：https://white-horse-orders-default-rtdb.firebaseio.com
  projectId: ""          // 例：white-horse-orders
};

// 订单面板的门牌密码（在网址 dashboard.html?k=这里 里用），
// 防陌生人误入后台。真正的订单数据还要 Google 账号登录保护。
window.DASH_KEY = "WhiteHorse37";