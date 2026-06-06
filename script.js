const API_URL =
  "https://script.google.com/macros/s/AKfycbzO4xAfw11aKclxz5xzo1A8F0zliCI_Wy59DV_N6XDfQ5NVRjlm171g33hoczYXqmf0gA/exec";

// Local sample data stays here only as a fallback if the live API cannot load.
// This shape is intentionally close to the Google Sheets structure.
const sampleData = {
  settings: {
    couple: "Louis & Joyce",
    wedding_date: "5 December 2026",
    hero_line: "透明花房、晚风、暖灯，还有我们想认真款待的每一位客人。",
  },
  guestTypes: {
    family: {
      label: "给家人",
      title: "{name}，谢谢你一路把我们放在心上。",
      message:
        "这一天对我们很重要，因为你会在场。我们想在玻璃花房的灯光里，好好向你说一声谢谢，也请你见证我们成为彼此的家人。",
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
        "婚礼是这一晚的主角，但我们也悄悄期待那些久违的拥抱和一句“好久不见”。你的位置已经留好，希望十二月能在花房灯光下重新见到你。",
    },
  },
  details: [
    {
      label: "日期",
      value: "2026年12月5日",
      note: "星期六，晚间婚礼",
    },
    {
      label: "时间",
      value: "18:00 入场 · 18:45 仪式",
      note: "花园灯光会在傍晚慢慢亮起",
    },
    {
      label: "地点",
      value: "玻璃花房花园，吉隆坡",
      note: "户外花园与透明玻璃结构",
    },
    {
      label: "着装",
      value: "浅色正式着装",
      note: "象牙白、柔薰衣草、尤加利绿或香槟金细节皆可",
    },
  ],
  dining: [
    {
      label: "Pre-set Starter",
      title: "预设前菜",
      note: "入座时已准备好第一道轻食，让大家不用一开始就离席取餐。",
    },
    {
      label: "Served Main Course",
      title: "桌边主菜",
      note: "主菜会送到每一位宾客面前，把晚餐时间留给交谈、举杯和祝福。",
    },
    {
      label: "Dessert Table",
      title: "甜点台",
      note: "仪式与晚宴之后，大家可以自由取用甜点，慢慢走动，也慢慢重逢。",
    },
  ],
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
      table_id: "chaos-committee",
      rsvp_status: "confirmed",
    },
    {
      guest_id: "G002",
      token: "marcus-f4p81q",
      guest_name: "Marcus",
      guest_type: "longLostFriends",
      table_id: "chaos-committee",
      rsvp_status: "confirmed",
    },
    {
      guest_id: "G003",
      token: "weijie-n6v42m",
      guest_name: "Wei Jie",
      guest_type: "longLostFriends",
      table_id: "chaos-committee",
      rsvp_status: "confirmed",
    },
    {
      guest_id: "G004",
      token: "kelvin-h8s13b",
      guest_name: "Kelvin",
      guest_type: "longLostFriends",
      table_id: "chaos-committee",
      rsvp_status: "confirmed",
    },
    {
      guest_id: "G005",
      token: "amanda-k5r18n",
      guest_name: "Amanda",
      guest_type: "closeFriends",
      table_id: "chaos-committee",
      rsvp_status: "confirmed",
    },
    {
      guest_id: "G006",
      token: "rachel-p2d77u",
      guest_name: "Rachel",
      guest_type: "closeFriends",
      table_id: "chaos-committee",
      rsvp_status: "pending",
    },
    {
      guest_id: "G007",
      token: "auntmay-l9p31e",
      guest_name: "Aunt May",
      guest_type: "family",
      table_id: "family-garden",
      rsvp_status: "confirmed",
    },
    {
      guest_id: "G008",
      token: "uncleben-r3x55t",
      guest_name: "Uncle Ben",
      guest_type: "family",
      table_id: "family-garden",
      rsvp_status: "confirmed",
    },
  ],
  messages: [
    {
      message_id: "M001",
      guest_id: "G001",
      table_id: "chaos-committee",
      prompt_type: "memory",
      message: "愿今晚的灯光，照着你们以后的每一天。",
      approved: true,
    },
    {
      message_id: "M002",
      guest_id: "G002",
      table_id: "chaos-committee",
      prompt_type: "memory",
      message: "那年一起赶末班车的画面，到现在都还记得。",
      approved: true,
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
  heroTitle: document.querySelector("#hero-title"),
  heroDate: document.querySelector(".hero-date"),
  heroLine: document.querySelector(".hero-line"),
  guestCategoryLabel: document.querySelector("#guest-category-label"),
  personalTitle: document.querySelector("#personal-title"),
  personalMessage: document.querySelector("#personal-message"),
  detailsGrid: document.querySelector("#details-grid"),
  diningSteps: document.querySelector("#dining-steps"),
  tableTitle: document.querySelector("#table-title"),
  tableStory: document.querySelector("#table-story"),
  tableTheme: document.querySelector("#table-theme"),
  memberList: document.querySelector("#member-list"),
  promptList: document.querySelector("#prompt-list"),
  memoryForm: document.querySelector("#memory-form"),
  memoryInput: document.querySelector("#memory-input"),
  memoryConfirmation: document.querySelector("#memory-confirmation"),
  memoryPanel: document.querySelector(".memory-panel"),
  rsvpTitle: document.querySelector("#rsvp-title"),
  rsvpOptions: document.querySelectorAll(".rsvp-option"),
  rsvpFollowup: document.querySelector("#rsvp-followup"),
};

let selectedPrompt = sampleData.memoryPrompts[0];
let currentGuestName = "";

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
  const messages = sampleData.messages.filter(
    (item) => item.table_id === guest.table_id && isApproved(item.approved)
  );

  return {
    success: true,
    guest,
    table,
    confirmedTableMembers,
    messages,
    settings: sampleData.settings,
  };
}

function createViewModelFromApi(apiData) {
  const guest = sanitizeGuest(apiData.guest || {});
  const table = apiData.table || {};
  const settings = normalizeSettings(apiData.settings);
  const guestName = getFirstValue(guest, ["guest_name", "name"], "Guest");
  const guestTypeKey = getFirstValue(guest, ["guest_type", "type"], "");
  const guestType = getGuestTypeCopy(guestTypeKey, guest);

  return {
    settings,
    guest,
    guestName,
    guestType,
    table: {
      name: getFirstValue(table, ["table_name", "name"], "你的餐桌"),
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
    messages: (apiData.messages || [])
      .filter((message) => isApproved(message.approved))
      .filter((message) => getFirstValue(message, ["message"], "")),
    details: createDetails(settings),
    dining: sampleData.dining,
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
        "感谢你成为这一天重要的一部分。我们期待在玻璃花房的灯光下与你相见。",
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

function createDetails(settings) {
  return [
    {
      label: "日期",
      value: settings.wedding_date || settings.date || "2026年12月5日",
      note: settings.date_note || "星期六，晚间婚礼",
    },
    {
      label: "时间",
      value: settings.wedding_time || "18:00 入场 · 18:45 仪式",
      note: settings.time_note || "花园灯光会在傍晚慢慢亮起",
    },
    {
      label: "地点",
      value: settings.venue || "玻璃花房花园，吉隆坡",
      note: settings.venue_note || "户外花园与透明玻璃结构",
    },
    {
      label: "着装",
      value: settings.dress_code || "浅色正式着装",
      note:
        settings.dress_code_note ||
        "象牙白、柔薰衣草、尤加利绿或香槟金细节皆可",
    },
  ];
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
  selectedPrompt = viewModel.memoryPrompts[0];

  renderSettings(viewModel.settings);
  renderPersonalInvitation(viewModel);
  renderDetails(viewModel.details);
  renderDining(viewModel.dining);
  renderTable(viewModel.table);
  renderMembers(viewModel.confirmedTableMembers);
  renderApprovedMessages(viewModel.messages);
  renderMemoryPrompts(viewModel.memoryPrompts);
  setupMemoryForm();
  setupRsvp();
}

function renderSettings(settings) {
  page.heroTitle.textContent = settings.couple || "Louis & Joyce";
  page.heroDate.textContent = settings.wedding_date || settings.date || "5 December 2026";
  page.heroLine.textContent =
    settings.hero_line ||
    "透明花房、晚风、暖灯，还有我们想认真款待的每一位客人。";
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

function renderDetails(details) {
  page.detailsGrid.innerHTML = "";

  details.forEach((item) => {
    const detail = document.createElement("article");
    detail.className = "detail-item";
    detail.innerHTML = `
      <span>${item.label}</span>
      <strong>${item.value}</strong>
      <p>${item.note}</p>
    `;
    page.detailsGrid.appendChild(detail);
  });
}

function renderDining(dining) {
  page.diningSteps.innerHTML = "";

  dining.forEach((item) => {
    const step = document.createElement("article");
    step.className = "dining-step";
    step.innerHTML = `
      <span>${item.label}</span>
      <strong>${item.title}</strong>
      <p>${item.note}</p>
    `;
    page.diningSteps.appendChild(step);
  });
}

function renderTable(table) {
  page.tableTitle.textContent = table.name;
  page.tableStory.textContent = table.story;
  page.tableTheme.textContent = table.theme;
}

function renderMembers(members) {
  page.memberList.innerHTML = "";

  members.forEach((member) => {
    const item = document.createElement("li");
    item.innerHTML = `
      <strong>${getFirstValue(member, ["guest_name", "name"], "Guest")}</strong>
      <span>已确认出席</span>
    `;
    page.memberList.appendChild(item);
  });
}

function renderApprovedMessages(messages) {
  const existingList = document.querySelector("#approved-message-list");

  if (existingList) {
    existingList.remove();
  }

  if (!messages.length) {
    return;
  }

  const list = document.createElement("div");
  list.id = "approved-message-list";
  list.className = "memory-confirmation";
  list.innerHTML = messages
    .map((item) => `<p>${getFirstValue(item, ["message"], "")}</p>`)
    .join("");

  page.memoryPanel.insertBefore(list, page.memoryForm);
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
    page.rsvpFollowup.innerHTML = `
      <form class="attending-form" id="attending-form">
        <div class="field">
          <label for="guest-count">出席人数</label>
          <input id="guest-count" name="guest-count" type="number" min="1" max="4" value="1" />
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

    attendingForm.addEventListener("submit", (event) => {
      event.preventDefault();
      page.rsvpFollowup.innerHTML = `
        <p class="rsvp-message">
          谢谢你，${currentGuestName}。我们已经为你记录出席回复，也会根据你的备注安排晚宴细节。
        </p>
      `;
    });
    return;
  }

  if (status === "unsure") {
    page.rsvpFollowup.innerHTML = `
      <p class="rsvp-message">
        我们会先为你保留座位。<br />
        仍然希望十二月能和你一起庆祝。
      </p>
    `;
    return;
  }

  page.rsvpFollowup.innerHTML = `
    <p class="rsvp-message">
      我们会想念你在场的样子。<br />
      等婚礼之后，我们再找一个时间好好见面。
    </p>
  `;
}

function setupRsvp() {
  page.rsvpTitle.textContent = `${currentGuestName}，你会来到花房，和我们一起庆祝吗？`;
  page.rsvpFollowup.innerHTML =
    `<p class="rsvp-placeholder">请选择一个回复，我们会为你安排后续细节。</p>`;

  page.rsvpOptions.forEach((button) => {
    button.classList.remove("is-selected");
    button.addEventListener("click", () => {
      page.rsvpOptions.forEach((option) => option.classList.remove("is-selected"));
      button.classList.add("is-selected");
      renderRsvpFollowup(button.dataset.rsvp);
    });
  });
}

function setupMemoryForm() {
  page.memoryInput.placeholder = selectedPrompt;

  page.memoryForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const memory = page.memoryInput.value.trim();

    if (!memory) {
      page.memoryInput.focus();
      return;
    }

    page.memoryConfirmation.textContent = `已保存：${selectedPrompt} — ${memory}`;
    page.memoryInput.value = "";
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

function sanitizeGuest(guest) {
  const publicGuest = Object.assign({}, guest);
  delete publicGuest.whatsapp;
  return publicGuest;
}

function isDeclined(guest) {
  const rsvpStatus = normalize(getFirstValue(guest, ["rsvp_status"], ""));
  const invitationStatus = normalize(getFirstValue(guest, ["invitation_status"], ""));
  return (
    rsvpStatus === "declined" ||
    rsvpStatus === "unable" ||
    invitationStatus === "declined"
  );
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
