const API_URL =
  "https://script.google.com/macros/s/AKfycbzO4xAfw11aKclxz5xzo1A8F0zliCI_Wy59DV_N6XDfQ5NVRjlm171g33hoczYXqmf0gA/exec";

const RSVP_STATUS_MAP = {
  attending: "confirmed",
  unsure: "maybe",
  unable: "declined",
};

const DINNER_EXPERIENCE_COPY =
  "这一次的晚餐，我们希望节奏是舒服的。\n\n宾客入座后，第一道菜会由服务员送上。\n\n主菜会由 service team 送到每一桌，具体上菜节奏会根据当天的服务流程安排。\n\n甜点则会安排成 Dessert Table，让大家在晚宴后段可以比较轻松地自行取用。\n\n我们希望大家不用一直想着下一道流程，\n\n而是可以好好坐下来吃饭、聊天，也慢慢进入这个晚上。";

const DINNER_FORMAT_ITEMS = [
  "Served Starter",
  "Served Main Courses",
  "Dessert Table",
];

const WEDDING_DATETIME_FALLBACK = "2026-12-05T18:00:00+08:00";
const TABLE_RELEASE_DATE_FALLBACK = "2026-11-28";
const TABLE_LOCKED_COPY =
  "桌位会在婚礼前开放查询。现在先让你看看，那天会有哪些熟悉的人也会来到。";
const TABLE_RELEASED_COPY = "你的桌位已经开放查询。";
const TABLE_LOCKED_BODY =
  "我们会在接近婚礼时开放 Check Your Table。\n\n现在先让你看看，\n那天会有哪些熟悉的人也会来到。";
const TABLE_RELEASED_BODY =
  "婚礼当天，你会坐在这里。\n也许旁边有熟悉的人，也许也有一些新的面孔。\n希望这一桌，会让你觉得舒服。";

const MEMORY_SUCCESS_MESSAGE =
  "谢谢你留下这段记忆。\n我们会先看过，再放到同一群朋友的留言区。";

const SUBMISSION_ERROR_MESSAGE =
  "提交失败，请稍后再试，或直接联系 Louis / Joyce。";

// Local sample data stays here only as a fallback if the live API cannot load.
// This shape is intentionally close to the Google Sheets structure.
const sampleData = {
  settings: {
    visual_theme: "Soft Garden Evening",
    hero_copy:
      "我们没有想把婚礼做得很夸张。\n\n只是希望晚风、暖灯、舒服的座位、\n被认真安排的晚餐，\n以及每一个细节，\n\n都能让来到的人感觉到：\n\n这一天，\n我们真的有认真准备。",
    story_main_title: "有些相遇，会慢慢长成一生的决定。",
    story_meeting_copy:
      "我们从很普通的聊天开始，后来发现彼此都愿意把生活里细小的事认真听完。",
    story_wedding_day_copy:
      "这场婚礼不想很夸张。我们只是希望在晚风和暖灯之间，把最重要的承诺说给最重要的人听。",
    wedding_date_display: "2026年12月5日 · 星期六",
    wedding_start_time: "晚上 6:00 开始",
    venue_name: "億家主题宴会厅 · Hall E 露天草坪",
    venue_address:
      "8, Jln Adda 2, Taman Adda, 81100 Johor Bahru, Johor Darul Ta'zim, Malaysia",
    google_maps_url: "https://maps.app.goo.gl/tDacdw6Jo4zL5B4U6",
    waze_url:
      "https://ul.waze.com/ul?place=ChIJ6RCo4ONt2jER_oq6JM55BN8&ll=1.54910240%2C103.74597420&navigate=yes&utm_campaign=default&utm_source=waze_website&utm_medium=lm_share_location",
    dress_code: "Smart Formal / 正式得体即可",
    rsvp_deadline: "2026-10-31",
    dinner_style_title: "晚餐安排",
    dinner_format: "Served Starter + Served Main Courses + Dessert Table",
    dinner_copy: DINNER_EXPERIENCE_COPY,
    menu_status: "完整菜单确认后会再更新。",
    wedding_datetime_iso: WEDDING_DATETIME_FALLBACK,
    table_check_enabled: "no",
    table_release_date: TABLE_RELEASE_DATE_FALLBACK,
    table_locked_copy: TABLE_LOCKED_COPY,
    table_released_copy: TABLE_RELEASED_COPY,
  },
  guestTypes: {
    family: {
      label: "给家人",
      title: "{name}，谢谢你一路把我们放在心上。",
      message:
        "这一天对我们很重要，因为你会在场。我们想在晚风和暖灯里，好好向你说一声谢谢，也请你见证我们成为彼此的家人。",
    },
    colleagues: {
      label: "给同事",
      title: "{name}，很开心能把生活里重要的一面，也分享给你。",
      message:
        "平日里我们一起处理工作，这一次想邀请你来到更柔软的场景。愿这个晚上没有日程压力，只有祝福、晚风和一顿认真准备的晚餐。",
    },
    closeFriends: {
      label: "给挚友",
      title: "{name}，有些朋友，不需要太多解释就懂。",
      message:
        "我们想让你坐在离这一刻很近的地方。谢谢你见过我们的普通日子，也愿意来见证我们最郑重的一天。",
    },
    longLostFriends: {
      label: "给久别重逢的朋友",
      title: "{name}，这一晚也想把你带回我们身边。",
      message:
        "婚礼是这一晚的主角，但我们也悄悄期待那些久违的拥抱和一句“好久不见”。你的位置已经留好，希望十二月能在暖灯下重新见到你。",
    },
  },
  menu: [],
  tables: [
    {
      table_id: "chaos-committee",
      table_name: "The Chaos Committee",
      table_story:
        "这一桌为久未见面的朋友而设。你们不一定每天联系，但只要坐下来，很快就会想起以前为什么聊得那么开心。",
      table_theme: "温柔重逢、慢慢举杯、把旧话题聊成新的回忆。",
    },
    {
      table_id: "family-garden",
      table_name: "Family Garden Table",
      table_story:
        "这一桌留给一路陪伴两人成长的家人。很多承诺，其实早在日常照顾里就已经开始。",
      table_theme: "家人的见证、安静的骄傲、长久的祝福。",
    },
  ],
  guests: [
    {
      guest_id: "G001",
      token: "jason-a7k29x",
      guest_name: "Jason",
      guest_type: "longLostFriends",
      group_name: "university-friends",
      table_id: "chaos-committee",
      rsvp_status: "confirmed",
      pax_limit: 2,
    },
    {
      guest_id: "G002",
      token: "marcus-f4p81q",
      guest_name: "Marcus",
      guest_type: "longLostFriends",
      group_name: "university-friends",
      table_id: "chaos-committee",
      rsvp_status: "confirmed",
      pax_limit: 1,
    },
    {
      guest_id: "G003",
      token: "weijie-n6v42m",
      guest_name: "Wei Jie",
      guest_type: "longLostFriends",
      group_name: "university-friends",
      table_id: "chaos-committee",
      rsvp_status: "confirmed",
      pax_limit: 1,
    },
    {
      guest_id: "G004",
      token: "kelvin-h8s13b",
      guest_name: "Kelvin",
      guest_type: "longLostFriends",
      group_name: "university-friends",
      table_id: "chaos-committee",
      rsvp_status: "confirmed",
      pax_limit: 1,
    },
    {
      guest_id: "G005",
      token: "amanda-k5r18n",
      guest_name: "Amanda",
      guest_type: "closeFriends",
      group_name: "university-friends",
      table_id: "chaos-committee",
      rsvp_status: "confirmed",
      pax_limit: 1,
    },
    {
      guest_id: "G006",
      token: "rachel-p2d77u",
      guest_name: "Rachel",
      guest_type: "closeFriends",
      group_name: "university-friends",
      table_id: "chaos-committee",
      rsvp_status: "pending",
      pax_limit: 2,
    },
    {
      guest_id: "G007",
      token: "auntmay-l9p31e",
      guest_name: "Aunt May",
      guest_type: "family",
      group_name: "family",
      table_id: "family-garden",
      rsvp_status: "confirmed",
      pax_limit: 2,
    },
    {
      guest_id: "G008",
      token: "uncleben-r3x55t",
      guest_name: "Uncle Ben",
      guest_type: "family",
      group_name: "family",
      table_id: "family-garden",
      rsvp_status: "confirmed",
      pax_limit: 2,
    },
    {
      guest_id: "G009",
      token: "daniel-m3q90z",
      guest_name: "Daniel",
      guest_type: "longLostFriends",
      group_name: "university-friends",
      table_id: "garden-overflow",
      rsvp_status: "confirmed",
      pax_limit: 1,
    },
  ],
  messages: [
    {
      message_id: "M001",
      guest_id: "G001",
      guest_name: "Jason",
      table_id: "chaos-committee",
      group_name: "university-friends",
      prompt_type: "你想对即将步入婚姻的 Louis & Joyce 说什么？",
      message: "愿今晚的灯光，照着你们以后的每一天。",
      approved: "yes",
    },
    {
      message_id: "M002",
      guest_id: "G002",
      guest_name: "Marcus",
      table_id: "chaos-committee",
      group_name: "university-friends",
      prompt_type: "你仍然记得的一段回忆是什么？",
      message: "那年一起赶末班车的画面，到现在都还记得。",
      approved: "yes",
    },
  ],
  memoryPrompts: [
    "你仍然记得的一段回忆是什么？",
    "如果年轻时的我们今天重新见面，会觉得最不可思议的是什么？",
    "你想对即将步入婚姻的 Louis & Joyce 说什么？",
  ],
};

const token = new URLSearchParams(window.location.search).get("token");
const page = {
  main: document.querySelector("main"),
  heroKicker: document.querySelector(".hero-content .kicker"),
  heroTitle: document.querySelector("#hero-title"),
  heroDate: document.querySelector(".hero-date"),
  heroLine: document.querySelector(".hero-line"),
  countdown: document.querySelector("#wedding-countdown"),
  countdownValues: document.querySelector(".countdown-values"),
  countdownDays: document.querySelector("#countdown-days"),
  countdownHours: document.querySelector("#countdown-hours"),
  countdownMinutes: document.querySelector("#countdown-minutes"),
  countdownSeconds: document.querySelector("#countdown-seconds"),
  storyTitle: document.querySelector("#story-title"),
  storyMeetingCopy: document.querySelector("#story-meeting-copy"),
  storyWeddingDayCopy: document.querySelector("#story-wedding-day-copy"),
  guestCategoryLabel: document.querySelector("#guest-category-label"),
  personalTitle: document.querySelector("#personal-title"),
  personalMessage: document.querySelector("#personal-message"),
  detailsTitle: document.querySelector("#details-title"),
  detailsGrid: document.querySelector("#details-grid"),
  diningKicker: document.querySelector("#dining-kicker"),
  diningTitle: document.querySelector("#dining-title"),
  diningCopy: document.querySelector("#dining-copy"),
  diningSteps: document.querySelector("#dining-steps"),
  tableKicker: document.querySelector("#table-kicker"),
  tableTitle: document.querySelector("#table-title"),
  tableStoryLabel: document.querySelector("#table-story-label"),
  tableStory: document.querySelector("#table-story"),
  tableThemeLabel: document.querySelector("#table-theme-label"),
  tableTheme: document.querySelector("#table-theme"),
  membersSection: document.querySelector("#members-section"),
  membersKicker: document.querySelector("#members-kicker"),
  membersTitle: document.querySelector("#members-title"),
  membersCopy: document.querySelector("#members-copy"),
  memberList: document.querySelector("#member-list"),
  memoryBoard: document.querySelector("#memory-board"),
  promptList: document.querySelector("#prompt-list"),
  memoryForm: document.querySelector("#memory-form"),
  memoryInput: document.querySelector("#memory-input"),
  memoryConfirmation: document.querySelector("#memory-confirmation"),
  memoryPanel: document.querySelector(".memory-panel"),
  rsvpTitle: document.querySelector("#rsvp-title"),
  rsvpOptionsGroup: document.querySelector(".rsvp-options"),
  rsvpOptions: document.querySelectorAll(".rsvp-option"),
  rsvpFollowup: document.querySelector("#rsvp-followup"),
};

let selectedPrompt = sampleData.memoryPrompts[0];
let currentGuestName = "";
let currentGuestId = "";
let currentGuestKey = "";
let currentPaxLimit = null;
let countdownTimer = null;

function init() {
  setupReveal();

  if (!token) {
    renderInvalidInvitation();
    return;
  }

  renderLoadingState();
  loadInvitationData(token);
}

async function loadInvitationData(invitationToken) {
  try {
    const apiData = await fetchInvitationData(invitationToken);

    if (!apiData.success) {
      renderInvalidInvitation();
      return;
    }

    renderInvitation(createViewModelFromApi(apiData));
  } catch (error) {
    console.warn("API failed. Using sampleData fallback.", error);
    const fallbackData = createFallbackApiShape(invitationToken);

    if (!fallbackData.success) {
      renderInvalidInvitation();
      return;
    }

    renderInvitation(createViewModelFromApi(fallbackData));
  }
}

async function fetchInvitationData(invitationToken) {
  const url = `${API_URL}?token=${encodeURIComponent(invitationToken)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  return response.json();
}

function createFallbackApiShape(invitationToken) {
  const guest = sampleData.guests.find((item) => item.token === invitationToken);

  if (!guest) {
    return {
      success: false,
      error: "Invalid invitation link",
    };
  }

  const table = sampleData.tables.find((item) => item.table_id === guest.table_id);
  const confirmedTableMembers = sampleData.guests.filter(
    (item) => item.table_id === guest.table_id && item.rsvp_status === "confirmed"
  );
  const confirmedGroupMembers = guest.group_name
    ? sampleData.guests.filter(
        (item) => item.group_name === guest.group_name && item.rsvp_status === "confirmed"
      )
    : [];
  const messages = sampleData.messages.filter(
    (item) => item.group_name === guest.group_name && isApproved(item.approved)
  );
  const tableVisibility = createTableVisibility(null, sampleData.settings);

  return {
    success: true,
    guest,
    table,
    confirmedTableMembers,
    confirmedGroupMembers,
    messages,
    settings: sampleData.settings,
    menu: sampleData.menu,
    tableVisibility,
  };
}

function createViewModelFromApi(apiData) {
  const settings = normalizeSettings(apiData.settings);
  const tableVisibility = createTableVisibility(apiData.tableVisibility, settings);
  const guest = sanitizeGuest(apiData.guest || {}, {
    hideTable: !tableVisibility.isReleased,
  });
  const table = tableVisibility.isReleased ? apiData.table || {} : {};
  const guestName = getFirstValue(guest, ["guest_name", "name"], "Guest");
  const guestTypeKey = getFirstValue(guest, ["guest_type", "type"], "");
  const guestType = getGuestTypeCopy(guestTypeKey, guest);

  return {
    settings,
    guest,
    guestName,
    groupName: getFirstValue(guest, ["group_name"], "熟悉面孔"),
    rsvpStatus: normalize(getFirstValue(guest, ["rsvp_status"], "")),
    paxLimit: cleanPaxLimit(getFirstValue(guest, ["pax_limit"], "")),
    guestType,
    tableVisibility,
    table: {
      id: getFirstValue(guest, ["table_id"], getFirstValue(table, ["table_id"], "")),
      name: getFirstValue(table, ["table_name", "name"], "婚礼当天的位置"),
      story: getFirstValue(table, ["table_story", "story"], ""),
      theme: getFirstValue(
        table,
        ["table_theme", "table_type", "theme"],
        "重逢、举杯、慢慢聊完没说完的话。"
      ),
    },
    confirmedTableMembers: (apiData.confirmedTableMembers || [])
      .map(sanitizeGuest)
      .filter((member) => isConfirmed(member))
      .filter((member) => !isDeclined(member)),
    confirmedGroupMembers: (apiData.confirmedGroupMembers || [])
      .map((member) =>
        sanitizeGuest(member, {
          hideTable: true,
        })
      )
      .filter((member) => isConfirmed(member))
      .filter((member) => !isDeclined(member)),
    messages: (apiData.messages || [])
      .filter((message) => isApproved(message.approved))
      .filter((message) => getFirstValue(message, ["message"], "")),
    details: createDetails(settings),
    navigationLinks: createNavigationLinks(settings),
    dining: createDining(settings),
    memoryPrompts: sampleData.memoryPrompts,
  };
}

function getGuestTypeCopy(type, guest) {
  const normalizedType = normalize(type).replace(/[-_\s]/g, "");
  const typeMap = {
    family: "family",
    colleagues: "colleagues",
    colleague: "colleagues",
    closefriends: "closeFriends",
    closefriend: "closeFriends",
    longlostfriends: "longLostFriends",
    longlostfriend: "longLostFriends",
  };
  const typeKey = typeMap[normalizedType];

  const copy =
    sampleData.guestTypes[typeKey] || {
      label: "专属邀请",
      title: "{name}，我们为你准备了这份邀请。",
      message:
        "感谢你成为这一天重要的一部分。我们期待在晚风和暖灯里与你相见。",
    };

  return Object.assign({}, copy, {
    message: getFirstValue(guest, ["personal_message"], copy.message),
  });
}

function normalizeSettings(settings) {
  if (!settings) {
    return {};
  }

  if (Array.isArray(settings)) {
    return settings.reduce((items, item) => {
      if (item.key) {
        items[item.key] = item.value;
      }

      return items;
    }, {});
  }

  return settings;
}

function createTableVisibility(apiVisibility, settings) {
  if (apiVisibility && typeof apiVisibility === "object") {
    return {
      isReleased: Boolean(apiVisibility.isReleased),
      releaseDate: getFirstValue(
        apiVisibility,
        ["releaseDate"],
        getSetting(settings, "table_release_date", TABLE_RELEASE_DATE_FALLBACK)
      ),
      message: getFirstValue(
        apiVisibility,
        ["message"],
        Boolean(apiVisibility.isReleased) ? TABLE_RELEASED_COPY : TABLE_LOCKED_COPY
      ),
    };
  }

  const releaseDate = getSetting(
    settings,
    "table_release_date",
    TABLE_RELEASE_DATE_FALLBACK
  );
  const isReleased =
    normalize(getSetting(settings, "table_check_enabled", "no")) === "yes" ||
    isTodayOnOrAfter(releaseDate);

  return {
    isReleased,
    releaseDate,
    message: isReleased
      ? getSetting(settings, "table_released_copy", TABLE_RELEASED_COPY)
      : getSetting(settings, "table_locked_copy", TABLE_LOCKED_COPY),
  };
}

function isTodayOnOrAfter(releaseDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(releaseDate || ""))) {
    return false;
  }

  const today = new Date();
  const todayKey = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  return todayKey >= releaseDate;
}

function createDetails(settings) {
  return [
    {
      key: "date",
      label: "日期",
      value: getSetting(settings, "wedding_date_display"),
      note: "请把这一天留给我们。",
    },
    {
      key: "time",
      label: "时间",
      value: getSetting(settings, "wedding_start_time"),
      note: "建议预留一些时间抵达、入座和慢慢见面。",
    },
    {
      key: "venue",
      label: "地点",
      value: getSetting(settings, "venue_name"),
      note: getSetting(settings, "venue_address"),
    },
    {
      key: "dress",
      label: "着装",
      value: getSetting(settings, "dress_code"),
      note: "舒服、得体，也适合晚间户外活动即可。",
    },
  ];
}

function createNavigationLinks(settings) {
  return [
    {
      label: "Google Maps",
      url: getSetting(settings, "google_maps_url", ""),
      icon: "assets/google-maps.png",
    },
    {
      label: "Waze",
      url: getSetting(settings, "waze_url", ""),
      icon: "assets/waze.png",
    },
  ].filter((item) => item.url);
}

function createDining(settings) {
  return {
    title: getSetting(settings, "dinner_style_title"),
    formatItems: createDinnerFormatItems(getSetting(settings, "dinner_format")),
    copy: getDinnerCopy(settings),
  };
}

function createDinnerFormatItems(format) {
  const items = String(format || "")
    .split(/[+、,，]/)
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length ? items : DINNER_FORMAT_ITEMS;
}

function getDinnerCopy(settings) {
  const copy = getSetting(settings, "dinner_copy", DINNER_EXPERIENCE_COPY);

  if (!copy || normalize(copy) === "晚餐文案整段") {
    return DINNER_EXPERIENCE_COPY;
  }

  return copy;
}

function getSetting(settings, key, fallback = sampleData.settings[key]) {
  return getFirstValue(settings, [key], fallback || "");
}

function renderLoadingState() {
  page.guestCategoryLabel.textContent = "正在读取邀请";
  page.personalTitle.textContent = "正在为你打开专属婚礼邀请。";
  page.personalMessage.textContent =
    "请稍等一下，我们正在从宾客名单中确认你的邀请信息。";
  page.detailsGrid.innerHTML = "";
  page.diningSteps.innerHTML = "";
  page.tableTitle.textContent = "";
  page.tableStory.textContent = "";
  page.tableTheme.textContent = "";
  page.memberList.innerHTML = "";
  removeGroupMembersSection();
  page.promptList.innerHTML = "";
  page.rsvpFollowup.innerHTML = `<p class="rsvp-placeholder">邀请资料载入中。</p>`;
}

function renderInvalidInvitation() {
  page.main.innerHTML = `
    <section class="scene invitation-scene" aria-labelledby="invalid-title">
      <div class="scene-inner">
        <div class="personal-panel scene-reveal is-visible">
          <p class="kicker">邀请链接无效</p>
          <h2 id="invalid-title">我们暂时无法找到这份专属邀请。</h2>
          <p>
            这个链接可能缺少邀请码，或邀请码并不在宾客名单中。
            请回到原本收到的邀请讯息重新打开，或联系 Louis & Joyce 确认你的专属链接。
          </p>
          <p class="personal-signature">Louis & Joyce</p>
        </div>
      </div>
    </section>
  `;
}

function renderInvitation(viewModel) {
  currentGuestName = viewModel.guestName;
  currentGuestId = getFirstValue(viewModel.guest, ["guest_id"], "");
  currentGuestKey = getMemberKey(viewModel.guest);
  currentPaxLimit = viewModel.paxLimit;
  selectedPrompt = viewModel.memoryPrompts[0];

  renderSettings(viewModel.settings);
  renderStory(viewModel.settings);
  renderPersonalInvitation(viewModel);
  renderDetails(viewModel.details, viewModel.navigationLinks);
  renderDining(viewModel.dining);
  renderTable(viewModel);
  renderMembers(viewModel);
  renderGroupMembers(viewModel);
  renderApprovedMessages(viewModel.messages);
  renderMemoryPrompts(viewModel.memoryPrompts);
  setupMemoryForm();
  setupRsvp(viewModel.rsvpStatus);
}

function renderSettings(settings) {
  page.heroKicker.textContent = getSetting(settings, "visual_theme");
  page.heroTitle.textContent = "Louis & Joyce";
  page.heroDate.textContent = getSetting(settings, "wedding_date_display");
  page.heroLine.textContent = getSetting(settings, "hero_copy");
  setupCountdown(getSetting(settings, "wedding_datetime_iso", WEDDING_DATETIME_FALLBACK));
}

function setupCountdown(targetValue) {
  if (!page.countdown) {
    return;
  }

  const targetTime = new Date(targetValue || WEDDING_DATETIME_FALLBACK).getTime();
  const safeTargetTime = isNaN(targetTime)
    ? new Date(WEDDING_DATETIME_FALLBACK).getTime()
    : targetTime;

  if (countdownTimer) {
    clearInterval(countdownTimer);
  }

  const updateCountdown = () => {
    const remaining = safeTargetTime - Date.now();

    if (remaining <= 0) {
      page.countdown.innerHTML = `<p>今天，我们见面。</p>`;
      clearInterval(countdownTimer);
      countdownTimer = null;
      return;
    }

    const totalSeconds = Math.floor(remaining / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    page.countdownDays.textContent = String(days);
    page.countdownHours.textContent = padCountdownValue(hours);
    page.countdownMinutes.textContent = padCountdownValue(minutes);
    page.countdownSeconds.textContent = padCountdownValue(seconds);
  };

  updateCountdown();
  if (safeTargetTime <= Date.now()) {
    return;
  }

  countdownTimer = setInterval(updateCountdown, 1000);
}

function padCountdownValue(value) {
  return String(value).padStart(2, "0");
}

function renderStory(settings) {
  page.storyTitle.textContent = getSetting(settings, "story_main_title");
  page.storyMeetingCopy.textContent = getSetting(settings, "story_meeting_copy");
  page.storyWeddingDayCopy.textContent = getSetting(
    settings,
    "story_wedding_day_copy"
  );
}

function renderPersonalInvitation(viewModel) {
  page.guestCategoryLabel.textContent = viewModel.guestType.label;
  page.personalTitle.textContent = formatGuestText(
    viewModel.guestType.title,
    viewModel.guestName
  );
  page.personalMessage.textContent = formatGuestText(
    viewModel.guestType.message,
    viewModel.guestName
  );
}

function renderDetails(details, navigationLinks) {
  page.detailsTitle.textContent = "这一天的细节，都为你准备好了。";
  page.detailsGrid.innerHTML = "";

  details.forEach((item) => {
    const detail = document.createElement("article");
    detail.className = "detail-item";
    detail.innerHTML = `
      <span>${item.label}</span>
      <strong>${item.value}</strong>
      <p>${item.note}</p>
    `;

    if (item.key === "venue" && navigationLinks.length) {
      detail.appendChild(createVenueNavigation(navigationLinks));
    }

    page.detailsGrid.appendChild(detail);
  });
}

function createVenueNavigation(navigationLinks) {
  const navigation = document.createElement("div");
  navigation.className = "venue-links";

  navigationLinks.forEach((link) => {
    const button = document.createElement("button");
    const icon = document.createElement("img");
    const label = document.createElement("span");

    button.className = "map-button";
    button.type = "button";
    icon.src = link.icon;
    icon.alt = "";
    icon.setAttribute("aria-hidden", "true");
    label.textContent = link.label;
    button.appendChild(icon);
    button.appendChild(label);
    button.addEventListener("click", () => {
      window.open(link.url, "_blank", "noopener,noreferrer");
    });
    navigation.appendChild(button);
  });

  return navigation;
}

function renderDining(dining) {
  page.diningKicker.textContent = "晚宴体验";
  page.diningTitle.textContent = dining.title;
  page.diningCopy.textContent = dining.copy;
  page.diningSteps.innerHTML = "";

  appendDinnerFormat(dining.formatItems);
}

function appendDinnerFormat(formatItems) {
  const formatBlock = document.createElement("section");
  formatBlock.className = "dinner-format-block";

  const itemList = document.createElement("div");
  itemList.className = "dinner-format-list";

  formatItems.forEach((item) => {
    const formatItem = document.createElement("span");
    formatItem.className = "dinner-format-item";
    formatItem.textContent = item;
    itemList.appendChild(formatItem);
  });

  formatBlock.innerHTML = `
    <span class="dinner-format-label">晚餐形式</span>
    <strong>我们会让晚餐从入座开始，慢慢展开。</strong>
  `;
  formatBlock.appendChild(itemList);
  page.diningSteps.appendChild(formatBlock);
}

function renderTable(viewModel) {
  clearTableCheckButton();

  if (!viewModel.tableVisibility.isReleased) {
    page.tableKicker.textContent = "座位安排";
    page.tableTitle.textContent = "桌位会在婚礼前开放查询。";
    page.tableStoryLabel.textContent = "Check Your Table";
    page.tableStory.textContent = TABLE_LOCKED_BODY;
    setTableThemeVisible(false);
    appendTableCheckButton("婚礼前开放 Check Your Table", true);
    return;
  }

  page.tableKicker.textContent = "Table Check";
  page.tableTitle.textContent = "我们为你留好了位置。";
  page.tableStoryLabel.textContent = viewModel.table.id
    ? `桌位 ${viewModel.table.id}`
    : "你的桌位";
  page.tableStory.textContent = viewModel.table.name || "婚礼当天的位置";
  page.tableThemeLabel.textContent = "给你的安排";
  page.tableTheme.textContent = viewModel.table.story
    ? `${TABLE_RELEASED_BODY}\n\n${viewModel.table.story}`
    : TABLE_RELEASED_BODY;
  setTableThemeVisible(true);
  appendTableCheckButton("Check Your Table", false);
}

function clearTableCheckButton() {
  const existingButton = document.querySelector("#table-check-button");

  if (existingButton) {
    existingButton.remove();
  }
}

function appendTableCheckButton(label, isDisabled) {
  const button = document.createElement("button");
  button.id = "table-check-button";
  button.className = "table-check-button";
  button.type = "button";
  button.textContent = label;
  button.disabled = isDisabled;
  button.setAttribute("aria-disabled", String(isDisabled));
  document.querySelector(".table-story").appendChild(button);
}

function setTableThemeVisible(isVisible) {
  const themeItem = page.tableThemeLabel.closest("div");

  if (themeItem) {
    themeItem.hidden = !isVisible;
  }
}

function renderMembers(viewModel) {
  const isReleased = viewModel.tableVisibility.isReleased;
  const members = isReleased
    ? viewModel.confirmedTableMembers
    : viewModel.confirmedGroupMembers.filter(
        (member) => getMemberKey(member) !== currentGuestKey
      );

  page.membersSection.hidden = false;
  page.membersKicker.textContent = isReleased ? "同桌宾客" : "熟悉面孔";
  page.membersTitle.textContent = isReleased
    ? "会与你同桌的人"
    : "那晚，你会见到一些熟悉的人。";
  page.membersCopy.textContent = isReleased
    ? "这些名字，会在那一晚和你坐在同一桌。"
    : "有些人可能不会坐在同一桌，\n但都会在那一晚出现。";
  page.memberList.innerHTML = "";

  if (!members.length) {
    const item = document.createElement("li");
    item.className = "member-empty";
    item.textContent = isReleased
      ? "同桌宾客还在陆续确认中。等确认多一些，这里会慢慢热闹起来。"
      : "大家还在陆续回复中。等确认多一些，这里会慢慢热闹起来。";
    page.memberList.appendChild(item);
    return;
  }

  members.forEach((member) => {
    const item = document.createElement("li");
    const name = document.createElement("strong");
    name.textContent = getFirstValue(member, ["guest_name", "name"], "Guest");
    item.appendChild(name);
    page.memberList.appendChild(item);
  });
}

function renderGroupMembers(viewModel) {
  if (!viewModel.tableVisibility.isReleased) {
    removeGroupMembersSection();
    return;
  }

  const groupMembers = viewModel.confirmedGroupMembers;
  const tableMembers = viewModel.confirmedTableMembers;

  if (groupMembers.length <= tableMembers.length) {
    removeGroupMembersSection();
    return;
  }

  const tableMemberKeys = new Set(tableMembers.map(getMemberKey));
  const displayMembers = groupMembers.filter((member) => {
    const memberKey = getMemberKey(member);

    if (!memberKey || memberKey === currentGuestKey) {
      return false;
    }

    return !tableMemberKeys.has(memberKey);
  });

  if (!displayMembers.length) {
    removeGroupMembersSection();
    return;
  }

  const groupSection = ensureGroupMembersSection();
  const groupList = groupSection.querySelector("#group-member-list");
  groupList.innerHTML = "";

  displayMembers.forEach((member) => {
    const item = document.createElement("li");
    const name = document.createElement("strong");
    name.textContent = getFirstValue(member, ["guest_name", "name"], "Guest");
    item.appendChild(name);
    groupList.appendChild(item);
  });
}

function ensureGroupMembersSection() {
  const existingSection = document.querySelector("#group-members-section");

  if (existingSection) {
    return existingSection;
  }

  const section = document.createElement("section");
  section.className = "scene members-scene";
  section.id = "group-members-section";
  section.setAttribute("aria-labelledby", "group-members-title");
  section.innerHTML = `
    <div class="scene-inner">
      <div class="scene-heading scene-reveal is-visible">
        <p class="kicker">熟悉面孔</p>
        <h2 id="group-members-title">还有一些熟悉的人，也会在现场。</h2>
        <p>他们可能不会坐在同一桌，<br />但都会在那一晚出现。</p>
      </div>
      <ul class="member-list scene-reveal is-visible" id="group-member-list"></ul>
    </div>
  `;

  document.querySelector(".members-scene").insertAdjacentElement("afterend", section);
  return section;
}

function removeGroupMembersSection() {
  const existingSection = document.querySelector("#group-members-section");

  if (existingSection) {
    existingSection.remove();
  }
}

function getMemberKey(member) {
  return normalize(getFirstValue(member, ["guest_id", "token", "guest_name", "name"], ""));
}

function renderApprovedMessages(messages) {
  page.memoryBoard.innerHTML = "";

  if (!messages.length) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "memory-empty";
    emptyMessage.textContent = "还没有人留下回忆。也许你可以先写第一句。";
    page.memoryBoard.appendChild(emptyMessage);
    return;
  }

  const list = document.createElement("div");
  list.className = "memory-message-list";

  messages.forEach((item) => {
    const message = document.createElement("article");
    const text = document.createElement("p");

    message.className = "memory-message";
    text.textContent = getFirstValue(item, ["message"], "");
    message.appendChild(text);
    list.appendChild(message);
  });

  page.memoryBoard.appendChild(list);
}

function renderMemoryPrompts(prompts) {
  page.promptList.innerHTML = "";

  prompts.forEach((prompt, index) => {
    const button = document.createElement("button");
    button.className = "prompt-button";
    button.type = "button";
    button.textContent = prompt;

    if (index === 0) {
      button.classList.add("is-selected");
    }

    button.addEventListener("click", () => {
      selectedPrompt = prompt;
      page.promptList
        .querySelectorAll(".prompt-button")
        .forEach((option) => option.classList.remove("is-selected"));
      button.classList.add("is-selected");
      page.memoryInput.placeholder = prompt;
    });

    page.promptList.appendChild(button);
  });
}

function renderRsvpFollowup(status) {
  if (status === "attending") {
    const maxAttribute = currentPaxLimit ? ` max="${currentPaxLimit}"` : "";

    page.rsvpFollowup.innerHTML = `
      <form class="attending-form" id="attending-form">
        <div class="field">
          <label for="guest-count">出席人数</label>
          <input id="guest-count" name="guest-count" type="number" min="1"${maxAttribute} value="1" />
        </div>
        <div class="field">
          <label for="dietary">饮食需求</label>
          <input id="dietary" name="dietary" type="text" placeholder="例如：素食、清真、无特别需求" />
        </div>
        <div class="field">
          <label for="allergies">过敏事项</label>
          <input id="allergies" name="allergies" type="text" placeholder="例如：坚果、海鲜、无" />
        </div>
        <div class="field">
          <label for="special-notes">特别备注</label>
          <input id="special-notes" name="special-notes" type="text" placeholder="任何我们需要提前知道的事" />
        </div>
        <button class="rsvp-save" type="submit">保存出席回复</button>
      </form>
    `;

    const attendingForm = document.querySelector("#attending-form");

    if (!attendingForm) {
      return;
    }

    attendingForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const paxInput = document.querySelector("#guest-count");
      const allergies = document.querySelector("#allergies").value;
      const specialNotes = document.querySelector("#special-notes").value;

      if (!isPaxCountAllowed(paxInput.value)) {
        renderRsvpError();
        return;
      }

      await saveRsvpChoice("attending", {
        paxCount: paxInput.value,
        dietaryNotes: document.querySelector("#dietary").value,
        specialNotes: combineSpecialNotes(allergies, specialNotes),
      });
    });
    return;
  }

  if (status === "unsure") {
    saveRsvpChoice("unsure");
    return;
  }

  saveRsvpChoice("unable");
}

function setupRsvp(rsvpStatus) {
  page.rsvpTitle.textContent = `${currentGuestName}，12月5日，可以把这个晚上留给我们吗？`;

  page.rsvpOptions.forEach((button) => {
    button.classList.remove("is-selected");
    button.addEventListener("click", () => {
      page.rsvpOptions.forEach((option) => option.classList.remove("is-selected"));
      button.classList.add("is-selected");
      renderRsvpFollowup(button.dataset.rsvp);
    });
  });

  renderInitialRsvpState(rsvpStatus);
}

function renderInitialRsvpState(rsvpStatus) {
  const status = normalize(rsvpStatus);

  if (status === "confirmed" || status === "maybe" || status === "declined") {
    renderSubmittedRsvpState(status);
    return;
  }

  renderRsvpForm();
}

function renderRsvpForm() {
  setRsvpOptionsVisible(true);
  page.rsvpOptions.forEach((button) => {
    button.classList.remove("is-selected");
  });
  page.rsvpFollowup.innerHTML =
    `<p class="rsvp-placeholder">请选择一个回复，我们会为你安排后续细节。</p>`;
}

function renderSubmittedRsvpState(status) {
  setRsvpOptionsVisible(false);
  page.rsvpFollowup.innerHTML = `
    <p class="rsvp-message">
      ${getSubmittedRsvpCopy(status)}
    </p>
    <button class="rsvp-save" type="button" id="edit-rsvp">需要修改回复</button>
  `;

  const editButton = document.querySelector("#edit-rsvp");

  if (editButton) {
    editButton.addEventListener("click", renderRsvpForm);
  }
}

function getSubmittedRsvpCopy(status) {
  if (status === "confirmed") {
    return "你已经确认出席。我们很期待十二月见到你。";
  }

  if (status === "maybe") {
    return "我们已经收到你的回复。我们会暂时为你保留位置，希望到时能见到你。";
  }

  return "我们已经收到你的回复。虽然这次有点可惜，希望之后还有机会一起吃饭。";
}

async function saveRsvpChoice(status, details = {}) {
  try {
    setRsvpButtonsDisabled(true);
    renderRsvpSavingMessage();
    const savedStatus = RSVP_STATUS_MAP[status];

    await submitRsvp({
      guestId: currentGuestId,
      token,
      rsvpStatus: savedStatus,
      paxCount: details.paxCount || "",
      dietaryNotes: details.dietaryNotes || "",
      specialNotes: details.specialNotes || "",
    });
    renderSubmittedRsvpState(savedStatus);
  } catch (error) {
    console.error("RSVP submission error", error);
    renderRsvpError();
  } finally {
    setRsvpButtonsDisabled(false);
  }
}

async function submitRsvp(details) {
  const payload = {
    action: "rsvp",
    token: details.token,
    guest_id: details.guestId,
    rsvp_status: details.rsvpStatus,
    pax_count: details.paxCount,
    dietary_notes: details.dietaryNotes,
    special_notes: details.specialNotes,
  };

  console.log("RSVP payload before submit", payload);

  const response = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`RSVP request failed with status ${response.status}`);
  }

  const data = await response.json();
  console.log("Apps Script response", data);

  if (!data.success) {
    throw new Error(data.error || "RSVP could not be saved");
  }

  return data;
}

function renderRsvpSavingMessage() {
  page.rsvpFollowup.innerHTML = `
    <p class="rsvp-placeholder">正在保存你的回复。</p>
  `;
}

function renderRsvpError() {
  page.rsvpFollowup.innerHTML = `
    <p class="rsvp-message">
      ${SUBMISSION_ERROR_MESSAGE}
    </p>
  `;
}

function setRsvpOptionsVisible(isVisible) {
  page.rsvpOptionsGroup.style.display = isVisible ? "" : "none";
}

function setRsvpButtonsDisabled(isDisabled) {
  page.rsvpOptions.forEach((button) => {
    button.disabled = isDisabled;
  });
}

function combineSpecialNotes(allergies, specialNotes) {
  const notes = [];

  if (allergies.trim()) {
    notes.push(`过敏事项：${allergies.trim()}`);
  }

  if (specialNotes.trim()) {
    notes.push(`特别备注：${specialNotes.trim()}`);
  }

  return notes.join("；");
}

function cleanPaxLimit(value) {
  const paxLimit = parseInt(value, 10);

  if (isNaN(paxLimit) || paxLimit < 1) {
    return null;
  }

  return paxLimit;
}

function isPaxCountAllowed(value) {
  if (!currentPaxLimit) {
    return true;
  }

  const paxCount = parseInt(value, 10);

  if (isNaN(paxCount)) {
    return true;
  }

  return paxCount <= currentPaxLimit;
}

function setupMemoryForm() {
  page.memoryInput.placeholder = selectedPrompt;

  page.memoryForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const memory = page.memoryInput.value.trim();

    if (!memory) {
      page.memoryInput.focus();
      return;
    }

    try {
      setMemoryFormDisabled(true);
      renderMemorySavingMessage();
      await submitMemory(memory);
      page.memoryInput.value = "";
      renderMemorySuccess();
    } catch (error) {
      console.error("Memory submission error", error);
      renderMemoryError();
    } finally {
      setMemoryFormDisabled(false);
    }
  });
}

async function submitMemory(memory) {
  const payload = {
    action: "memory",
    token,
    guest_id: currentGuestId,
    prompt_type: selectedPrompt,
    message: memory,
  };

  console.log("Memory payload before submit", payload);

  const response = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Memory request failed with status ${response.status}`);
  }

  const data = await response.json();
  console.log("Memory Apps Script response", data);

  if (!data.success) {
    throw new Error(data.error || "Memory could not be saved");
  }

  return data;
}

function renderMemorySavingMessage() {
  page.memoryConfirmation.textContent = "正在保存这段记忆。";
}

function renderMemorySuccess() {
  page.memoryConfirmation.textContent = MEMORY_SUCCESS_MESSAGE;
}

function renderMemoryError() {
  page.memoryConfirmation.textContent = SUBMISSION_ERROR_MESSAGE;
}

function setMemoryFormDisabled(isDisabled) {
  page.memoryInput.disabled = isDisabled;
  page.memoryForm
    .querySelectorAll("button")
    .forEach((button) => {
      button.disabled = isDisabled;
    });
}

function setupReveal() {
  const revealItems = document.querySelectorAll(".scene-reveal");

  if (!("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.18 }
  );

  revealItems.forEach((item) => observer.observe(item));
}

function sanitizeGuest(guest, options = {}) {
  const publicGuest = Object.assign({}, guest);
  delete publicGuest.whatsapp;
  delete publicGuest.table_locked;
  delete publicGuest.invitation_status;
  delete publicGuest.plus_one_allowed;

  if (options.hideTable) {
    delete publicGuest.table_id;
  }

  return publicGuest;
}

function isDeclined(guest) {
  const rsvpStatus = normalize(getFirstValue(guest, ["rsvp_status"], ""));
  return rsvpStatus === "declined" || rsvpStatus === "unable";
}

function isConfirmed(guest) {
  const rsvpStatus = normalize(getFirstValue(guest, ["rsvp_status"], "confirmed"));
  return rsvpStatus === "confirmed";
}

function isApproved(value) {
  const normalized = normalize(value);
  return normalized === "true" || normalized === "yes" || normalized === "approved";
}

function formatGuestText(text, name) {
  return text.replaceAll("{name}", name);
}

function getFirstValue(item, keys, fallback) {
  for (const key of keys) {
    if (item[key] !== undefined && item[key] !== null && item[key] !== "") {
      return item[key];
    }
  }

  return fallback;
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

init();
